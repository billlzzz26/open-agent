import {
  type LanguageModelUsage,
  type ModelMessage,
  tool,
  type UIToolInvocation,
} from "ai";
import { z } from "zod";
import {
  buildSubagentSummaryLines,
  SUBAGENT_REGISTRY,
  SUBAGENT_TYPES,
} from "../subagents/registry";
import { sumLanguageModelUsage } from "../usage";
import { getSandboxContext, getSubagentModel } from "./utils";

const subagentTypeSchema = z.enum(SUBAGENT_TYPES);
const subagentSummaryLines = buildSubagentSummaryLines();

const delegateTaskSchema = z.object({
  subagentType: subagentTypeSchema.describe(
    `Subagent to launch. Available options:\n${subagentSummaryLines}`,
  ),
  task: z.string().describe("Short description of the task (displayed to user)"),
  instructions: z.string().describe(
    `Detailed instructions for the subagent. Include:
- Goal and deliverables
- Step-by-step procedure
- Constraints and patterns to follow
- How to verify the work`,
  ),
});

export const delegateTaskOutputSchema = z.object({
  results: z.array(
    z.object({
      task: z.string(),
      modelId: z.string().optional(),
      toolCallCount: z.number(),
      final: z.custom<ModelMessage[]>().optional(),
      usage: z.custom<LanguageModelUsage>().optional(),
    })
  ),
  totalToolCallCount: z.number().int().nonnegative().optional(),
  startedAt: z.number().int().nonnegative().optional(),
});

export type DelegateTaskToolOutput = z.infer<typeof delegateTaskOutputSchema>;

export const delegateTaskTool = tool({
  needsApproval: false,
  description: `Spawn multiple subagents to work on tasks in isolated contexts simultaneously.
Each subagent gets its own workspace context. Only the final summary is returned.

AVAILABLE SUBAGENTS:
${subagentSummaryLines}

WHEN TO USE delegate_task:
- Parallel independent workstreams (e.g. researching different topics simultaneously)
- Reasoning-heavy subtasks that can be separated and executed concurrently

WHEN NOT TO USE (use existing tools instead):
- Single sequential task -> just use the 'task' tool directly
- Tasks needing your direct interaction or memory -> do it yourself
- Simple, single-file or single-change edits -> do it yourself

HOW TO USE:
- Provide an array of 'tasks'. All run concurrently and results are returned together.
- Choose the appropriate subagentType for each task.
- Be explicit and concrete - subagents cannot ask clarifying questions.`,
  inputSchema: z.object({
    tasks: z.array(delegateTaskSchema).min(1).max(5).describe(
      "Tasks to run in parallel. Each gets its own subagent."
    ),
  }),
  outputSchema: delegateTaskOutputSchema,
  execute: async function* (
    { tasks },
    { experimental_context, abortSignal },
  ) {
    const sandboxContext = getSandboxContext(experimental_context, "delegateTask");
    const model = getSubagentModel(experimental_context, "delegateTask");
    const subagentModelId = typeof model === "string" ? model : model.modelId;
    const startedAt = Date.now();

    // Initialize state
    const taskStates = tasks.map((t) => ({
      task: t.task,
      modelId: subagentModelId,
      toolCallCount: 0,
      usage: undefined as LanguageModelUsage | undefined,
      final: undefined as ModelMessage[] | undefined,
    }));

    yield {
      results: taskStates,
      totalToolCallCount: 0,
      startedAt,
    };

    const runTask = async (taskInput: typeof tasks[0], index: number) => {
      const state = taskStates[index];
      if (!state) return;
      const subagent = SUBAGENT_REGISTRY[taskInput.subagentType].agent;
      const result = await subagent.stream({
        prompt: "Complete this task and provide a summary of what you accomplished.",
        options: {
          task: taskInput.task,
          instructions: taskInput.instructions,
          sandbox: sandboxContext.sandbox,
          model,
        },
        abortSignal,
      });

      for await (const part of result.fullStream) {
        if (part.type === "tool-call") {
          state.toolCallCount += 1;
        } else if (part.type === "finish-step") {
          state.usage = sumLanguageModelUsage(state.usage, part.usage);
        }
      }

      const response = await result.response;
      const finalUsage = state.usage ?? (await result.usage);

      state.final = response.messages;
      state.usage = finalUsage;

      return state;
    };

    // Run all tasks in parallel
    const promises = tasks.map((t, i) => runTask(t, i));
    await Promise.all(promises);

    const totalToolCallCount = taskStates.reduce((acc, t) => acc + t.toolCallCount, 0);

    yield {
      results: taskStates,
      totalToolCallCount,
      startedAt,
    };
  },
  toModelOutput: ({ output: { results } }) => {
    if (!results || results.length === 0) {
      return { type: "text", value: "All tasks completed." };
    }

    const summaries = results.map((result, i) => {
      const messages = result.final;
      let contentValue = "Task completed without detailed summary.";

      if (messages) {
        const lastAssistantMessage = messages.findLast((p) => p.role === "assistant");
        const content = lastAssistantMessage?.content;

        if (content) {
          if (typeof content === "string") {
            contentValue = content;
          } else {
            const lastTextPart = content.findLast((p) => p.type === "text");
            if (lastTextPart) {
              contentValue = lastTextPart.text;
            }
          }
        }
      }

      return `=== Result for Task ${i + 1}: ${result.task} ===\n${contentValue}`;
    });

    return { type: "text", value: summaries.join("\n\n") };
  },
});

export type DelegateTaskToolUIPart = UIToolInvocation<typeof delegateTaskTool>;
