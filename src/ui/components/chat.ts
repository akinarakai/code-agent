import type { AgentTokens } from "../../core/agent.js";

export interface ChatLine {
    data: unknown;
}

export interface UserLine {
    type: "user";
    text: string;
}

export interface AgentLine {
    type: "agent";
    text: string;
}

export interface FinishLine {
    type: "finish";
    tokens: AgentTokens
    duration: number;
    finishAt: number;
}

export interface ActionLine {
    type: "action";
    actionType: string;
    ok: boolean;
    content: string[];
    shortContent: string | undefined;
}

export interface ErrorLine {
    type: "error";
    text: string;
    raw?: string;
}

export interface DebugLine {
    text: string;
    date: Date;
}

export type AgentLineResult =
    | UserLine
    | AgentLine
    | FinishLine
    | ActionLine
    | ErrorLine;