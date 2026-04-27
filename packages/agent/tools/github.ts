import { tool } from "ai";
import { z } from "zod";
import { getSandbox, shellEscape } from "./utils";

// หมดเวลาในการดำเนินการคำสั่ง git และ gh
export const TIMEOUT_MS = 60_000;

export const commitAndPrTool = tool({
  description: `Commit all current changes, push to a new branch, and create a Pull Request using the GitHub CLI.

WHEN TO USE:
- When you have completed a task and want to submit your code for review.
- When the user explicitly asks you to commit and create a PR.

USAGE:
- Automatically stages all changes (git add -A)
- Creates a new branch
- Commits the changes
- Pushes the branch to origin
- Uses the 'gh' CLI to create the PR`,
  inputSchema: z.object({
    branchName: z
      .string()
      .describe("The name of the new branch to create and push"),
    commitMessage: z.string().describe("The commit message"),
    prTitle: z.string().describe("The title of the pull request"),
    prBody: z
      .string()
      .optional()
      .describe("The body/description of the pull request"),
  }),
  needsApproval: () => true,
  execute: async (
    { branchName, commitMessage, prTitle, prBody },
    { experimental_context, abortSignal },
  ) => {
    const sandbox = await getSandbox(experimental_context, "commitAndPr");
    const cwd = sandbox.workingDirectory;

    try {
      // 1. Create and checkout new branch
      const branchRes = await sandbox.exec(
        `git checkout -b ${shellEscape(branchName)}`,
        cwd,
        TIMEOUT_MS,
        { signal: abortSignal },
      );

      if (
        !branchRes.success &&
        !branchRes.stderr.includes("already exists") &&
        !branchRes.stderr.includes("already a branch")
      ) {
        return {
          success: false,
          error: `Failed to create branch: ${branchRes.stderr}`,
        };
      }

      // 2. Stage all changes
      await sandbox.exec("git add -A", cwd, TIMEOUT_MS, {
        signal: abortSignal,
      });

      // 3. Commit changes
      const commitRes = await sandbox.exec(
        `git commit -m ${shellEscape(commitMessage)}`,
        cwd,
        TIMEOUT_MS,
        { signal: abortSignal },
      );

      if (
        !commitRes.success &&
        !commitRes.stdout.includes("nothing to commit") &&
        !commitRes.stderr.includes("nothing to commit")
      ) {
        return {
          success: false,
          error: `Failed to commit: ${commitRes.stdout} ${commitRes.stderr}`,
        };
      }

      // 4. Push branch
      const pushRes = await sandbox.exec(
        `git push -u origin ${shellEscape(branchName)}`,
        cwd,
        TIMEOUT_MS,
        { signal: abortSignal },
      );

      if (!pushRes.success) {
        return {
          success: false,
          error: `Failed to push: ${pushRes.stdout} ${pushRes.stderr}`,
        };
      }

      // 5. Create PR via gh cli
      const bodyArg = prBody ? `--body ${shellEscape(prBody)}` : '--body ""';
      const prRes = await sandbox.exec(
        `gh pr create --title ${shellEscape(prTitle)} ${bodyArg}`,
        cwd,
        TIMEOUT_MS,
        { signal: abortSignal },
      );

      if (prRes.success) {
        return {
          success: true,
          message: "Successfully committed, pushed, and created PR.",
          prUrl: prRes.stdout.trim(),
        };
      } else {
        return {
          success: true,
          message: `Successfully committed and pushed to branch ${branchName}. Note: Could not create PR automatically via gh CLI. Please create it manually.`,
          errorDetails: prRes.stderr,
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Error during commit and PR process: ${message}`,
      };
    }
  },
});
