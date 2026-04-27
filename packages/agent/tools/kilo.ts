import { tool } from "ai";
import { z } from "zod";
import { KiloClient } from "../kilo/client";

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
