import * as Request from "./request/request.js"
import * as Prompt from "./prompt.js"
import * as Action from "./types/actions/actions.js"
import * as Chat from "../ui/components/chat.js"

import { exists } from "../utils/file-utils.js"

import { TextParser } from "./parser.js"
import { AgentEventBus } from "./event.js"

import { AttachManager } from "./types/attach.js"
import { GoalManager } from "./types/goal.js"
import { CommandManager } from "./types/commands.js"
import { MemoryManager } from "./types/memory.js"

import type { BasePlugin } from "./types/plugins/plugins.js"

class HistoryContext {
    private work: Request.ChatMessage[] = [];
    private chat: Request.ChatMessage[] = [];

    trimChat(maxLength: number) {
        if (this.chat.length > maxLength) {
            this.chat = this.chat.slice(-maxLength);
        }
    }

    trimWork(maxLength: number) {
        if (this.work.length > maxLength) {
            this.work = this.work.slice(-maxLength);
        }
    }

    getChat(): readonly Request.ChatMessage[] {
        return this.chat;
    }

    getWork(): readonly Request.ChatMessage[] {
        return this.work;
    }

    addChat(message: Request.ChatMessage) {
        this.chat.push(message);
    }

    addWork(message: Request.ChatMessage) {
        this.work.push(message);
    }

    clearChat() {
        this.chat = [];
    }

    clearWork() {
        this.work = [];
    }
}

export interface AgentTokens {
    prompt: number;
    completion: number;
    cached: number;
}

export interface AgentContext {
    readonly attach: AttachManager;
    readonly goals: GoalManager;
    readonly memory: MemoryManager;
    readonly commands: CommandManager;
    readonly actions: Action.ActionManager;

    readonly events: AgentEventBus;

    readonly history: HistoryContext;

    readonly cwd: string;
}

export class Agent {
    private requester: Request.RequestManager;
    private plugins: BasePlugin[] = [];

    public context: AgentContext;
    public totalTokens: AgentTokens = { prompt: 0, completion: 0, cached: 0 };

    public startTime: number = 0;

    private stopped = false;

    constructor(strategy: Request.LlmModelStrategy, cwd: string, plugins: BasePlugin[]) {
        if (!exists(cwd)) {
            throw new Error(`${cwd} is not valid dir`);
        }

        this.requester = new Request.RequestManager(strategy);

        this.context = {
            attach: new AttachManager(),
            goals: new GoalManager(),
            memory: new MemoryManager(),
            commands: new CommandManager(),
            actions: new Action.ActionManager(),

            events: new AgentEventBus(),

            history: new HistoryContext(),

            cwd: cwd,
        };

        for (const plugin of plugins) {
            plugin.init(this.context);
        }

        this.plugins = plugins;

        this.context.actions.register(Action.FinishAction.definition);
        this.context.actions.register(Action.DetachAction.definition);
    }

    public get model(): string | null {
        return this.requester.strategy.getModel();
    }

    async stop() {
        this.stopped = true;
        this.requester.stop();
    }

    async run(prompt: string) {
        this.stopped = false;
        const MAX_INVALID_ITERATIONS = 5;

        const userPrompt = TextParser.cleanInvisibleChars(prompt);

        this.context.history.addChat(new Request.ChatMessage(userPrompt, "user"));

        let invalidIter = 0;

        let promptTokens = 0;
        let completionTokens = 0;
        let cachedTokens = 0;

        this.startTime = Date.now();

        let history;
        try {
            this.emitChat({ type: "user", text: prompt });
            this.emit("busy", true);

            while (true) {
                if (invalidIter >= MAX_INVALID_ITERATIONS) {
                    this.emitChat({ type: "error", text: "LLM returned too many invalid responses." });

                    this.emitChat({
                        type: "finish",
                        duration: Date.now() - this.startTime,
                        finishAt: Date.now(),
                        tokens: { prompt: promptTokens, completion: completionTokens, cached: cachedTokens }
                    });
                    return;
                }

                history = await this.constructHistory();

                let response;
                try {
                    response = await this.requester.send(history);
                }
                catch (error) {
                    invalidIter++;

                    if (error instanceof DOMException && error.name === "AbortError") {
                        this.emitChat({ type: "error", text: "Task stopped by user." });

                        this.emitChat({
                            type: "finish",
                            duration: Date.now() - this.startTime,
                            finishAt: Date.now(),
                            tokens: {
                                prompt: promptTokens,
                                completion: completionTokens,
                                cached: cachedTokens,
                            }
                        });

                        return;
                    }

                    const message = error instanceof Error
                        ? error.message
                        : String(error);

                    this.emitChat({
                        type: "error",
                        text: message,
                    });

                    this.context.history.addWork(new Request.ChatMessage(
                        `Previous request failed with: ${message}. Retry by producing a valid JSON action.`,
                        "system"
                    ));
                    continue;
                }

                if (response == null) {
                    invalidIter++;

                    this.emitChat({ type: "error", text: "LLM returned empty response" });
                    continue;
                }

                promptTokens += response.promptTokens ?? 0;
                completionTokens += response.completionTokens ?? 0;
                this.addTokens(response.promptTokens ?? 0, response.completionTokens ?? 0);

                const parsed = TextParser.parseLlmResponse(response.content, this.context.actions);

                if (parsed.message)
                    this.emitChat({ type: "agent", text: parsed.message });

                if (parsed.memory.length > 0) {
                    this.context.memory.update(parsed.memory);
                }

                if (parsed.action == null) {
                    invalidIter++;

                    this.emitChat({ type: "error", text: "LLM returned no valid response", raw: response.content });

                    this.context.history.addWork(
                        new Request.ChatMessage(
                            "Your previous response contained no valid action or goal update. Continue the task and output exactly one valid action as JSON.",
                            "user"
                        )
                    );
                    continue;
                }

                invalidIter = 0;

                const goals = parsed.goals;

                if (goals.length > 0)
                    this.context.goals.update(goals);

                const action = parsed.action;

                if (action instanceof Action.FinishAction) {
                    const finishMessage = new Request.ChatMessage(response.content, "assistant");

                    this.context.history.addChat(finishMessage);
                    history.push(finishMessage);

                    this.emitChat({
                        type: "finish",
                        duration: Date.now() - this.startTime,
                        finishAt: Date.now(),
                        tokens: { prompt: promptTokens, completion: completionTokens, cached: cachedTokens }
                    });
                    return;
                }

                let result;
                try {
                    result = await action.execute(this.context.cwd);
                }
                catch (error) {
                    invalidIter++;
                    const message = error instanceof Error
                        ? error.message
                        : String(error);

                    this.emitChat({
                        type: "error",
                        text: message,
                    });

                    this.context.history.addWork(new Request.ChatMessage(
                        `Previous request failed with: ${message}.`,
                        "system"
                    ));
                    continue;
                }

                if (action instanceof Action.BaseAttachAction) {
                    for (const attach of action.createAttaches())
                        this.context.attach.add(attach);
                }
                else if (action instanceof Action.DetachAction) {
                    for (const path of action.paths)
                        this.context.attach.remove(path);
                }

                const status = result.ok ? "ok" : "error";
                this.context.history.addWork(new Request.ChatMessage(Prompt.getResult(`[${result.type}:${status}] ${result.content.join("\n")}`), "system"));

                this.emitChat({
                    type: "action",
                    actionType: result.type,
                    ok: result.ok,
                    content: result.content,
                    shortContent: result.shortContent,
                });
            }
        }
        finally {
            this.emitDebug({ text: JSON.stringify(history, null, 4), date: new Date() });

            this.emit("busy", false);
            this.clearHistory();
        }
    }

    public clearHistory() {
        this.context.history.clearWork();
        this.context.history.trimChat(10);

        this.context.attach.clear();
        this.context.goals.clear();
    }

    private emitChat(line: Chat.AgentLineResult) {
        this.context.events.emit("chat", line);
    }

    private emitDebug(line: Chat.DebugLine) {
        this.context.events.emit("debug", line);
    }

    private emit(name: string, args: any) {
        this.context.events.emit(name, args);
    }

    private addTokens(prompt: number, completion: number) {
        this.totalTokens.prompt += prompt;
        this.totalTokens.completion += completion;
    }

    private async constructHistory(): Promise<Request.ChatMessage[]> {
        const messages: Request.ChatMessage[] = [];

        messages.push(new Request.ChatMessage(Prompt.getBehavior(this.context.actions), "system"));

        messages.push(...this.context.history.getChat());
        messages.push(...this.context.history.getWork());

        const goals = this.context.goals.getGoals();
        if (goals.length > 0)
            messages.push(new Request.ChatMessage(Prompt.getGoals(goals), "system"));

        await this.context.attach.update(this.context.cwd);

        const attached = this.context.attach.get();
        if (attached.length > 0)
            messages.push(new Request.ChatMessage(Prompt.getAttached(attached), "system"));

        const memory = this.context.memory.get();
        if (memory.length > 0)
            messages.push(new Request.ChatMessage(Prompt.getMemory(memory), "system"));

        return messages;
    }
}