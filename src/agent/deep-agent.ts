import {
  ToolLoopAgent,
  gateway,
  stepCountIs,
  wrapLanguageModel,
  type TypedToolResult,
  type InferUITools,
} from "ai";
import { z } from "zod";
import {
  todoWriteTool,
  readFileTool,
  writeFileTool,
  editFileTool,
  grepTool,
  globTool,
  bashTool,
  taskTool,
  memorySaveTool,
  memoryRecallTool,
} from "./tools";
import { buildSystemPrompt } from "./system-prompt";
import { formatTodosForContext, formatScratchpadForContext } from "./state";
import type { TodoItem, ScratchpadEntry } from "./types";
import { todoItemSchema } from "./types";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import { addCacheControl, compactContext } from "./utils";
import { anthropic } from "@ai-sdk/anthropic";

const callOptionsSchema = z.object({
  workingDirectory: z.string(),
  customInstructions: z.string().optional(),
  todos: z.array(todoItemSchema).optional(),
  scratchpad: z
    .map(
      z.string(),
      z.object({
        path: z.string(),
        content: z.string(),
        createdAt: z.number(),
        updatedAt: z.number(),
        size: z.number(),
      }),
    )
    .optional(),
});

export type DeepAgentCallOptions = z.infer<typeof callOptionsSchema>;

const model = gateway("anthropic/claude-haiku-4.5");
// const model = anthropic("claude-haiku-4-5");

export const deepAgentModelId = model.modelId;

export const deepAgent = new ToolLoopAgent({
  model: wrapLanguageModel({
    middleware: devToolsMiddleware(),
    model,
  }),
  // model, // non dev-tools model
  instructions: buildSystemPrompt({}),
  tools: addCacheControl({
    tools: {
      todo_write: todoWriteTool,
      read: readFileTool,
      write: writeFileTool({ needsApproval: true }),
      edit: editFileTool({ needsApproval: true }),
      grep: grepTool,
      glob: globTool,
      bash: bashTool({ needsApproval: true }),
      task: taskTool,
      // memory_save: memorySaveTool,
      // memory_recall: memoryRecallTool,
    },
    model,
  }),
  stopWhen: stepCountIs(50),
  callOptionsSchema,
  prepareStep: ({ messages, model, steps }) => ({
    messages: addCacheControl({
      messages: compactContext({ messages, steps }),
      model,
    }),
  }),
  prepareCall: ({ options, model, ...settings }) => {
    const workingDirectory = options?.workingDirectory ?? process.cwd();
    const customInstructions = options?.customInstructions;
    const todos = options?.todos ?? [];
    const scratchpad =
      options?.scratchpad ?? new Map<string, ScratchpadEntry>();

    const todosContext = formatTodosForContext(todos);
    const scratchpadContext = formatScratchpadForContext(scratchpad);

    return {
      ...settings,
      model,
      instructions: buildSystemPrompt({
        cwd: workingDirectory,
        customInstructions,
        todosContext,
        scratchpadContext,
      }),
      experimental_context: { workingDirectory },
    };
  },
});

export function extractTodosFromStep(
  toolResults: Array<TypedToolResult<typeof deepAgent.tools>>,
): TodoItem[] | null {
  for (const result of toolResults) {
    if (!result.dynamic && result.toolName === "todo_write" && result.output) {
      return result.output.todos;
    }
  }
  return null;
}

export type DeepAgent = typeof deepAgent;
