<<<<<<< HEAD
import { tool } from "ai";
import { z } from "zod";
import { KiloClient } from "../providers/kilo/client";

const kiloInputSchema = z.object({
  action: z.enum(["list_models", "list_providers", "chat_completions", "fim_completions"]),
  model: z.string().optional().describe("Model ID (e.g., 'anthropic/claude-sonnet-4.5'). Required for completions."),
  messages: z.array(z.any()).optional().describe("Array of conversation messages. Required for chat_completions."),
  prompt: z.string().optional().describe("Code before the cursor. Required for fim_completions."),
  suffix: z.string().optional().describe("Code after the cursor. Optional for fim_completions."),
  max_tokens: z.number().optional(),
  temperature: z.number().optional(),
});

export const kiloTool = tool({
  description: `Interact with the Kilo AI Gateway.
Supports:
- list_models: Retrieve the list of available models.
- list_providers: Retrieve the list of available providers.
- chat_completions: Create a chat completion using any supported model.
- fim_completions: Fill-in-the-middle completions for code generation (Mistral models only).`,
  inputSchema: kiloInputSchema,
  execute: async (input) => {
    try {
      const client = new KiloClient();
      switch (input.action) {
        case "list_models":
          return await client.listModels();
        case "list_providers":
          return await client.listProviders();
        case "chat_completions":
          if (!input.model || !input.messages) {
            return { error: "model and messages are required for chat_completions" };
          }
          return await client.chatCompletions({
            model: input.model,
            messages: input.messages,
            max_tokens: input.max_tokens,
            temperature: input.temperature,
          });
        case "fim_completions":
          if (!input.model || !input.prompt) {
            return { error: "model and prompt are required for fim_completions" };
          }
          return await client.fimCompletions({
            model: input.model,
            prompt: input.prompt,
            suffix: input.suffix,
            max_tokens: input.max_tokens,
            temperature: input.temperature,
          });
        default:
          return { error: "Unknown action" };
      }
    } catch (error: any) {
      return { error: error.message || String(error) };
    }
  },
});
=======
import fetch from "node-fetch";

class Context7Client {
  private url: string = "https://mcp.context7.com/mcp";
  private headers: Record<string, string>;
  private id: number = 1;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.CONTEXT7_API_KEY;
    if (!key) {
      throw new Error(
        "Context7 API key is required. Provide it as parameter or set CONTEXT7_API_KEY environment variable.",
      );
    }
    this.headers = {
      CONTEXT7_API_KEY: key,
      "Content-Type": "application/json",
    };
  }

  async call(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<unknown> {
    const payload = {
      jsonrpc: "2.0",
      method,
      id: this.id,
      params,
    };
    this.id++;

    const response = await fetch(this.url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Context7 API call failed with status ${response.status}: ${errorText}`,
      );
    }

    return await response.json();
  }
}

// Usage example
// const client = new Context7Client(); // uses env var
// const client = new Context7Client('your_api_key_here'); // explicit key
// client.call('tools/list').then(result => console.log(result));

export { Context7Client };
>>>>>>> origin/main
