---
description: Create a new git worktree with local dev files
argument-hint: <directory> <branch-name>
allowed-tools:
  - Bash
  - Read
  - Write
---

# Create Git Worktree

Create a new git worktree at the specified directory with the given branch name, then copy over files needed for local development that are not checked into git.

## Arguments

The user should provide:
1. `directory` - Path for the new worktree (relative to parent of current repo, or absolute)
2. `branch-name` - Name for the new branch (will be created if it doesn't exist)

## Instructions

1. **Parse the arguments** from the user's input. If arguments are missing, ask the user to provide them.

2. **Determine the worktree path**:
   - If the directory is a relative path, create it relative to the parent directory of the current repository
   - If absolute, use as-is

3. **Create the worktree** using one of these commands:
   - For a new branch: `git worktree add -b <branch-name> <directory>`
   - For an existing branch: `git worktree add <directory> <branch-name>`

   Try creating a new branch first. If the branch already exists, use the existing branch syntax.

4. **Copy local development files** that are gitignored but needed:
   - `.env` - Environment variables (if it exists in the source repo)
   - `.claude/settings.local.json` - Local Claude Code settings (if it exists)

5. **Create the .claude directory** in the new worktree if copying settings.local.json.

6. **Report success** with:
   - The full path to the new worktree
   - Which files were copied
   - A reminder to run `npm install` in the new worktree

## Example Usage

User: `/worktree feature-auth my-feature-branch`

This creates:
- New worktree at `../feature-auth` (sibling to current repo)
- New branch `my-feature-branch`
- Copies `.env` and `.claude/settings.local.json`
