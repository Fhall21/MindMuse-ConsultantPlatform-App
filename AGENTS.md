# Agent Working Agreement

Rules for any Claude Code agent or autonomous session working in this repo.

---

## Branch and worktree hygiene

**Work on `main` directly.** This is a solo-developer repo. There is no PR review process. Branching adds overhead and causes merge conflicts when sessions accumulate.

- Do NOT create feature branches for UI fixes, bug fixes, or iterative work.
- Do NOT use `isolation: "worktree"` in Agent tool calls unless the task is explicitly a long-running parallel workstream that must not touch the working tree.
- If you find yourself on a non-`main` branch at the start of a session, switch to main before doing anything: `git checkout main`.

**If a branch or worktree was created, clean it up before ending the session:**
```bash
git checkout main
git merge <branch>          # if work is worth keeping
git branch -D <branch>      # delete it regardless
git worktree prune           # clean up any dangling worktree refs
```

**Never leave a branch with unmerged commits behind.** If it's not in `main`, it will be lost — the user does not review or merge branches manually.

---

## Committing

- Commit to `main` after each meaningful unit of work.
- Commit only the files relevant to that unit. Do not batch unrelated changes.
- Always verify `git branch` shows `main` before committing.

---

## Session start checklist

1. `git branch` — confirm you are on `main`. If not, `git checkout main`.
2. `git status` — check for uncommitted changes from a prior session; commit or stash before starting new work.
3. `git worktree list` — if stale worktrees exist (anything under `.claude/worktrees/`), remove them with `git worktree remove --force <path>` and `git worktree prune`.
4. Restore context via the context-mode MCP server before reading files.

---

## Session end checklist

1. All changes committed to `main`.
2. No stale branches left — delete any branch created this session.
3. No stale worktrees — run `git worktree prune`.
4. Save context via the context-mode MCP server.
