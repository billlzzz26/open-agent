#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";

function emitHookOutput(systemMessage = "") {
  process.stdout.write(
    JSON.stringify({
      decision: "allow",
      systemMessage,
    }),
  );
}

async function main() {
  const target = process.argv[2];
  if (typeof target !== "string" || !target.trim()) {
    emitHookOutput("");
    return;
  }

  const resolvedTarget = path.resolve(process.cwd(), target);
  await import(pathToFileURL(resolvedTarget).href);
}

main().catch((err) => {
  console.error("Hook bootstrap error:", err);
  emitHookOutput("");
});
