import type { AgentContext } from "../../agent.js";

export abstract class BasePlugin {
    abstract name: string;
    abstract description: string;
    abstract version: string;

    abstract init(ctx: AgentContext): Promise<void>;
}