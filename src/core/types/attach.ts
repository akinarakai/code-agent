import * as File from "../../utils/file-utils.js"

export abstract class BaseAttach {
    abstract readonly path: string;

    abstract execute(workingDirectory: string): Promise<string>;
}

export interface AttachedFileContext {
    path: string;
    from: number;
    to: number;
}

export interface AttachedTreeContext {
    path: string;
}

export interface DettachedContext {
    path: string;
}

export class FileAttach extends BaseAttach {
    readonly path: string;

    constructor(readonly context: AttachedFileContext) {
        super();
        this.path = context.path;
    }

    async execute(workingDirectory: string): Promise<string> {
        const filePath = File.resolvePath(workingDirectory, this.context.path);
        const content = await File.readContent(filePath);

        const lines = File.countLines(content);

        /*
        const selectedContent = content
            .split(/\r?\n/)
            .slice(file.from, file.to)
            .map((line, index) => `${file.from + index} | ${line}`)
            .join("\n");
        */

        const selectedContent = content
            .split(/\r?\n/)
            .slice(this.context.from, this.context.to)
            .join("\n");

        return `File "${this.context.path}"\nTotal Lines ${lines}\nSelected ${this.context.from}-${this.context.to}\n${selectedContent}`;
    }
}

export class TreeAttach extends BaseAttach {
    readonly path: string;

    constructor(readonly context: AttachedTreeContext) {
        super();
        this.path = context.path;
    }

    async execute(workingDirectory: string): Promise<string> {
        const path = File.resolvePath(workingDirectory, this.context.path);
        const tree = await File.getFilesTree(path);

        return `Full path: ${path}\nPath: "${this.context.path}"\n${tree}`;
    }
}

export class AttachManager {
    private attached: BaseAttach[] = [];
    private result: string[] = [];

    public add(attach: BaseAttach) {
        this.attached.push(attach);
    }

    public remove(path: string): void {
        this.attached = this.attached.filter(attach => attach.path !== path);
    }

    public async update(workingDirectory: string): Promise<void> {
        this.result = [];

        for (const attach of this.attached) {
            this.result.push(await attach.execute(workingDirectory));
        }
    }

    public get(): string[] {
        return this.result;
    }

    public getAttached(): readonly BaseAttach[] {
        return this.attached;
    }

    public clear() {
        this.attached = [];
        this.result = [];
    }
}