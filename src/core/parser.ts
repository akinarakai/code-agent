import { jsonrepair } from "jsonrepair"
import type { Goal } from "./types/goal.js";
import type { MemoryItem } from "./types/memory.js";
import type { ActionManager, BaseAction } from "./types/actions/actions.js";

export interface LlmParsedResponse {
    raw: string;
    goals: Goal[];
    action: BaseAction | null;
    memory: MemoryItem[];
    message: string | null;
}

export interface ParsedAction {
    action: string;
    args: Record<string, unknown>;
}

interface ParsedResponse {
    goals?: Goal[];
    action: string;
    args?: Record<string, unknown>;
    memory?: MemoryItem[];
    message?: string | null;
}

export class TextParser {
    public static parseLlmResponse(text: string, actionManager: ActionManager): LlmParsedResponse {
        try {
            const cleaned = this.clean(text);

            const repaired = jsonrepair(cleaned);
            const parsed = JSON.parse(repaired) as ParsedResponse;

            return {
                raw: text,
                goals: this.parseGoals(parsed),
                action: this.parseAction(parsed, actionManager),
                memory: this.parseMemory(parsed),
                message: parsed.message ?? null,
            };
        }
        catch (error) {
            return {
                raw: text,
                goals: [],
                action: null,
                memory: [],
                message: null,
            };
        }
    }

    private static parseMemory(parsed: ParsedResponse): MemoryItem[] {
        if (parsed.memory === undefined) {
            return [];
        }

        if (!Array.isArray(parsed.memory)) {
            return [];
        }

        return parsed.memory;
    }

    private static parseGoals(parsed: ParsedResponse): Goal[] {
        if (parsed.goals === undefined) {
            return [];
        }

        if (!Array.isArray(parsed.goals)) {
            return [];
        }

        return parsed.goals.filter(goal =>
            typeof goal === "object" &&
            goal !== null &&
            typeof goal.id === "string" &&
            typeof goal.description === "string" &&
            (
                goal.status === "pending" ||
                goal.status === "in_progress" ||
                goal.status === "completed"
            )
        );
    }

    private static parseAction(parsed: ParsedResponse, actionManager: ActionManager): BaseAction | null {
        if (typeof parsed.action !== "string") {
            return null;
        }

        const type = actionManager.get().find(a => a.name === parsed.action);
        if (!type) {
            return null;
        }

        return type.create({
            action: parsed.action,
            args: (typeof parsed.args === "object" && parsed.args !== null)
                ? parsed.args
                : {}
        });
    }

    private static clean(text: string): string {
        let result = text
            .replace(/^\uFEFF/, "")
            .trim();

        result = result.replace(/^```[a-zA-Z]*\s*/, "")
            .replace(/\s*```$/, "");

        result = result.replace(/^```json\s*/i, "")
            .replace(/^```\s*/, "");

        return result.trim();
    }

    public static cleanInvisibleChars(str: string): string {
        return str
            .replace(/[\u200B-\u200D\uFEFF\u202F\u00A0]/g, " ")
            .replace(/\u2011/g, "-")
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .trim();
    }
}