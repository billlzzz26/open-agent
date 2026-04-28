export type ChatCompletionRequest = {
  model: string;
  messages: Message[];
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string | string[];
  frequency_penalty?: number;
  presence_penalty?: number;
  tools?: Tool[];
  tool_choice?: ToolChoice;
  response_format?: ResponseFormat;
  user?: string;
  seed?: number;
};

export type Message =
  | { role: "system"; content: string }
  | { role: "user"; content: string | ContentPart[] }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string };

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: string } };

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: object;
  };
};

export type ToolChoice =
  | "none"
  | "auto"
  | "required"
  | { type: "function"; function: { name: string } };

export type ResponseFormat = {
  type: "text" | "json_object";
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type ChatCompletionResponse = {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: "assistant";
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: "stop" | "length" | "tool_calls" | "content_filter";
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type FIMRequest = {
  model: string;
  prompt: string;
  suffix?: string;
  max_tokens?: number;
  temperature?: number;
  stop?: string[];
  stream?: boolean;
};

export type Model = {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
  name: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
};

export class KiloClient {
  private apiKey: string;
  private baseUrl = "https://api.kilo.ai";

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.KILO_API_KEY || "";
    if (!this.apiKey) {
      throw new Error(
        "Kilo API key is required. Set KILO_API_KEY environment variable.",
      );
    }
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      let errorData: any;
      try {
        errorData = await response.json();
      } catch (e) {
        throw new Error(
          `Kilo API Error ${response.status}: ${response.statusText}`,
        );
      }
      throw new Error(
        `Kilo API Error ${response.status}: ${
          errorData?.error?.message || response.statusText
        }`,
      );
    }

    return response.json() as Promise<T>;
  }

  async chatCompletions(
    body: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    return this.request<ChatCompletionResponse>(
      "/api/gateway/chat/completions",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  }

  async fimCompletions(body: FIMRequest): Promise<any> {
    return this.request<any>("/api/fim/completions", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async listModels(): Promise<{ data: Model[] }> {
    return this.request<{ data: Model[] }>("/api/gateway/models");
  }

  async listProviders(): Promise<any> {
    return this.request<any>("/api/gateway/providers");
  }
}
