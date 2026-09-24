import type { AgentContext } from "../agent.js";

export interface CommandResult {
    success: boolean;
    message?: string;
}

export abstract class BaseCommand {
    abstract name: string;
    abstract description: string;

    abstract execute(ctx: AgentContext, args: string[]): CommandResult;
}

export class ClearContextCommand extends BaseCommand {
    readonly name = "clear";
    readonly description = "Clear agent context.";

    execute(ctx: AgentContext, args: string[]): CommandResult {
        ctx.history.clearChat();
        ctx.history.clearWork();

        return {
            success: true,
            message: "Agent context cleared."
        };
    }
}

export class ClearMessagesCommand extends BaseCommand {
    readonly name = "clear_ui";
    readonly description = "Clear UI messages.";

    execute(ctx: AgentContext, args: string[]): CommandResult {
        ctx.events.emit("clear_ui");

        return {
            success: true,
        };
    }
}

export class QuitCommand extends BaseCommand {
    readonly name = "quit";
    readonly description = "Quit from app.";

    execute(ctx: AgentContext, args: string[]): CommandResult {
        process.stdout.write("\x1b[2J\x1b[H");
        process.exit(0);
    }
}

export interface CommandEvent {
    name: string;
    args: string[];
    result: CommandResult;
}

export class CommandManager {
    readonly commands: Map<string, BaseCommand> = new Map();

    execute(raw: string, ctx: AgentContext):CommandResult {
        if (!raw.startsWith("/")) {
            throw new Error("Command must start with /");
        }

        const args = raw.slice(1).trim().split(/\s+/);

        const name = args.shift();

        if (!name) {
            throw new Error("Command name is missing");
        }

        const command = this.commands.get(name);

        if (!command) {
            const result: CommandResult = {
                success: false,
                message: `Unknown command: ${name}`
            };

            ctx.events.emit("command", {
                name,
                args,
                result
            } satisfies CommandEvent);

            return result;
        }

        const result = command.execute(ctx, args);

        ctx.events.emit("command", {
            name,
            args,
            result
        } satisfies CommandEvent);

        return result;
    }

    register(cmd: BaseCommand) {
        this.commands.set(cmd.name, cmd);
    }

    get(): readonly BaseCommand[] {
        return [...this.commands.values()];
    }

    getMatches(input: string): BaseCommand[] {
        if (!input.startsWith("/")) {
            return [];
        }

        const query = input.slice(1).toLowerCase();

        return [...this.commands.values()]
            .filter(cmd => cmd.name.toLowerCase().includes(query))
            .sort((a, b) => {
                const aStarts = a.name.toLowerCase().startsWith(query);
                const bStarts = b.name.toLowerCase().startsWith(query);

                return Number(bStarts) - Number(aStarts);
            });
    }

    clear() {
        this.commands.clear();
    }
}