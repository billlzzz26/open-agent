#!/bin/bash
set -euo pipefail

echo "🧹 Starting workspace cleanup to free up disk space..."

# Go to project root (assuming script is in scripts/)
cd "$(dirname "$0")/.." || { echo "❌ Failed to cd to repo root"; exit 1; }

# Refuse to run outside a git checkout to avoid accidental wipes.
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "❌ Not inside a git working tree; aborting."
  exit 1
fi

echo "🗑️  Removing all node_modules directories..."
# find and remove all node_modules safely
find . -name "node_modules" -type d -prune -exec rm -rf '{}' +

echo "🗑️  Cleaning Bun cache (~/.bun/install/cache)..."
if [ -d "$HOME/.bun/install/cache" ]; then
  rm -rf "$HOME/.bun/install/cache"/*
fi

echo "🗑️  Cleaning npm cache..."
npm cache clean --force 2>/dev/null

echo "🗑️  Cleaning temporary turbo and Next.js build caches..."
find . -name ".turbo" -type d -prune -exec rm -rf '{}' +
find . -name ".next" -type d -prune -exec rm -rf '{}' +

echo "✅ Cleanup complete! Disk space has been reclaimed."
echo "💡 Remember to run 'bun install' when you come back to start coding again."
