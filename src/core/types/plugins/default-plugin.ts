import type { AgentContext } from "../../agent.js";
import { BasePlugin } from "./plugins.js";

import * as Cmd from "../commands.js";
import * as Action from "../actions/actions.js";
import * as Prompt from "../../prompt.js";

export class DefaultPlugin extends BasePlugin {
    name: string = "default";
    description: string = "default";
    version: string = "none version";

    async init(ctx: AgentContext): Promise<void> {
        ctx.commands.register(new Cmd.ClearContextCommand());
        ctx.commands.register(new Cmd.ClearMessagesCommand());
        ctx.commands.register(new Cmd.QuitCommand());

        ctx.actions.register(Action.CreateFileAction.definition);
        ctx.actions.register(Action.DeleteFileAction.definition);

        ctx.actions.register(Action.FindFilesAction.definition);
        ctx.actions.register(Action.SearchAction.definition);

        ctx.actions.register(Action.EditFileAction.definition);
        ctx.actions.register(Action.WriteFileAction.definition);
        ctx.actions.register(Action.InsertFileAction.definition);

        ctx.actions.register(Action.AttachFilesAction.definition);
        ctx.actions.register(Action.AttachTreeAction.definition);

        ctx.actions.register(Action.CommandAction.definition);

        ctx.memory.update([
            { key: "env.os", value: Prompt.getMemoryOs() },
            { key: "env.cwd", value: ctx.cwd },
            { key: "behavior.rules", value: Prompt.getMemoryRules() },
            { key: "behavior.workflow", value: Prompt.getMemoryWorkflow() },
            { key: "behavior.autonomy", value: Prompt.getMemoryBehavior() },
        ]);
    }
}