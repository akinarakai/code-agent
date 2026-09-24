import { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { Agent } from "../core/agent.js";
import { formatDuration, formatNumber, formatTime, truncate } from "../utils/format_utils.js";
import type { Goal } from "../core/types/goal.js";
import type { MemoryItem } from "../core/types/memory.js";
import * as Chat from "./components/chat.js";
import type { BaseAttach } from "../core/types/attach.js";
import type { CommandEvent } from "../core/types/commands.js";

interface AppProps {
    agent: Agent;
    onSubmit: (text: string) => void;
    onCancel: () => void;
}

interface ChatMenuProps {
    lines: Chat.ChatLine[];
    app: AppProps;
    busy: boolean;
    input: string;
    frame: number;
};

interface ContextMenuProps {
    app: AppProps;
};

interface DebugMenuProps {
    app: AppProps;
    lines: Chat.DebugLine[];
}

interface InputBarProps {
    input: string;
    app: AppProps;
    chatMode: ChatMode;
}

type ChatMode = "chat" | "context" | "debug";

const CHAT_MODES: ChatMode[] = [
    "chat",
    "context",
    "debug"
];

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function App(app: AppProps) {
    const [input, setInput] = useState("");
    const [chatLines, setChatLines] = useState<Chat.ChatLine[]>([]);
    const [debugLines, setDebugLines] = useState<Chat.DebugLine[]>([]);
    const [busy, setBusy] = useState(false);
    const [frame, setFrame] = useState(0);
    const [chatMode, setChatMode] = useState<ChatMode>("chat");

    useInput((char, key) => {
        if (key.tab) {
            if (input.startsWith("/")) {
                const matches = app.agent.context.commands.getMatches(input);

                if (matches.length > 0) {
                    const currentIndex = matches.findIndex(
                        command => `/${command.name}` === input);

                    const nextIndex = currentIndex === -1
                        ? 0
                        : (currentIndex + 1) % matches.length;

                    setInput(`/${matches[nextIndex]?.name}`);
                    return;
                }
            }

            setChatMode(mode => {
                const currentIndex = CHAT_MODES.indexOf(mode);
                const nextIndex = (currentIndex + 1) % CHAT_MODES.length;

                return CHAT_MODES[nextIndex]!;
            });

            return;
        }

        if (busy) {
            if (key.escape) {
                app.onCancel();
                return;
            }
        }

        if (key.return) {
            const text = input.trim();

            if (text.length === 0) {
                setInput("");
                return;
            }

            if (!busy) {
                app.onSubmit(text);
                setInput("");
            }

            return;
        }

        if (key.backspace || key.delete) {
            setInput(prev => prev.slice(0, -1));
            return;
        }

        if (char) {
            setInput(prev => prev + char);
        }
    });

    useEffect(() => {
        if (!busy) return;

        setFrame(0);

        const spin = setInterval(() => setFrame(f => (f + 1) % SPINNER.length), 80);

        return () => {
            clearInterval(spin);
        };
    }, [busy]);

    useEffect(() => {
        const onChat = (line: Chat.AgentLineResult) => {
            setChatLines(prev => [...prev, { data: line }]);
        };

        const onDebug = (line: Chat.DebugLine) => {
            setDebugLines(prev => [...prev, line]);
        };

        const onCommand = (cmd: CommandEvent) => {
            setChatLines(prev => [...prev, { data: cmd }]);
        };

        const onBusy = (b: boolean) => {
            setBusy(b);
        };

        const onClearUI = () => {
            setChatLines([]);
            setDebugLines([]);
        }

        const events = app.agent.context.events;

        events.on("chat", onChat);
        events.on("debug", onDebug);
        events.on("clear_ui", onClearUI);
        events.on("command", onCommand);
        events.on("busy", onBusy);

        return () => {
            events.off("chat", onChat);
            events.off("debug", onDebug);
            events.off("clear_ui", onClearUI);
            events.off("command", onCommand);
            events.off("busy", onBusy);
        };
    }, [app.agent]);

    let content;

    switch (chatMode) {
        case "chat":
            content = (
                <ChatMenu
                    lines={chatLines}
                    app={app}
                    busy={busy}
                    input={input}
                    frame={frame}
                />
            );
            break;

        case "context":
            content = (
                <ContextMenu
                    app={app}
                />
            );
            break;

        case "debug":
            content = (
                <DebugMenu
                    app={app}
                    lines={debugLines}
                />
            )
            break;
    }

    return (
        <Box flexDirection="column">
            {/* ── Header:*/}
            <Box marginBottom={1}>
                <Box flexDirection="column" marginRight={2}>
                    <Text>{"╭────╮"}</Text>
                    <Text>{"│ >_ │"}</Text>
                    <Text>{"╰────╯"}</Text>
                </Box>

                <Box flexDirection="column" justifyContent="center">
                    <Text>
                        <Text bold color="cyan">CodeAgent</Text>
                        <Text> v0.1.0</Text>
                    </Text>
                    <Text>{app.agent.model ?? "unknown"}</Text>
                    <Text>{app.agent.context.cwd}</Text>
                </Box>
            </Box>

            {content}

            <MemoryPanel memory={app.agent.context.memory.get()} />
            <GoalsPanel goals={app.agent.context.goals.getGoals()} />
            <AttachPanel attached={app.agent.context.attach.getAttached()} />

            <InputBar input={input} app={app} chatMode={chatMode} />
        </Box>
    );
}

function ChatMenu({ lines, app, busy, input, frame }: ChatMenuProps) {
    return <>
        {lines.length > 0 && (
            <Box flexDirection="column" paddingX={1}>
                {lines.map((line, i) => (
                    <Box key={i} marginBottom={1}>
                        {chatLine(line)}
                    </Box>
                ))}
            </Box>
        )}

        {busy && (
            <Box paddingX={1} marginBottom={1}>
                <Text color="gray">
                    {SPINNER[frame]} Working…{" "}
                </Text>
                <Text color="gray">
                    ({formatDuration(Date.now() - app.agent.startTime)})
                </Text>
                <Text color="gray">
                    {" · esc for cancel"}
                </Text>
            </Box>
        )}
    </>;
}

function ContextMenu({ app }: ContextMenuProps) {
    const history = [...app.agent.context.history.getChat(), ...app.agent.context.history.getWork()];
    if (history.length === 0) return null;

    return (
        <Box flexDirection="column" paddingX={1}>
            {history.map((message, i) => (
                <Box
                    key={i}
                    flexDirection="column"
                    marginBottom={1}
                >
                    <Text bold color={message.role === "user" ? "cyan" : "green"}>
                        {message.role === "user" ? "user" : "assistant"}
                    </Text>
                    <Text>{message.content}</Text>
                </Box>
            ))}
        </Box>
    );
}

function DebugMenu({ app, lines }: DebugMenuProps) {
    if (lines.length === 0) return null;

    return (
        <Box flexDirection="column" paddingX={1}>
            {lines.map((line, i) => (
                <Box key={i} marginBottom={1}>
                    <Text dimColor>
                        [{line.date.toLocaleTimeString()}]
                    </Text>
                    <Text> {line.text}</Text>
                </Box>
            ))}
        </Box>
    );
}

function InputBar({ input, app, chatMode }: InputBarProps) {
    const matches = app.agent.context.commands.getMatches(input);

    return <>
        {input.startsWith("/") && matches.length > 0 && (
            <Box flexDirection="column" paddingX={2} marginBottom={1}>
                <Text color="gray" dimColor>
                    Commands
                </Text>

                {matches.map((command, index) => (
                    <Box key={command.name}>
                        <Text color={index === 0 ? "cyan" : "gray"}>
                            {index === 0 ? "❯ " : "  "}
                        </Text>

                        <Text bold color={index === 0 ? "white" : "gray"}>
                            /{command.name}
                        </Text>

                        <Text color="gray">
                            {"  "}{command.description}
                        </Text>
                    </Box>
                ))}
            </Box>
        )}

        <Box paddingX={1}>
            <Text
                bold
                color={
                    chatMode === "chat"
                        ? "cyan"
                        : chatMode === "debug"
                            ? "green"
                            : "yellow"
                }
            >
                ◆ {chatMode}
            </Text>
            <Text color="gray">{" (Tab)"}</Text>
            <Text color="gray">{" · "}</Text>
            <Text color="gray">
                ↑ {formatNumber(app.agent.totalTokens.prompt)} · ↓ {formatNumber(app.agent.totalTokens.completion)}
            </Text>
        </Box>

        <Box
            borderStyle="single"
            borderLeft={false}
            borderRight={false}
            paddingX={1}
        >
            <Text color="white">{"❯ "}</Text>
            <Text>{input}</Text>
            <Text inverse> </Text>
        </Box>
    </>
}

function GoalsPanel({ goals }: { goals: readonly Goal[] }) {
    if (goals.length === 0) return null;

    const done = goals.filter(g => g.status === "completed").length;
    const current = goals.find(g => g.status === "in_progress");

    function iconFor(s: Goal) {
        switch (s.status) {
            case "pending": return "○";
            case "in_progress": return "▸";
            case "completed": return "✓";
        }
    }

    return (
        <Box
            flexDirection="column"
            borderStyle="single"
            borderLeft={false}
            borderRight={false}
            paddingX={1}
        >
            <Box justifyContent="space-between">
                <Text color="gray">Goals · {done}/{goals.length}</Text>
            </Box>

            {goals.map(g => (
                <Box key={g.id}>
                    <Text>{iconFor(g)}{" "}</Text>
                    <Text color={g.status === "completed" ? "gray" : "white"}>
                        {g.description}
                    </Text>
                </Box>
            ))}
        </Box>
    );
}

function MemoryPanel({ memory }: { memory: readonly MemoryItem[] }) {
    if (memory.length === 0) return null;

    return (
        <Box
            flexDirection="column"
            borderStyle="single"
            borderLeft={false}
            borderRight={false}
            paddingX={1}
        >
            <Text color="gray">Memory · {memory.length}</Text>

            {memory.map(item => (
                <Box key={item.key}>
                    <Text color="cyan">{item.key}</Text>
                    <Text color="gray"> → </Text>
                    <Text>
                        {truncate(String(item.value).replace(/\n/g, " "), 60)}
                    </Text>
                </Box>
            ))}
        </Box>
    );
}

function AttachPanel({ attached }: { attached: readonly BaseAttach[] }) {
    if (attached.length === 0) return null;

    return (
        <Box
            flexDirection="column"
            borderStyle="single"
            borderLeft={false}
            borderRight={false}
            paddingX={1}
        >
            <Text color="gray">
                Attach · {attached.length}{" "}
                {attached.length === 1 ? "attachment" : "attachments"}
            </Text>

            {attached.map((attach, i) => (
                <Box key={i}>
                    <Text color="gray">{"  · "}</Text>
                    <Text color="white">{truncate(attach.path, 60)}</Text>
                </Box>
            ))}
        </Box>
    );
}

function chatLine(line: Chat.ChatLine) {
    const data = line.data;

    if (typeof data !== "object" || data === null) {
        return;
    }

    const agentLine = data as Chat.AgentLineResult;
    if (agentLine) {
        switch (agentLine.type) {
            case "user":
                return (
                    <Box>
                        <Box width={3}>
                            <Text backgroundColor="grey" color="white">
                                {" ❯ "}
                            </Text>
                        </Box>

                        <Box flexGrow={1}>
                            <Text backgroundColor="grey" color="white">
                                {" " + agentLine.text + " "}
                            </Text>
                        </Box>
                    </Box>
                );

            case "agent":
                return (
                    <Box>
                        <Box width={3}>
                            <Text color="white">⏺</Text>
                        </Box>

                        <Box flexGrow={1}>
                            <Text>{agentLine.text}</Text>
                        </Box>
                    </Box>
                );

            case "finish":
                return (
                    <Box>
                        <Box width={3}>
                            <Text color="gray">✦</Text>
                        </Box>

                        <Box flexGrow={1}>
                            <Text color="gray">
                                {`${formatDuration(agentLine.duration)} · ${formatNumber(agentLine.tokens.prompt + agentLine.tokens.completion)} tokens · ${formatTime(agentLine.finishAt)}`}
                            </Text>
                        </Box>
                    </Box>
                );

            case "action":
                return (
                    <Box flexDirection="column">
                        <Box>
                            <Box width={3}>
                                <Text color={agentLine.ok ? "white" : "red"}>
                                    {"▶"}
                                </Text>
                            </Box>

                            <Box flexGrow={1}>
                                <Text bold>
                                    {agentLine.actionType}
                                </Text>
                            </Box>
                        </Box>

                        {agentLine.shortContent ? (
                            <Box>
                                <Box width={3} />

                                <Box flexGrow={1}>
                                    <Text color="gray">
                                        {"⎿  "}{agentLine.shortContent}
                                    </Text>
                                </Box>
                            </Box>
                        ) : (
                            agentLine.content.map((content, i) => (
                                <Box key={i}>
                                    <Box width={3} />

                                    <Box flexGrow={1}>
                                        <Text color="gray">
                                            {"⎿  "}{content}
                                        </Text>
                                    </Box>
                                </Box>
                            ))
                        )}
                    </Box>
                );

            case "error":
                return (
                    <Box flexDirection="column">
                        <Box>
                            <Box width={3}>
                                <Text backgroundColor="red" color="white" bold>
                                    {" ✗ "}
                                </Text>
                            </Box>

                            <Box flexGrow={1}>
                                <Text backgroundColor="red" color="white" bold>
                                    {" " + agentLine.text + " "}
                                </Text>
                            </Box>
                        </Box>

                        {agentLine.raw && (
                            <Box>
                                <Box width={3} />

                                <Box flexGrow={1}>
                                    <Text color="gray">
                                        {"⎿  "}{agentLine.raw}
                                    </Text>
                                </Box>
                            </Box>
                        )}
                    </Box>
                );
        }
    }

    const commandLine = data as CommandEvent;
    if (commandLine && commandLine.result.message) {
        return (
            <Box flexDirection="column">
                <Box>
                    <Box width={3}>
                        <Text color={commandLine.result.success ? "white" : "red"}>
                            {commandLine.result.success ? "▶" : "✗"}
                        </Text>
                    </Box>

                    <Box flexGrow={1}>
                        <Text bold>
                            /{commandLine.name}
                        </Text>

                        {commandLine.args.length > 0 && (
                            <Text color="gray">
                                {" "}{commandLine.args.join(" ")}
                            </Text>
                        )}
                    </Box>
                </Box>

                {commandLine.result.message && (
                    <Box>
                        <Box width={3} />

                        <Box flexGrow={1}>
                            <Text color={commandLine.result.success ? "gray" : "red"}>
                                {"⎿  "}{commandLine.result.message}
                            </Text>
                        </Box>
                    </Box>
                )}
            </Box>
        );
    }
}