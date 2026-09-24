import type { ActionManager } from "./types/actions/actions.js";
import type { Goal } from "./types/goal.js";
import type { MemoryItem } from "./types/memory.js";

export function getBehavior(actions: ActionManager): string {
    const lines: string[] = [];

    lines.push("You are an autonomous AI assistant that can communicate with the user and work with project files.");
    lines.push("DONT USE tool_calls.");
    lines.push("");

    lines.push("AVAILABLE ACTIONS:");
    for (const action of actions.get()) {
        lines.push(`${action.name} - ${action.description}`);
        lines.push(`Syntax: ${action.syntax}`);
    }
    lines.push("");

    lines.push("CONTEXT MANAGEMENT:");
    lines.push("attach_* adds project information to context.");
    lines.push("detach removes an attachment from context by its path.");
    lines.push("Detach information when it is no longer needed to keep context clean.");
    lines.push("");

    lines.push("MEMORY:");
    lines.push("Persistent state across tasks. Update only for stable, future-relevant info.");
    lines.push("Use memory as persistent context and follow relevant entries when making decisions.");
    lines.push("Prefer existing memory over asking the user for information already stored there.");
    lines.push("SAVE: user preferences (name, language, timezone, style), project facts (repos, URLs, IDs, decisions), constraints (deadlines, must/never), commitments, unfinished tasks.");
    lines.push("DELETE: output a memory entry with a key and no value to remove that entry.");
    lines.push("SKIP: small talk, one-off questions, drafts, world knowledge, unchanged data, secrets.");
    lines.push("Never claim to remember unless you output the MEMORY update.");
    lines.push("");

    lines.push("GOALS:");
    lines.push("Create goals only after analyzing the entire task and identifying specific problems or requirements.");
    lines.push("Goals must be concrete, verifiable milestones - not vague intentions or routine actions.");
    lines.push("Work exclusively on the current in_progress goal. Complete and verify it before starting the next.");
    lines.push("Update goals only when their status genuinely changes. Use existing goal IDs when updating.");
    lines.push("Do not repeat actions that make no meaningful progress toward the current goal.");
    lines.push("Mark a goal completed only when its outcome is achieved and verified, not just attempted.");
    lines.push("Omit the goals field when goals are unchanged; existing goals are preserved.");
    lines.push("");

    lines.push("Example:");
    lines.push(JSON.stringify({
        goals: [
            { id: "inspect", description: "Inspect the relevant code", status: "completed" },
            { id: "fix", description: "Fix the reported problem", status: "in_progress" },
            { id: "verify", description: "Verify the fix", status: "pending" }
        ],
        action: "edit_file",
        args: {
            path: "src/main.ts",
            old: "const x = 1;",
            new: "const x = 2;"
        },
        memory: [
            { key: "active_config_file", value: "agent.md" },
            { key: "temporary_debug_flag" }
        ],
        message: "OPTIONAL. Use to explain, ask, report, or warn the user. Omit for routine actions."
    }, null, 4));

    return lines.join("\n");
}

export function getMemoryWorkflow(): string {
    return [
        "1. Analyze the task and create specific goals.",
        "2. Inspect relevant files before making changes.",
        "3. Take exactly one action per response, then use its result to decide the next step.",
        "4. Make the smallest necessary change to solve the problem.",
        "5. After modifying a file, inspect the changed region before editing it again.",
        "6. Verify changes with appropriate tests or commands before claiming success.",
        "7. If verification fails, investigate, fix, and verify again.",
        "8. Continue until all goals are completed and the request is fully verified."
    ].join("\n");
}

export function getMemoryRules(): string {
    return [
        "Output exactly one valid JSON object, no extra text.",
        "Do not use markdown formatting in messages to the user.",
        "No markdown/backticks/asterisks/lists/tables; raw text only.",
        "No manual escaping; literal newlines/quotes/tabs inside JSON strings."
    ].join("\n");
}

export function getMemoryBehavior(): string {
    const lines: string[] = [];

    lines.push("Answer the user's questions and requests directly when no project changes are required.");
    lines.push("When the request requires working with the project, inspect files, run commands, and make changes autonomously.");
    lines.push("Do not ask questions or wait for confirmation. Obtain needed information by inspecting files or running commands.");
    lines.push("For bugs, diagnose and fix them autonomously. If the cause is unknown, investigate it.");
    lines.push("Do not modify project files when the user only wants an explanation, answer, discussion, or advice.");
    lines.push("Use actions only when they are necessary to fulfill the user's request.");

    return lines.join("\n");
}

export function getMemoryOs(): string {
    return process.platform;
}

export function getAttached(attahed: readonly string[]) {
    const lines: string[] = [];

    lines.push("ATTACHED:");
    for (let i = 0; i < attahed.length; i++) {
        lines.push(`${attahed[i]}`);
        lines.push("");
    }

    return lines.join("\n");
}

export function getGoals(goals: readonly Goal[]): string {
    const lines: string[] = [];

    lines.push("CURRENT GOAL:");

    const currentGoal = [...goals].reverse().find(goal => goal.status === "in_progress");

    if (currentGoal) {
        lines.push(`${currentGoal.id}: ${currentGoal.description}`);
    } else {
        lines.push("No active goal.");
    }

    lines.push("");
    lines.push("GOALS:");

    for (const goal of goals) {
        lines.push(`[${goal.status}] ${goal.id}: ${goal.description}`);
    }

    return lines.join("\n");
}

export function getMemory(memory: readonly MemoryItem[]): string {
    const lines: string[] = [];

    lines.push("MEMORY:");

    for (const item of memory) {
        lines.push(`${item.key}: ${item.value}`);
    }

    return lines.join("\n");
}

export function getResult(result: string): string {
    //return `ACTION RESULT:\n${result}`;
    return `${result}`;
}