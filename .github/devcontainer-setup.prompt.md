---
name: devcontainer-setup
description: Set up a fully working development environment as code for the current repository using devcontainer and VS Code automation files.
---

You are tasked with configuring a complete development environment for the current repository.

Steps:

1. Analyze the repository structure and determine the appropriate development environment requirements.
2. Create a `devcontainer.json` file for the repository root.
3. Create an `automations.yaml` file for any project-level automation workflows or setup tasks.
4. Create VS Code configuration files under `.vscode/`: `settings.json`, `tasks.json`, and `extensions.json`, `launch.json`.
5. Create shell scripts or makefiles for environment setup, lint, format, clean, and dead-code removal.
6. Ensure configuration is consistent with Bun-based tooling, repository package scripts, and any existing project conventions.
7. Create github workflow files under `.github/workflows/` for CI/CD processes relevant to the repository (e.g., build, test, lint).
8. Do not create any additional documentation files.
9. After creating the files, describe how to rebuild the devcontainer and verify the environment.

Output:

- Provide the exact file contents for each created file.
- Provide commands to rebuild the devcontainer and verify the workspace.
- Do not include documentation or explanatory files beyond the requested configuration files.
