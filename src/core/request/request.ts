export class ChatMessage {
    role: string;
    content: string;

    constructor(content: string, role: string) {
        this.role = role;
        this.content = content;
    }
}

export interface LlmResponse {
    content: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cachedTokens?: number;
}

export interface LlmModelStrategy {
    createRequest(history: ChatMessage[]): { url: string; request: RequestInit };
    parseResponse(responseJson: any): LlmResponse;
    getModel(): string | null;
}

export class OpenAiCompatibleStrategy implements LlmModelStrategy {
    private baseUrl: string;
    private model: string;
    private apiKey: string;
    private maxTokens: number;

    constructor(baseUrl: string, model: string, apiKey: string, maxTokens: number = 4096) {
        this.baseUrl = baseUrl;
        this.model = model;
        this.apiKey = apiKey;
        this.maxTokens = maxTokens;
    }

    createRequest(history: ChatMessage[]): { url: string; request: RequestInit } {
        return {
            url: this.baseUrl,
            request: {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: history,
                    max_tokens: this.maxTokens,
                }),
            },
        };
    }

    parseResponse(responseJson: any): LlmResponse {
        if (!responseJson?.choices?.[0]?.message?.content) {
            throw new Error(`Unknown answer format from OpenAI. ${JSON.stringify(responseJson, null, 2)}`);
        }

        return {
            content: responseJson.choices[0].message.content,
            promptTokens: responseJson.usage?.prompt_tokens,
            completionTokens: responseJson.usage?.completion_tokens,
            totalTokens: responseJson.usage?.total_tokens,
            cachedTokens: responseJson.usage?.prompt_tokens_details?.cached_tokens
        };
    }

    getModel(): string | null {
        return this.model;
    }
}

export class OllamaStrategy implements LlmModelStrategy {
    private baseUrl: string;
    private model: string;
    private apiKey: string | null;

    constructor(baseUrl: string, model: string, apiKey: string | null = null) {
        this.baseUrl = baseUrl;
        this.model = model;
        this.apiKey = apiKey;
    }

    createRequest(history: ChatMessage[]): { url: string; request: RequestInit } {


        return {
            url: this.baseUrl,
            request: {
                method: "POST",
                headers: this.apiKey != null ?
                    { "Content-Type": "application/json", "Authorization": `Bearer ${this.apiKey}` } :
                    { "Content-Type": "application/json", },
                body: JSON.stringify({
                    model: this.model,
                    messages: history,
                    stream: false,
                }),
            },
        };
    }

    parseResponse(responseJson: any): LlmResponse {
        if (!responseJson?.message?.content) {
            throw new Error(`Unknown answer format from Ollama. ${JSON.stringify(responseJson, null, 2)}`);
        }

        const promptTokens = responseJson.prompt_eval_count;
        const completionTokens = responseJson.eval_count;

        return {
            content: responseJson.message.content,
            promptTokens: promptTokens,
            completionTokens: completionTokens,
            totalTokens:
                promptTokens != null && completionTokens != null
                    ? promptTokens + completionTokens
                    : undefined,
        };
    }

    getModel(): string | null {
        return this.model;
    }
}

export class RequestManager {
    public strategy: LlmModelStrategy;

    private controller: AbortController | null = null;

    constructor(strategy: LlmModelStrategy) {
        this.strategy = strategy;
    }

    async send(history: ChatMessage[]): Promise<LlmResponse> {
        this.controller = new AbortController();

        try {
            const { url, request } = this.strategy.createRequest(history);

            const response = await fetch(url, {
                ...request,
                signal: this.controller.signal,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`(${response.status}). ${errorText}`);
            }

            const data = await response.json();
            return this.strategy.parseResponse(data);
        }
        finally {
            this.controller = null;
        }
    }

    stop() {
        this.controller?.abort();
    }
}