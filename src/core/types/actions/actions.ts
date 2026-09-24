import { exec } from "node:child_process";
import { promisify } from "node:util";
import { spawn } from "node:child_process";

const execAsync = promisify(exec);

import * as File from "../../../utils/file-utils.js"
import * as Attach from "../attach.js";
import type { ParsedAction } from "../../parser.js";
import { truncate } from "../../../utils/format_utils.js";

export interface ExecutedAction {
    type: string;
    ok: boolean;
    content: string[];
    shortContent?: string;
    data?: Attach.DettachedContext;
}

export abstract class BaseAction {
    abstract execute(workingDirectory: string): Promise<ExecutedAction>;
}

export abstract class BaseAttachAction extends BaseAction {
    abstract createAttaches(): Attach.BaseAttach[];
}

export interface ActionType {
    readonly name: string;
    readonly description: string;
    readonly syntax: string;

    create(action: ParsedAction): BaseAction | null;
}

export class ActionManager {
    readonly actions: ActionType[] = [];

    register(action: ActionType) {
        this.actions.push(action);
    }

    get(): readonly ActionType[] {
        return this.actions;
    }
}

export class WriteFileAction extends BaseAction {
    static readonly definition: ActionType = {
        name: "write_file",
        description: "Overwrite a file.",
        syntax: JSON.stringify({
            action: "write_file",
            args: {
                path: "script.js",
                content: "const x = 1;"
            }
        }, null, 4),

        create(action: ParsedAction): BaseAction | null {
            const path = action.args["path"];
            if (typeof path !== "string")
                return null;

            const content = action.args["content"];
            if (typeof content !== "string")
                return null;

            return new WriteFileAction(path, content);
        }
    };

    constructor(private readonly path: string, private readonly content: string) {
        super();
    }

    async execute(workingDirectory: string): Promise<ExecutedAction> {
        const filePath = File.resolvePath(workingDirectory, this.path);

        File.createDir(filePath);
        File.writeContent(filePath, this.content);

        const lines = File.countLines(this.content);

        return {
            type: "write_file",
            ok: true,
            content: lines === 0
                ? [`File "${this.path}" overwritten successfully. Empty file (0 lines).`]
                : [`File "${this.path}" overwritten successfully. ${lines} lines.`]
        };
    }
}

/*
export class EditFileAction extends BaseAction {
    static readonly definition: ActionType = {
        name: "edit_file",
        description: "Replace the specified line range in a file with the provided content.",
        syntax: `<edit_file path="path" from="line" to="line">content</edit_file>`,
        safety: ActionSafety.HIGH,

        create(tag: ParsedTag): BaseAction | null {
            const path = tag.attributes.path;
            const from = Number(tag.attributes.from);
            const to = Number(tag.attributes.to);

            if (!path || !Number.isInteger(from) || !Number.isInteger(to)) {
                return null;
            }

            return new EditFileAction(path, from, to, tag.content);
        }
    };

    constructor(
        public readonly path: string,
        public readonly from: number,
        public readonly to: number,
        public readonly content: string) {
        super();
    }

    async execute(workingDirectory: string): Promise<ExecutedAction> {
        const filePath = File.resolvePath(workingDirectory, this.path);

        if (!File.exists(filePath)) {
            throw new Error(`File not found: ${this.path}`);
        }

        const fileContent = await File.readContent(filePath);
        const lines = fileContent.split(/\r?\n/);

        if (this.from > lines.length) {
            throw new Error(`Start line ${this.from} is outside the file. File has ${lines.length} lines.`);
        }

        let to = Math.min(this.to, lines.length);

        if (this.from < 0 || to < this.from) {
            throw new Error(`Invalid range: ${this.from}-${to}`);
        }

        const newContent = this.content.split(/\r?\n/);

        lines.splice(
            this.from,
            to - this.from,
            ...newContent
        );

        await File.writeContent(filePath, lines.join("\n"));

        return {
            type: "edit_file",
            content: `File "${this.path}" edited lines ${this.from}-${to}.`
        };
    }
}
*/

export class EditFileAction extends BaseAction {
    static readonly definition: ActionType = {
        name: "edit_file",
        description: "Replace a specific existing text fragment in a file with new content. Use this action for small or localized code changes instead of rewriting the entire file. The old text must match exactly and should be specific enough to identify the intended code.",
        syntax: JSON.stringify({
            action: "edit_file",
            args: {
                path: "script.js",
                old: "const x = 1;",
                new: "const x = 2;"
            }
        }, null, 4),

        create(action: ParsedAction): BaseAction | null {
            const path = action.args["path"];
            if (typeof path !== "string")
                return null;

            const oldContent = action.args["old"];
            if (typeof oldContent !== "string")
                return null;

            const newContent = action.args["new"];
            if (typeof newContent !== "string")
                return null;

            return new EditFileAction(path, oldContent, newContent);
        }
    };

    constructor(
        public readonly path: string,
        public readonly oldContent: string,
        public readonly newContent: string) {
        super();
    }

    async execute(workingDirectory: string): Promise<ExecutedAction> {
        const filePath = File.resolvePath(workingDirectory, this.path);

        if (!File.exists(filePath)) {
            throw new Error(`File not found: ${this.path}`);
        }

        const fileContent = await File.readContent(filePath);
        const index = fileContent.indexOf(this.oldContent);

        if (index === -1) {
            return {
                type: "edit_file",
                ok: false,
                content: [`Text "${truncate(this.oldContent, 100)}" not found in file "${this.path}".`]
            };
        }

        const newContent =
            fileContent.slice(0, index) +
            this.newContent +
            fileContent.slice(index + this.oldContent.length);

        if (newContent === fileContent) {
            return {
                type: "edit_file",
                ok: false,
                content:
                    [`No changes applied to "${this.path}": ` +
                        `the replacement would produce identical content. ` +
                        `The edit was already applied or the old fragment is a prefix of the new one. ` +
                        `Do NOT repeat this action; verify the file or choose a different edit.`]
            };
        }

        await File.writeContent(filePath, newContent);

        const startLine = fileContent.slice(0, index).split("\n").length;
        const lineCount = this.oldContent.split("\n").length;
        const endLine = startLine + lineCount - 1;

        const location =
            startLine === endLine
                ? `line ${startLine}`
                : `lines ${startLine}-${endLine}`;

        return {
            type: "edit_file",
            ok: true,
            content: [`Edited "${this.path}" at ${location}.`]
        };
    }
}

/*
export class ReplaceFileAction extends BaseAction {
    static readonly definition: ActionType = {
        name: "replace_file",
        description: "Replace a specific existing text fragment in a file with new content. Use this action for small or localized code changes instead of rewriting the entire file. The old text must match exactly and should be specific enough to identify the intended code.",
        syntax: `<replace_file path="path" old="..." new="..."></replace_file>`,
        safety: ActionSafety.HIGH,

        create(tag: ParsedTag): BaseAction | null {
            const path = tag.attributes.path;
            const oldContent = tag.attributes["old"];
            const newContent = tag.attributes["new"];

            if (!path || !oldContent || !newContent) {
                return null;
            }

            return new ReplaceFileAction(path, oldContent, newContent);
        }
    };

    constructor(
        public readonly path: string,
        public readonly oldContent: string,
        public readonly newContent: string) {
        super();
    }

    async execute(workingDirectory: string): Promise<ExecutedAction> {
        const filePath = File.resolvePath(workingDirectory, this.path);

        if (!File.exists(filePath)) {
            throw new Error(`File not found: ${this.path}`);
        }

        const fileContent = await File.readContent(filePath);
        const index = fileContent.indexOf(this.oldContent);

        if (index === -1) {
            return {
                type: "replace_file",
                content: `Text not found in file "${this.path}".`
            };
        }

        const newContent =
            fileContent.slice(0, index) +
            this.newContent +
            fileContent.slice(index + this.oldContent.length);

        await File.writeContent(filePath, newContent);

        return {
            type: "replace_file",
            content: `Replaced text in "${this.path}".`
        };
    }
}
*/

export class InsertFileAction extends BaseAction {
    static readonly definition: ActionType = {
        name: "insert_file",
        description: "Insert text before a specified line in an existing file.",
        syntax: JSON.stringify({
            action: "insert_file",
            args: {
                path: "script.js",
                line: "1",
                content: "const x = 1;"
            }
        }, null, 4),

        create: args => {
            const path = args.args["path"];
            const line = args.args["line"];
            const content = args.args["content"];

            if (typeof path !== "string" ||
                typeof line !== "number" ||
                !Number.isInteger(line) ||
                line < 0 ||
                typeof content !== "string") {
                return null;
            }

            return new InsertFileAction(path, line, content);
        }
    };

    constructor(
        private readonly path: string,
        private readonly line: number,
        private readonly content: string
    ) {
        super();
    }

    public async execute(workingDirectory: string): Promise<ExecutedAction> {
        const filePath = File.resolvePath(workingDirectory, this.path);
        const existing = await File.readContent(filePath);

        const lines = existing.split("\n");

        if (this.line > lines.length) {
            return {
                type: "insert_file",
                ok: false,
                content: [`Line ${this.line} is out of range. File "${this.path}" has ${lines.length} lines.`]
            };
        }

        lines.splice(this.line, 0, this.content);

        await File.writeContent(
            filePath,
            lines.join("\n")
        );

        return {
            type: "insert_file",
            ok: true,
            content: [`Inserted ${this.content.split("\n").length} lines before line ${this.line} in "${this.path}".`]
        };
    }
}

export class CreateFileAction extends BaseAction {
    static readonly definition: ActionType = {
        name: "create_file",
        description: "Create a new file. Optional initial content can be provided.",
        syntax: JSON.stringify({
            action: "create_file",
            args: {
                path: "script.js",
                content: "const x = 1;"
            }
        }, null, 4),

        create(action: ParsedAction): BaseAction | null {
            const path = action.args["path"];
            if (typeof path !== "string")
                return null;

            const content = action.args["content"] ?? "";
            if (typeof content !== "string")
                return null;

            return new CreateFileAction(path, content);
        }
    };

    constructor(private readonly path: string, private readonly content: string) {
        super();
    }

    async execute(workingDirectory: string): Promise<ExecutedAction> {
        const filePath = File.resolvePath(workingDirectory, this.path);

        File.createDir(filePath);
        File.writeContent(filePath, this.content);

        const lines = File.countLines(this.content);

        return {
            type: "create_file",
            ok: true,
            content: lines === 0
                ? [`File "${this.path}" created successfully. Empty file (0 lines).`]
                : [`File "${this.path}" created successfully. ${lines} lines.`]
        };
    }
}

export class DeleteFileAction extends BaseAction {
    static readonly definition: ActionType = {
        name: "delete_file",
        description: "Delete a file.",
        syntax: JSON.stringify({
            action: "delete_file",
            args: {
                path: "old.js"
            }
        }, null, 4),

        create(action: ParsedAction): BaseAction | null {
            const filePath = action.args["path"];
            if (typeof filePath !== "string")
                return null;

            return new DeleteFileAction(filePath);
        }
    };

    constructor(private readonly path: string) {
        super();
    }

    async execute(workingDirectory: string): Promise<ExecutedAction> {
        const filePath = File.resolvePath(workingDirectory, this.path);

        await File.remove(filePath);

        return {
            type: "delete_file",
            ok: true,
            content: [`File "${this.path}" deleted successfully.`]
        };
    }
}

export class SearchAction extends BaseAction {
    static readonly definition: ActionType = {
        name: "search",
        description: "Search content in directory",
        syntax: JSON.stringify({
            action: "search",
            args: {
                texts: ["TaskManager", "BotContext"],
                depth: 2
            }
        }, null, 4),

        create(action: ParsedAction): BaseAction | null {
            const texts = action.args["texts"];

            if (!Array.isArray(texts) || !texts.every(text => typeof text === "string")) {
                return null;
            }

            const depth = action.args["depth"];

            if (typeof depth !== "number")
                return null;

            return new SearchAction(texts, depth);
        }
    };

    constructor(private readonly texts: string[], private readonly depth: number) {
        super();
    }

    async execute(workingDirectory: string): Promise<ExecutedAction> {
        const results: string[] = [];

        for (const text of this.texts) {
            const matches = await File.findText(
                workingDirectory,
                text,
                this.depth
            );

            if (matches.length > 0) {
                results.push(`"${text}" found:\n${matches.join("\n")}`);
            }
            else {
                results.push(`"${text}" not found`);
            }
        }

        return {
            type: "search",
            ok: true,
            content: results
        };
    }
}

export class FindFilesAction extends BaseAction {
    static readonly definition: ActionType = {
        name: "find_files",
        description: "Find files by names",
        syntax: JSON.stringify({
            action: "find_files",
            args: {
                names: ["task.ts", "index.tsx"],
                depth: 2
            }
        }, null, 4),

        create(action: ParsedAction): BaseAction | null {
            const names = action.args["names"];

            if (!Array.isArray(names) || !names.every(name => typeof name === "string")) {
                return null;
            }

            const depth = action.args["depth"];
            if (typeof depth !== "number")
                return null;

            return new FindFilesAction(names, depth);
        }
    };

    constructor(private readonly names: string[], private readonly depth: number) {
        super();
    }

    async execute(workingDirectory: string): Promise<ExecutedAction> {
        const results: string[] = [];

        for (const fileName of this.names) {
            const files = await File.findFilesByName(
                workingDirectory,
                fileName,
                this.depth
            );

            if (files.length > 0) {
                results.push(`${fileName} found: ${files.join(", ")}`);
            }
            else {
                results.push(`${fileName} not found`);
            }
        }

        if (results.length === 0) {
            return {
                type: "find_files",
                ok: false,
                content: [
                    `Files not found: ${this.names.join(", ")}`
                ]
            };
        }

        return {
            type: "find_files",
            ok: true,
            content: results
        };
    }
}

export class AttachFilesAction extends BaseAttachAction {
    static readonly definition: ActionType = {
        name: "attach_files",
        description: "Attach multiple project files to the context at once.",
        syntax: JSON.stringify({
            action: "attach_files",
            args: {
                files: [
                    {
                        path: "src/main.ts",
                    },
                    {
                        path: "src/utils.ts",
                        from: 0,
                        to: 100
                    }
                ]
            }
        }, null, 4),

        create(action: ParsedAction): BaseAction | null {
            const files = action.args["files"];

            if (!Array.isArray(files))
                return null;

            const contexts: Attach.AttachedFileContext[] = [];

            for (const file of files) {
                if (typeof file !== "object" || file === null)
                    return null;

                const path = file["path"];

                if (typeof path !== "string")
                    return null;

                const from = file["from"] !== undefined
                    ? Number(file["from"])
                    : 0;

                const to = file["to"] !== undefined
                    ? Number(file["to"])
                    : 500;

                if (!Number.isInteger(from) || !Number.isInteger(to))
                    return null;

                contexts.push({ path, from, to });
            }

            return new AttachFilesAction(contexts);
        }
    };

    constructor(private readonly contexts: Attach.AttachedFileContext[]) {
        super();
    }

    createAttaches(): Attach.BaseAttach[] {
        return this.contexts.map(
            context => new Attach.FileAttach(context)
        );
    }

    async execute(workingDirectory: string): Promise<ExecutedAction> {
        const content: string[] = [];

        for (const context of this.contexts) {
            const path = File.resolvePath(
                workingDirectory,
                context.path
            );

            const fileContent = await File.readContent(path);
            const lines = File.countLines(fileContent);

            if (context.from < 0 || context.to < context.from) {
                throw new Error(`Invalid range for "${context.path}": ${context.from}-${context.to}`);
            }

            if (context.to > lines)
                context.to = lines;

            if (context.to - context.from > 500) {
                throw new Error(`Maximum read range is 500 lines for "${context.path}".`);
            }

            content.push(`File "${context.path}" ${context.from}-${context.to} attached successfully.`);
        }

        return {
            type: "attach_files",
            ok: true,
            content
        };
    }
}

export class DetachAction extends BaseAction {
    static readonly definition: ActionType = {
        name: "detach",
        description: "Detach attachments when you no longer need their contents.",
        syntax: JSON.stringify({
            action: "detach",
            args: {
                paths: [
                    "src/main.ts",
                    "src/utils.ts"
                ]
            }
        }, null, 4),

        create(action: ParsedAction): BaseAction | null {
            const paths = action.args["paths"];

            if (!Array.isArray(paths))
                return null;

            if (!paths.every(path => typeof path === "string"))
                return null;

            return new DetachAction(paths);
        }
    };

    constructor(readonly paths: string[]) {
        super();
    }

    async execute(workingDirectory: string): Promise<ExecutedAction> {
        return {
            type: "detach",
            ok: true,
            content: this.paths.map(path => `Attachment "${path}" detached successfully.`)
        };
    }
}

export class CommandAction extends BaseAction {
    static readonly definition: ActionType = {
        name: "command",
        description: "Execute a shell command. Use background=true for long-running processes.",
        syntax: JSON.stringify({
            action: "command",
            args: {
                cmd: "npm test",
                background: false,
            }
        }, null, 4),

        create(action: ParsedAction): BaseAction | null {
            const cmd = action.args["cmd"];
            if (typeof cmd !== "string")
                return null;

            const background = action.args["background"] === true;

            return new CommandAction(cmd, background);
        }
    };

    constructor(private readonly command: string, private readonly background: boolean) {
        super();
    }

    async execute(workingDirectory: string): Promise<ExecutedAction> {
        if (this.background)
            return this.executeBackground(workingDirectory);

        return this.executeForeground(workingDirectory);
    }

    async executeForeground(workingDirectory: string): Promise<ExecutedAction> {
        try {
            const { stdout, stderr } = await execAsync(
                this.command,
                { cwd: workingDirectory }
            );

            return {
                type: "command",
                ok: true,
                content:
                    [
                        this.command,
                        `stdout:\n${stdout}`,
                        `stderr:\n${stderr}`,
                    ],

                shortContent: `${this.command} executed successfully.\n${stdout}`
            };
        }
        catch (error: any) {
            const out = error.stdout ?? "";
            const err = error.stderr ?? "";

            return {
                type: "command",
                ok: false,
                content:
                    [
                        this.command,
                        `exit code: ${error.code}`,
                        `stdout:\n${out}`,
                        `stderr:\n${err}`,
                    ],

                shortContent: `${this.command} failed with exit code ${error.code}.\n${out}\n${err}`
            };
        }
    }

    private executeBackground(workingDirectory: string): Promise<ExecutedAction> {
        return new Promise((resolve) => {
            try {
                const process = spawn(this.command, {
                    cwd: workingDirectory,
                    shell: true,
                    detached: true,
                    stdio: "ignore"
                });

                process.unref();

                resolve({
                    type: "command",
                    ok: true,
                    content:
                        [
                            `${this.command}`,
                            `process started in background`,
                            `pid: ${process.pid}`,
                        ],
                    shortContent: `${this.command} started in background. (pid: ${process.pid}).`
                });
            } catch (error: any) {
                resolve({
                    type: "command",
                    ok: false,
                    content:
                        [
                            `${this.command}`,
                            `failed to start background process`,
                            `${error.message ?? error}`
                        ],
                    shortContent: `${this.command} failed to start.`
                });
            }
        });
    }
}

export class AttachTreeAction extends BaseAttachAction {
    static readonly definition: ActionType = {
        name: "attach_tree",
        description: "Attach the project file tree to the context.",
        syntax: JSON.stringify({
            action: "attach_tree",
            args: {
                path: "."
            }
        }, null, 4),

        create(action: ParsedAction): BaseAction | null {
            const path = action.args["path"];

            if (typeof path !== "string")
                return null;

            return new AttachTreeAction(path);
        }
    };

    constructor(private readonly path: string) {
        super();
    }

    async execute(workingDirectory: string): Promise<ExecutedAction> {
        return {
            type: "attach_tree",
            ok: true,
            content: [`Tree "${this.path}" attached successfully.`],
            data: {
                path: this.path
            } satisfies Attach.AttachedTreeContext
        };
    }

    createAttaches(): Attach.BaseAttach[] {
        return [new Attach.TreeAttach({
            path: this.path
        })];
    }
}

export class FinishAction extends BaseAction {
    static readonly definition: ActionType = {
        name: "finish",
        description:
            "End the current iteration and return control to the user. " +
            "Use this after giving your final answer to complete the task — " +
            "it finishes the task, and the user will type the next input.",
        syntax: JSON.stringify({
            action: "finish"
        }, null, 4),

        create(action: ParsedAction): BaseAction | null {
            return new FinishAction();
        }
    };

    constructor() {
        super();
    }

    async execute(workingDirectory: string): Promise<ExecutedAction> {
        return {
            type: "finish",
            ok: true,
            content: ["finish"]
        };
    }
}