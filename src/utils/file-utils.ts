import { mkdir, writeFile, readFile, rm, access } from "node:fs/promises";
import path, { join } from "node:path";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { IGNORE_DIRS } from "../utils/dir_utils.js";
import { formatFileSize } from "../utils/format_utils.js";

const execAsync = promisify(exec);

export function resolvePath(workingDirectory: string, filePath: string): string {
    const resolved = path.resolve(workingDirectory, filePath);
    const relative = path.relative(workingDirectory, resolved);

    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error([
            "Path is outside working directory.",
            `Working directory: ${workingDirectory}`,
            `Provided path: ${filePath}`,
            `Resolved path: ${resolved}`,
        ].join("\n")
        );
    }

    return resolved;
}

export function countLines(content: string): number {
    if (content.length === 0)
        return 0;

    return content.endsWith("\n")
        ? content.split("\n").length - 1
        : content.split("\n").length;
}

export async function getFilesTree(dir: string): Promise<string> {
    const lines: string[] = [];

    const result = await walk(dir, 0);
    for (const walk of result) {
        if (walk.isDirectory) {
            lines.push(`${walk.path}/`);
        }
        else {
            lines.push(`${walk.path} (${formatFileSize(walk.fileSize ?? 0)})`);
        }
    }

    return lines.join('\n');
}

export async function findFilesByName(dir: string, fileName: string, depth: number): Promise<string[]> {
    const result = await walk(dir, depth);
    const query = fileName.toLowerCase();

    const files = result
        .filter(entry =>
            !entry.isDirectory &&
            entry.name.toLowerCase().includes(query)
        )
        .map(entry =>
            path.relative(dir, entry.path)
        );

    return files;
}

export async function findText(dir: string, text: string, depth: number): Promise<string[]> {
    const result = await walk(dir, depth);
    const query = text.toLowerCase();

    const matches: string[] = [];

    for (const entry of result) {
        if (entry.isDirectory)
            continue;

        try {
            const content = await fs.readFile(entry.path, "utf8");
            const lines = content.split(/\r?\n/);

            for (let i = 0; i < lines.length; i++) {
                if (!lines[i]!.toLowerCase().includes(query))
                    continue;

                const filePath = path.relative(dir, entry.path);

                matches.push(`${filePath}:${i + 1}: ${lines[i]!.trim()}`);
            }
        }
        catch {
            // Ignore unreadable/binary files
        }
    }

    return matches;
}

interface WalkResult {
    name: string;
    path: string;
    isDirectory: boolean;
    fileSize?: number;
}

async function walk(current: string, depth: number): Promise<WalkResult[]> {
    const results: WalkResult[] = [];

    if (depth < 0)
        return results;

    try {
        const entries = await fs.readdir(current, {
            withFileTypes: true
        });

        for (const entry of entries) {
            if (entry.isDirectory() && IGNORE_DIRS.has(entry.name))
                continue;

            const entryPath = path.join(current, entry.name);

            if (entry.isDirectory()) {
                results.push({
                    name: entry.name,
                    path: entryPath,
                    isDirectory: true
                });

                results.push(...(await walk(entryPath, depth - 1)));
            }
            else {
                const stats = await fs.stat(entryPath);

                results.push({
                    name: entry.name,
                    path: entryPath,
                    isDirectory: false,
                    fileSize: stats.size
                });
            }
        }
    }
    catch {
        // Ignore
    }

    return results;
}

export async function createDir(dir: string): Promise<void> {
    await mkdir(path.dirname(dir), { recursive: true });
}

export async function remove(path: string): Promise<void> {
    await rm(path);
}

export async function writeContent(path: string, content: string): Promise<void> {
    await writeFile(path, content, "utf8");
}

export async function readContent(path: string): Promise<string> {
    return await readFile(path, "utf8");
}

export function exists(path: string): boolean {
    return existsSync(path);
}