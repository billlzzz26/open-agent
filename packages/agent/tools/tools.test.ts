import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { setTimeout } from "node:timers/promises";
import path from "node:path";
import type { ToolNeedsApprovalFunction } from "./utils";

const sandboxRegistry = new Map<string, Record<string, unknown>>();

mock.module("ai", () => {
  class MockToolLoopAgent {
    constructor(_config: unknown) {}

    stream() {
      throw new Error(
        "MockToolLoopAgent.stream should not be called in this test",
      );
    }
  }

  const gateway = (modelId: string) => ({ modelId });

  return {
    tool: <T extends Record<string, unknown>>(definition: T) => definition,
    gateway,
    stepCountIs: (count: number) => ({ count }),
    ToolLoopAgent: MockToolLoopAgent,
    getToolName: (part: { toolName?: string; type?: string }) => {
      if (part.toolName) {
        return part.toolName;
      }

      if (typeof part.type === "string" && part.type.startsWith("tool-")) {
        return part.type.slice(5);
      }

      return "";
    },
    isToolUIPart: (part: unknown) => {
      if (!part || typeof part !== "object") {
        return false;
      }

      const candidate = part as { type?: unknown };
      return (
        typeof candidate.type === "string" && candidate.type.startsWith("tool-")
      );
    },
  };
});

mock.module("@open-agents/sandbox", () => ({
  connectSandbox: async (state: { sandboxId?: string }) => {
    if (!state.sandboxId) {
      throw new Error("Missing sandboxId in test sandbox state.");
    }

    const sandbox = sandboxRegistry.get(state.sandboxId);
    if (!sandbox) {
      throw new Error(`Unknown test sandbox: ${state.sandboxId}`);
    }

    return sandbox;
  },
  tryConnectVercelSandboxDirect: async () => null,
}));

const { askUserQuestionTool } = await import("./ask-user-question");
const { bashTool, commandNeedsApproval } = await import("./bash");
const { MAX_BODY_LENGTH, webFetchTool } = await import("./fetch");
const { globTool } = await import("./glob");
const { grepTool } = await import("./grep");
const { readFileTool } = await import("./read");
const { skillTool } = await import("./skill");
const { taskTool } = await import("./task");
const { commitAndPrTool, TIMEOUT_MS } = await import("./github");
const { todoWriteTool } = await import("./todo");
const { editFileTool, writeFileTool } = await import("./write");
const { buildSystemPrompt } = await import("../system-prompt");

function createContext(sandbox: Record<string, unknown>) {
  const sandboxId = `sandbox-${sandboxRegistry.size + 1}`;
  sandboxRegistry.set(sandboxId, sandbox);

  return {
    sandbox: {
      state: { type: "vercel" as const, sandboxId },
      workingDirectory:
        typeof sandbox.workingDirectory === "string"
          ? sandbox.workingDirectory
          : "/repo",
    },
    approval: {},
    model: "test-model",
  };
}

function executionOptions(experimental_context?: unknown) {
  return {
    toolCallId: "tool-call-1",
    messages: [],
    experimental_context,
  };
}

async function getNeedsApprovalResult<TArgs>(
  needsApproval: boolean | ToolNeedsApprovalFunction<TArgs> | undefined,
  args: TArgs,
  experimental_context: unknown,
) {
  if (typeof needsApproval === "function") {
    return await Promise.resolve(
      needsApproval(args, executionOptions(experimental_context)),
    );
  }
  return needsApproval ?? false;
}

async function createFsSandbox() {
  const workingDirectory = await mkdtemp(path.join(tmpdir(), "agent-tools-"));

  const sandbox = {
    workingDirectory,
    stat: (filePath: string) => stat(filePath),
    readFile: (filePath: string, encoding: BufferEncoding) =>
      readFile(filePath, { encoding }),
    writeFile: (filePath: string, content: string, encoding: BufferEncoding) =>
      writeFile(filePath, content, { encoding }),
    mkdir: (dirPath: string, options: { recursive: boolean }) =>
      mkdir(dirPath, options),
  };

  return { sandbox, workingDirectory };
}

describe("tools execute behavior", () => {
  test("readFileTool returns numbered lines for offset/limit", async () => {
    const { sandbox, workingDirectory } = await createFsSandbox();
    const filePath = path.join(workingDirectory, "notes.txt");
    await writeFile(filePath, "line-1\nline-2\nline-3", "utf-8");

    const result = await readFileTool().execute?.(
      { filePath, offset: 2, limit: 2 },
      executionOptions(createContext(sandbox)),
    );

    expect(result).toEqual({
      success: true,
      path: "notes.txt",
      totalLines: 3,
      startLine: 2,
      endLine: 3,
      content: "2: line-2\n3: line-3",
    });
  });

  test("readFileTool rejects reading directories", async () => {
    const { sandbox, workingDirectory } = await createFsSandbox();

    const result = await readFileTool().execute?.(
      { filePath: workingDirectory },
      executionOptions(createContext(sandbox)),
    );

    expect(result).toEqual({
      success: false,
      error: "Cannot read a directory. Use glob or ls command instead.",
    });
  });

  test("readFileTool requires approval for dotenv files", async () => {
    const baseContext = {
      sandbox: { workingDirectory: "/repo" },
      model: "test-model",
    };

    const dotenvApproval = await getNeedsApprovalResult(
      readFileTool().needsApproval,
      { filePath: ".env.local" },
      baseContext,
    );
    expect(dotenvApproval).toBe(true);

    const nestedDotenvApproval = await getNeedsApprovalResult(
      readFileTool().needsApproval,
      { filePath: "apps/web/.env.example" },
      baseContext,
    );
    expect(nestedDotenvApproval).toBe(true);

    const regularFileApproval = await getNeedsApprovalResult(
      readFileTool().needsApproval,
      { filePath: "README.md" },
      baseContext,
    );
    expect(regularFileApproval).toBe(false);
  });

  test("writeFileTool creates parent directories and writes content", async () => {
    const { sandbox, workingDirectory } = await createFsSandbox();
    const relativePath = "nested/output.txt";

    const result = await writeFileTool().execute?.(
      { filePath: relativePath, content: "hello" },
      executionOptions(createContext(sandbox)),
    );

    const expectedPath = path.join(workingDirectory, relativePath);
    const written = await readFile(expectedPath, "utf-8");

    expect(written).toBe("hello");
    expect(result).toEqual({
      success: true,
      path: relativePath,
      bytesWritten: 5,
    });
  });

  test("editFileTool rejects ambiguous replacement unless replaceAll is true", async () => {
    const { sandbox, workingDirectory } = await createFsSandbox();
    const filePath = path.join(workingDirectory, "src.txt");
    await writeFile(filePath, "alpha\nalpha\nomega", "utf-8");

    const result = await editFileTool().execute?.(
      { filePath, oldString: "alpha", newString: "beta" },
      executionOptions(createContext(sandbox)),
    );

    expect(result).toEqual({
      success: false,
      error:
        "oldString found 2 times. Use replaceAll=true or provide more context to make it unique.",
    });
  });

  test("editFileTool replaces all matches and reports first start line", async () => {
    const { sandbox, workingDirectory } = await createFsSandbox();
    const filePath = path.join(workingDirectory, "src.txt");
    await writeFile(filePath, "alpha\nalpha\nomega", "utf-8");

    const result = await editFileTool().execute?.(
      { filePath, oldString: "alpha", newString: "beta", replaceAll: true },
      executionOptions(createContext(sandbox)),
    );

    const content = await readFile(filePath, "utf-8");
    expect(content).toBe("beta\nbeta\nomega");
    expect(result).toEqual({
      success: true,
      path: "src.txt",
      replacements: 2,
      startLine: 1,
    });
  });

  test("grepTool parses grep output and truncates long content", async () => {
    let executedCommand = "";
    const sandbox = {
      workingDirectory: "/repo",
      exec: async (command: string) => {
        executedCommand = command;
        return {
          success: true,
          exitCode: 0,
          stdout:
            "/repo/src/a.ts:12:match-a\n/repo/src/b.ts:7:" + "x".repeat(300),
          stderr: "",
        };
      },
    };

    const result = await grepTool().execute?.(
      {
        pattern: "match",
        path: "src",
        glob: "*.ts",
        caseSensitive: false,
      },
      executionOptions(createContext(sandbox)),
    );

    expect(executedCommand).toContain("--include='*.ts'");
    expect(executedCommand).toContain(" -i ");
    expect(result).toMatchObject({
      success: true,
      pattern: "match",
      matchCount: 2,
      filesWithMatches: 2,
    });

    const firstMatch =
      result && typeof result === "object" && "matches" in result
        ? (result.matches as Array<{ file: string; content: string }>)[0]
        : undefined;
    const secondMatch =
      result && typeof result === "object" && "matches" in result
        ? (result.matches as Array<{ file: string; content: string }>)[1]
        : undefined;

    expect(firstMatch?.file).toBe("src/a.ts");
    expect(secondMatch?.content.length).toBe(200);
  });

  test("globTool parses find output into sorted file metadata", async () => {
    let executedCommand = "";
    const sandbox = {
      workingDirectory: "/repo",
      exec: async (command: string) => {
        executedCommand = command;
        return {
          success: true,
          exitCode: 0,
          stdout:
            "1700000000\t12\t/repo/src/a.ts\n1690000000\t20\t/repo/src/b.ts",
          stderr: "",
        };
      },
    };

    const result = await globTool().execute?.(
      { pattern: "src/**/*.ts", path: ".", limit: 2 },
      executionOptions(createContext(sandbox)),
    );

    expect(executedCommand).toContain("head -n 2");
    expect(executedCommand).toContain("-name '*.ts'");
    expect(result).toEqual({
      success: true,
      pattern: "src/**/*.ts",
      baseDir: "src",
      count: 2,
      files: [
        {
          path: "src/a.ts",
          size: 12,
          modifiedAt: "2023-11-14T22:13:20.000Z",
        },
        {
          path: "src/b.ts",
          size: 20,
          modifiedAt: "2023-07-22T04:26:40.000Z",
        },
      ],
    });
  });

  test("bashTool handles detached and non-detached execution", async () => {
    const noDetachSandbox = {
      workingDirectory: "/repo",
      exec: async () => ({
        success: true,
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        truncated: true,
      }),
    };

    const detachedUnsupported = await bashTool().execute?.(
      { command: "npm run dev", detached: true },
      executionOptions(createContext(noDetachSandbox)),
    );

    expect(detachedUnsupported).toEqual({
      success: false,
      exitCode: null,
      stdout: "",
      stderr:
        "Detached mode is not supported in this sandbox environment. Only cloud sandboxes support background processes.",
    });

    const detachedSandbox = {
      ...noDetachSandbox,
      execDetached: async () => ({ commandId: "cmd-1" }),
    };

    const detachedResult = await bashTool().execute?.(
      { command: "npm run dev", detached: true },
      executionOptions(createContext(detachedSandbox)),
    );

    expect(detachedResult).toEqual({
      success: true,
      exitCode: null,
      stdout:
        "Process started in background (command ID: cmd-1). The server is now running.",
      stderr: "",
    });

    const normalResult = await bashTool().execute?.(
      { command: "ls" },
      executionOptions(createContext(noDetachSandbox)),
    );

    expect(normalResult).toEqual({
      success: true,
      exitCode: 0,
      stdout: "ok",
      stderr: "",
      truncated: true,
    });
  });

  test("commandNeedsApproval flags rm -rf and dotenv commands", () => {
    expect(commandNeedsApproval("ls -la")).toBe(false);
    expect(commandNeedsApproval("git status --short")).toBe(false);
    expect(commandNeedsApproval("npm install")).toBe(false);
    expect(commandNeedsApproval("bun install")).toBe(false);
    expect(commandNeedsApproval("custom-command --help")).toBe(false);
    expect(commandNeedsApproval("git reset --hard HEAD~1")).toBe(false);
    expect(commandNeedsApproval("rm -fr tmp")).toBe(false);
    expect(commandNeedsApproval("rm -rf tmp")).toBe(true);
    expect(commandNeedsApproval("cat .env.local")).toBe(true);
    expect(commandNeedsApproval("grep API_KEY apps/web/.env.example")).toBe(
      true,
    );
  });

  test("bashTool needsApproval blocks dangerous and dotenv commands by default", async () => {
    const baseContext = {
      sandbox: { workingDirectory: "/repo" },
      model: "test-model",
    };

    const safeCommand = await getNeedsApprovalResult(
      bashTool().needsApproval,
      { command: "ls -la" },
      {
        ...baseContext,
      },
    );
    expect(safeCommand).toBe(false);

    const dangerousCommand = await getNeedsApprovalResult(
      bashTool().needsApproval,
      { command: "rm -rf tmp" },
      {
        ...baseContext,
      },
    );
    expect(dangerousCommand).toBe(true);

    const dotenvCommand = await getNeedsApprovalResult(
      bashTool().needsApproval,
      { command: "cat .env.local" },
      {
        ...baseContext,
      },
    );
    expect(dotenvCommand).toBe(true);

    const allowedBuildCommand = await getNeedsApprovalResult(
      bashTool().needsApproval,
      { command: "bun run ci" },
      {
        ...baseContext,
      },
    );
    expect(allowedBuildCommand).toBe(false);
  });

  describe("commitAndPrTool", () => {
    let mockSandboxExec: mock.Mock<any, any>;
    let mockSandbox: {
      workingDirectory: string;
      exec: mock.Mock<any, any>;
    };

    beforeEach(() => {
      mockSandboxExec = mock(async (command: string) => {
        if (command.startsWith("git checkout -b")) {
          return { success: true, exitCode: 0, stdout: "", stderr: "" };
        }
        if (command === "git add -A") {
          return { success: true, exitCode: 0, stdout: "", stderr: "" };
        }
        if (command.startsWith("git commit -m")) {
          return { success: true, exitCode: 0, stdout: "", stderr: "" };
        }
        if (command.startsWith("git push -u origin")) {
          return { success: true, exitCode: 0, stdout: "", stderr: "" };
        }
        if (command.startsWith("gh pr create")) {
          return { success: true, exitCode: 0, stdout: "https://github.com/test/repo/pull/1", stderr: "" };
        }
        return { success: false, exitCode: 1, stdout: "", stderr: `Unknown command: ${command}` };
      });

      mockSandbox = {
        workingDirectory: "/repo",
        exec: mockSandboxExec,
      };

      // Mock getSandbox to return our controlled mockSandbox
      mock.module("./utils", () => ({
        ...mock.module.requireActual("./utils"), // Keep other utils functions
        getSandbox: mock(async () => mockSandbox),
      }));
    });

    function createCommitAndPrContext() {
      return {
        sandbox: {
          state: { type: "vercel" as const, sandboxId: "mock-sandbox-id" },
          workingDirectory: mockSandbox.workingDirectory,
        },
        approval: {},
        model: "test-model",
      };
    }

    test("should successfully commit, push, and create a PR", async () => {
      const args = {
        branchName: "feature/test-branch",
        commitMessage: "feat: add new feature",
        prTitle: "feat: Add new feature",
        prBody: "This PR adds a new feature.",
      };

      const result = await commitAndPrTool.execute?.(
        args,
        executionOptions(createCommitAndPrContext()),
      );

      expect(result).toEqual({
        success: true,
        message: "Successfully committed, pushed, and created PR.",
        prUrl: "https://github.com/test/repo/pull/1",
      });

      expect(mockSandboxExec).toHaveBeenCalledTimes(5);
      expect(mockSandboxExec).toHaveBeenCalledWith(
        `git checkout -b 'feature/test-branch'`,
        mockSandbox.workingDirectory,
        TIMEOUT_MS,
        expect.any(Object),
      );
      expect(mockSandboxExec).toHaveBeenCalledWith(
        "git add -A",
        mockSandbox.workingDirectory,
        TIMEOUT_MS,
        expect.any(Object),
      );
      expect(mockSandboxExec).toHaveBeenCalledWith(
        `git commit -m 'feat: add new feature'`,
        mockSandbox.workingDirectory,
        TIMEOUT_MS,
        expect.any(Object),
      );
      expect(mockSandboxExec).toHaveBeenCalledWith(
        `git push -u origin 'feature/test-branch'`,
        mockSandbox.workingDirectory,
        TIMEOUT_MS,
        expect.any(Object),
      );
      expect(mockSandboxExec).toHaveBeenCalledWith(
        `gh pr create --title 'feat: Add new feature' --body 'This PR adds a new feature.'`,
        mockSandbox.workingDirectory,
        TIMEOUT_MS,
        expect.any(Object),
      );
    });

    test("should return error if git commit fails for a non-'nothing to commit' reason", async () => {
      currentMockSandbox.exec.mockImplementation(async (command: string) => {
        if (command.startsWith("git commit -m")) {
          return { success: false, exitCode: 1, stdout: "Commit failed", stderr: "Pre-commit hook failed" };
        }
        return { success: true, exitCode: 0, stdout: "", stderr: "" }; // Other commands succeed
      });

      const args = { branchName: "b", commitMessage: "c", prTitle: "p", prBody: "pb" };
      const result = await commitAndPrTool.execute?.(args, executionOptions(createCommitAndPrContext()));

      expect(result).toEqual({
        success: false,
        error: "Failed to commit: Commit failed Pre-commit hook failed",
      });
    });

    test("should return error if git push fails", async () => {
      currentMockSandbox.exec.mockImplementation(async (command: string) => {
        if (command.startsWith("git push -u origin")) {
          return { success: false, exitCode: 1, stdout: "Push failed", stderr: "Authentication required" };
        }
        return { success: true, exitCode: 0, stdout: "", stderr: "" }; // Other commands succeed
      });

      const args = { branchName: "b", commitMessage: "c", prTitle: "p", prBody: "pb" };
      const result = await commitAndPrTool.execute?.(args, executionOptions(createCommitAndPrContext()));

      expect(result).toEqual({
        success: false,
        error: "Failed to push: Push failed Authentication required",
      });
    });

    test("should report partial success if PR creation fails", async () => {
      currentMockSandbox.exec.mockImplementation(async (command: string) => {
        if (command.startsWith("gh pr create")) {
          return { success: false, exitCode: 1, stdout: "", stderr: "PR creation failed: Missing required fields" };
        }
        return { success: true, exitCode: 0, stdout: "", stderr: "" }; // Other commands succeed
      });

      const args = { branchName: "b", commitMessage: "c", prTitle: "p", prBody: "pb" };
      const result = await commitAndPrTool.execute?.(args, executionOptions(createCommitAndPrContext()));

      expect(result).toEqual({
        success: true,
        message: "Successfully committed and pushed to branch b. Note: Could not create PR automatically via gh CLI. Please create it manually.",
        errorDetails: "PR creation failed: Missing required fields",
      });
    });

    test("needsApproval should always return true", async () => {
      const args = {
        branchName: "feature/test-branch",
        commitMessage: "feat: add new feature",
        prTitle: "feat: Add new feature",
        prBody: "This PR adds a new feature.",
      };

      const approvalResult = await getNeedsApprovalResult(
        commitAndPrTool.needsApproval,
        args,
        createCommitAndPrContext(),
      );

      expect(approvalResult).toBe(true);
    });
  });

  afterEach(() => {
    sandboxRegistry.clear();
  });

  test("webFetchTool treats curl exit 23 as a truncated success", async () => {
    let executedCommand = "";
    const responseBody = "x".repeat(MAX_BODY_LENGTH);

    const sandbox = {
      workingDirectory: "/repo",
      exec: async (command: string) => {
        executedCommand = command;
        return {
          success: false,
          exitCode: 23,
          stdout: `${responseBody}\n200`,
          stderr: "",
          truncated: false,
        };
      },
    };

    const context = createContext(sandbox);

    const result = await webFetchTool.execute?.(
      {
        url: "https://example.com",
        method: "GET",
      },
      executionOptions(context),
    );

    expect(executedCommand).toContain("curl");
    expect(executedCommand).toContain(`head -c ${MAX_BODY_LENGTH}`);
    expect(result).toMatchObject({
      success: true,
      status: 200,
      truncated: true,
    });

    const body =
      result && typeof result === "object" && "body" in result
        ? (result.body as string)
        : "";
    expect(body.length).toBe(MAX_BODY_LENGTH);
  });

  test("askUserQuestionTool formats structured answers", () => {
    const answerOutput = askUserQuestionTool.toModelOutput?.({
      toolCallId: "tool-call-1",
      input: { questions: [] },
      output: {
        answers: {
          "Which package manager?": "bun",
          "Which checks?": ["typecheck", "test"],
        },
      },
    });

    expect(answerOutput).toEqual({
      type: "text",
      value:
        'User has answered your questions: "Which package manager?"="bun", "Which checks?"="typecheck, test". You can now continue with the user\'s answers in mind.',
    });

    const declinedOutput = askUserQuestionTool.toModelOutput?.({
      toolCallId: "tool-call-1",
      input: { questions: [] },
      output: { declined: true },
    });

    expect(declinedOutput).toEqual({
      type: "text",
      value:
        "User declined to answer questions. You should continue without this information or ask in a different way.",
    });
  });

  test("skillTool loads skill content and substitutes arguments", async () => {
    const sandbox = {
      workingDirectory: "/repo",
      readFile: async () =>
        "---\nname: review\ndescription: review code\n---\nRun review with $ARGUMENTS",
    };

    const result = await skillTool.execute?.(
      { skill: "Review", args: "--quick" },
      executionOptions({
        ...createContext(sandbox),
        skills: [
          {
            name: "review",
            description: "Review code changes",
            path: "/repo/.skills/review",
            filename: "SKILL.md",
            options: {},
          },
        ],
      }),
    );

    expect(result).toEqual({
      success: true,
      skillName: "Review",
      skillPath: "/repo/.skills/review",
      content:
        "Skill directory: /repo/.skills/review\n\nRun review with --quick",
    });
  });

  test("skillTool returns helpful errors for missing or disabled skills", async () => {
    const sandbox = {
      workingDirectory: "/repo",
      readFile: async () => "skill-body",
    };

    const missingResult = await skillTool.execute?.(
      { skill: "unknown" },
      executionOptions({ ...createContext(sandbox), skills: [] }),
    );

    expect(missingResult).toEqual({
      success: false,
      error: "Skill 'unknown' not found. Available skills: none",
    });

    const disabledResult = await skillTool.execute?.(
      { skill: "commit" },
      executionOptions({
        ...createContext(sandbox),
        skills: [
          {
            name: "commit",
            description: "Create a commit",
            path: "/repo/.skills/commit",
            filename: "SKILL.md",
            options: { disableModelInvocation: true },
          },
        ],
      }),
    );

    expect(disabledResult).toEqual({
      success: false,
      error:
        "Skill 'commit' cannot be invoked by the model (disable-model-invocation is set)",
    });
  });

  test("taskTool exposes both subagent types without approval gates", async () => {
    const explorerNeedsApproval = await getNeedsApprovalResult(
      taskTool.needsApproval,
      {
        subagentType: "explorer",
        task: "Find usages",
        instructions: "Search for helper usage",
      },
      {
        sandbox: { workingDirectory: "/repo" },
        model: "test-model",
        approval: {},
      },
    );
    expect(explorerNeedsApproval).toBe(false);

    const executorNeedsApproval = await getNeedsApprovalResult(
      taskTool.needsApproval,
      {
        subagentType: "executor",
        task: "Apply changes",
        instructions: "Update files",
      },
      {
        sandbox: { workingDirectory: "/repo" },
        model: "test-model",
        approval: {},
      },
    );
    expect(executorNeedsApproval).toBe(false);
  });

  test("taskTool description lists subagents from the shared registry", () => {
    expect(taskTool.description).toContain(
      "`explorer` - Use for read-only codebase exploration, tracing behavior, and answering questions without changing files",
    );
    expect(taskTool.description).toContain(
      "`executor` - Use for well-scoped implementation work, including edits, scaffolding, refactors, and other file changes",
    );
    expect(taskTool.description).toContain("up to 100 tool steps");
  });

  test("buildSystemPrompt lists subagents from the shared registry", () => {
    const prompt = buildSystemPrompt({});

    expect(prompt).toContain("Available subagents:");
    expect(prompt).toContain(
      "`explorer` - Use for read-only codebase exploration, tracing behavior, and answering questions without changing files",
    );
    expect(prompt).toContain(
      "`executor` - Use for well-scoped implementation work, including edits, scaffolding, refactors, and other file changes",
    );
  });

  test("todoWriteTool returns updated todo list metadata", async () => {
    const todos = [
      { id: "1", content: "Write tests", status: "in_progress" as const },
      { id: "2", content: "Run checks", status: "pending" as const },
    ];

    const result = await todoWriteTool.execute?.({ todos }, executionOptions());

    expect(result).toEqual({
      success: true,
      message: "Updated task list with 2 items",
      todos,
    });
  });
});
    expect(body.length).toBe(MAX_BODY_LENGTH);
  });

  test("askUserQuestionTool formats structured answers", () => {
    const answerOutput = askUserQuestionTool.toModelOutput?.({
      toolCallId: "tool-call-1",
      input: { questions: [] },
      output: {
        answers: {
          "Which package manager?": "bun",
          "Which checks?": ["typecheck", "test"],
        },
      },
    });

    expect(answerOutput).toEqual({
      type: "text",
      value:
        'User has answered your questions: "Which package manager?"="bun", "Which checks?"="typecheck, test". You can now continue with the user\'s answers in mind.',
    });

    const declinedOutput = askUserQuestionTool.toModelOutput?.({
      toolCallId: "tool-call-1",
      input: { questions: [] },
      output: { declined: true },
    });

    expect(declinedOutput).toEqual({
      type: "text",
      value:
        "User declined to answer questions. You should continue without this information or ask in a different way.",
    });
  });

  test("skillTool loads skill content and substitutes arguments", async () => {
    const sandbox = {
      workingDirectory: "/repo",
      readFile: async () =>
        "---\nname: review\ndescription: review code\n---\nRun review with $ARGUMENTS",
    };

    const result = await skillTool.execute?.(
      { skill: "Review", args: "--quick" },
      executionOptions({
        ...createContext(sandbox),
        skills: [
          {
            name: "review",
            description: "Review code changes",
            path: "/repo/.skills/review",
            filename: "SKILL.md",
            options: {},
          },
        ],
      }),
    );

    expect(result).toEqual({
      success: true,
      skillName: "Review",
      skillPath: "/repo/.skills/review",
      content:
        "Skill directory: /repo/.skills/review\n\nRun review with --quick",
    });
  });

  test("skillTool returns helpful errors for missing or disabled skills", async () => {
    const sandbox = {
      workingDirectory: "/repo",
      readFile: async () => "skill-body",
    };

    const missingResult = await skillTool.execute?.(
      { skill: "unknown" },
      executionOptions({ ...createContext(sandbox), skills: [] }),
    );

    expect(missingResult).toEqual({
      success: false,
      error: "Skill 'unknown' not found. Available skills: none",
    });

    const disabledResult = await skillTool.execute?.(
      { skill: "commit" },
      executionOptions({
        ...createContext(sandbox),
        skills: [
          {
            name: "commit",
            description: "Create a commit",
            path: "/repo/.skills/commit",
            filename: "SKILL.md",
            options: { disableModelInvocation: true },
          },
        ],
      }),
    );

    expect(disabledResult).toEqual({
      success: false,
      error:
        "Skill 'commit' cannot be invoked by the model (disable-model-invocation is set)",
    });
  });

  test("taskTool exposes both subagent types without approval gates", async () => {
    const explorerNeedsApproval = await getNeedsApprovalResult(
      taskTool.needsApproval,
      {
        subagentType: "explorer",
        task: "Find usages",
        instructions: "Search for helper usage",
      },
      {
        sandbox: { workingDirectory: "/repo" },
        model: "test-model",
        approval: {},
      },
    );
    expect(explorerNeedsApproval).toBe(false);

    const executorNeedsApproval = await getNeedsApprovalResult(
      taskTool.needsApproval,
      {
        subagentType: "executor",
        task: "Apply changes",
        instructions: "Update files",
      },
      {
        sandbox: { workingDirectory: "/repo" },
        model: "test-model",
        approval: {},
      },
    );
    expect(executorNeedsApproval).toBe(false);
  });

  test("taskTool description lists subagents from the shared registry", () => {
    expect(taskTool.description).toContain(
      "`explorer` - Use for read-only codebase exploration, tracing behavior, and answering questions without changing files",
    );
    expect(taskTool.description).toContain(
      "`executor` - Use for well-scoped implementation work, including edits, scaffolding, refactors, and other file changes",
    );
    expect(taskTool.description).toContain("up to 100 tool steps");
  });

  test("buildSystemPrompt lists subagents from the shared registry", () => {
    const prompt = buildSystemPrompt({});

    expect(prompt).toContain("Available subagents:");
    expect(prompt).toContain(
      "`explorer` - Use for read-only codebase exploration, tracing behavior, and answering questions without changing files",
    );
    expect(prompt).toContain(
      "`executor` - Use for well-scoped implementation work, including edits, scaffolding, refactors, and other file changes",
    );
  });

  test("todoWriteTool returns updated todo list metadata", async () => {
    const todos = [
      { id: "1", content: "Write tests", status: "in_progress" as const },
      { id: "2", content: "Run checks", status: "pending" as const },
    ];

    const result = await todoWriteTool.execute?.({ todos }, executionOptions());

    expect(result).toEqual({
      success: true,
      message: "Updated task list with 2 items",
      todos,
    });
  });
});
