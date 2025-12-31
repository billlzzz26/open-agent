import { tool } from "ai";
import { z } from "zod";
import { spawn } from "child_process";
import * as path from "path";
import type { AgentContext } from "../../types";

function isPathWithinDirectory(filePath: string, directory: string): boolean {
  const resolvedPath = path.resolve(filePath);
  const resolvedDir = path.resolve(directory);
  return resolvedPath.startsWith(resolvedDir + path.sep) || resolvedPath === resolvedDir;
}

const TIMEOUT_MS = 120_000;
const MAX_OUTPUT_LENGTH = 50_000;

interface BashResult {
  success: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  truncated: boolean;
}

async function executeCommand(
  command: string,
  cwd: string,
  timeoutMs: number
): Promise<BashResult> {
  return new Promise((resolve) => {
    const child = spawn("bash", ["-c", command], {
      cwd,
      env: { ...process.env },
      timeout: timeoutMs,
    });

    let stdout = "";
    let stderr = "";
    let truncated = false;

    child.stdout.on("data", (data) => {
      const chunk = data.toString();
      if (stdout.length + chunk.length > MAX_OUTPUT_LENGTH) {
        stdout += chunk.slice(0, MAX_OUTPUT_LENGTH - stdout.length);
        truncated = true;
      } else {
        stdout += chunk;
      }
    });

    child.stderr.on("data", (data) => {
      const chunk = data.toString();
      if (stderr.length + chunk.length > MAX_OUTPUT_LENGTH) {
        stderr += chunk.slice(0, MAX_OUTPUT_LENGTH - stderr.length);
        truncated = true;
      } else {
        stderr += chunk;
      }
    });

    child.on("close", (code) => {
      resolve({
        success: code === 0,
        exitCode: code,
        stdout,
        stderr,
        truncated,
      });
    });

    child.on("error", (error) => {
      resolve({
        success: false,
        exitCode: null,
        stdout,
        stderr: error.message,
        truncated,
      });
    });
  });
}

const bashInputSchema = z.object({
  command: z.string().describe("The bash command to execute"),
  cwd: z
    .string()
    .optional()
    .describe("Working directory for the command (absolute path)"),
});

type BashInput = z.infer<typeof bashInputSchema>;
type ApprovalFn = (args: BashInput) => boolean | Promise<boolean>;

interface ToolOptions {
  needsApproval?: boolean | ApprovalFn;
}

// Read-only commands that are safe to run without approval
const SAFE_COMMAND_PREFIXES = [
  "ls",
  "cat",
  "head",
  "tail",
  "find",
  "grep",
  "rg",
  "git status",
  "git log",
  "git diff",
  "git show",
  "git branch",
  "git remote",
  "pwd",
  "echo",
  "which",
  "type",
  "file",
  "wc",
  "tree",
];

// Commands that should always require approval
const DANGEROUS_COMMAND_PATTERNS = [
  /\brm\b/,
  /\bmv\b/,
  /\bcp\b/,
  /\bmkdir\b/,
  /\btouch\b/,
  /\bchmod\b/,
  /\bchown\b/,
  /\bsudo\b/,
  /\bgit\s+(push|commit|add|reset|checkout|merge|rebase|stash)/,
  /\bnpm\s+(install|uninstall|publish)/,
  /\bpnpm\s+(install|uninstall|publish)/,
  /\byarn\s+(add|remove|publish)/,
  /\bbun\s+(add|remove|install)/,
  /\bpip\s+install/,
  />/,  // redirects
  /\|/,  // pipes (could be dangerous)
  /&&/,  // command chaining
  /;/,   // command chaining
];

/**
 * Check if a command is safe to run without approval.
 * Returns true if approval is needed, false if safe.
 */
export function commandNeedsApproval(command: string): boolean {
  const trimmedCommand = command.trim();
  
  // Check for dangerous patterns first
  for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
    if (pattern.test(trimmedCommand)) {
      return true;
    }
  }
  
  // Check if it starts with a safe command
  for (const prefix of SAFE_COMMAND_PREFIXES) {
    if (trimmedCommand.startsWith(prefix)) {
      return false;
    }
  }
  
  // Default to requiring approval for unknown commands
  return true;
}

export const bashTool = (options?: ToolOptions) => tool({
  needsApproval: options?.needsApproval ?? true,
  description: `Execute a bash command in the user's shell (non-interactive).

WHEN TO USE:
- Running existing project commands (build, test, lint, typecheck)
- Using read-only CLI tools (git status, git diff, ls, etc.)
- Invoking language/package managers (npm, pnpm, yarn, pip, go, etc.) as part of the task

WHEN NOT TO USE:
- Reading files (use readFileTool instead)
- Editing or creating files (use editFileTool or writeFileTool instead)
- Searching code or text (use grepTool and/or globTool instead)
- Interactive commands (shells, editors, REPLs) or long-lived daemons

USAGE:
- Runs bash -c "<command>" in a non-interactive shell (no TTY/PTY)
- Commands automatically timeout after ~2 minutes
- Combined stdout/stderr output is truncated after ~50,000 characters
- Use cwd to run in a specific directory; otherwise the current working directory is used

DO NOT USE FOR:
- File reading (cat, head, tail) - use readFileTool
- File editing (sed, awk, editors) - use editFileTool / writeFileTool
- File creation (touch, redirections like >, >>) - use writeFileTool
- Code search (grep, rg, ag) - use grepTool

IMPORTANT:
- Never chain commands with ';' or '&&' - use separate tool calls for each logical step
- Never use interactive commands (vim, nano, top, bash, ssh, etc.)
- Never start background processes with '&'
- Always quote file paths that may contain spaces
- The working directory (cwd) must be within the main working directory; paths outside are rejected

EXAMPLES:
- Run the test suite: command: "npm test", cwd: "/Users/username/project"
- Check git status: command: "git status --short"
- List files in src: command: "ls -la", cwd: "/Users/username/project/src"`,
  inputSchema: bashInputSchema,
  execute: async ({ command, cwd }, { experimental_context }) => {
    const context = experimental_context as AgentContext;
    const workingDirectory = context?.workingDirectory ?? process.cwd();

    // Resolve the working directory
    const workingDir = cwd
      ? (path.isAbsolute(cwd) ? cwd : path.resolve(workingDirectory, cwd))
      : workingDirectory;

    // Security check: ensure cwd is within working directory
    if (!isPathWithinDirectory(workingDir, workingDirectory)) {
      return {
        success: false,
        exitCode: null,
        stdout: "",
        stderr: `Access denied: cwd "${workingDir}" is outside the working directory "${workingDirectory}"`,
      };
    }

    const result = await executeCommand(command, workingDir, TIMEOUT_MS);

    return {
      success: result.success,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      ...(result.truncated && { truncated: true }),
    };
  },
});
