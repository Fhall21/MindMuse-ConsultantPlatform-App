# Agent Working Agreement

Rules for any Claude Code agent or autonomous session working in this repo.

---

## Repository layout

- **`ConsultantPlatform/`** — top-level docs repo. Contains specs, roadmap, personas, and planning documents. Read this for product context; do not commit app code here.
- **`ConsultantPlatform/ConsultantPlatformApp/`** — the main application repo. All code changes go here.

When the user says "the app" or "the repo", they mean `ConsultantPlatformApp`.

---

## Working style

Work is organised into numbered sprints (e.g. Sprint 14). Each sprint has numbered tasks. Tasks are scoped, sequential units of product work — not long-running parallel branches. Complete a task fully, commit it to `main`, then move on.

Within a task:
- Ask clarifying questions before writing code.
- Produce a plan for non-trivial work; use `/plan-eng-review` or `/plan-ceo-review` to pressure-test it.
- Commit as you go — after each meaningful unit of work, not at the end.
- Do not bundle unrelated changes into one commit.
- Do not add features, refactor, or improve beyond what was asked.

---

## Skills in use

These skills are active in every session. Apply them without being asked.

| Skill | When to use |
|---|---|
| `/caveman` | Default communication style — terse, no filler, full technical substance |
| `/impeccable` | Any UI or frontend work — production-grade aesthetics, no AI slop |
| `/gstack` (via `/browse`, `/qa`, `/qa-design-review`) | All web browsing, QA testing, and design review |
| `context-mode` MCP | Save and restore working context at session start and end |

**`/impeccable` always applies to frontend work.** Before touching any component, check `.impeccable.md` for design context. If it does not exist, run `/impeccable teach` to gather it before doing any design work.

**`context-mode` is mandatory.** Restore context at session start before reading files. Save context before ending a session or switching focus areas.

---

## Branch and worktree hygiene

Sprint tasks run as parallel agents, each in its own worktree and branch. This is intentional and correct. The rule is not "no worktrees" — it is **every worktree must be merged to `main` and deleted when the task is done**.

### Parallel sprint tasks (agents)

- Each sprint task agent works on a dedicated branch, e.g. `sprint14/task-07-description`.
- Use `isolation: "worktree"` in Agent tool calls for parallel sprint tasks.
- When the task is complete: merge to `main`, delete the branch, remove the worktree.

```bash
git checkout main
git merge <branch>
git branch -D <branch>
git worktree remove --force <path>
git worktree prune
```

### Direct / interactive work (this session, small fixes, UI tweaks)

- Commit directly to `main`. Do not create a branch.
- If you find yourself on a non-`main` branch for direct work, switch before starting: `git checkout main`.

### The failure mode to avoid

Branches and worktrees accumulate when agents finish but never clean up. A repo with 50 stale branches and 15 open worktrees causes conflicts in every future session. **Never end a task session without merging and deleting its branch.**

**If it's not in `main`, it will be treated as abandoned.**

---

## Committing

- Commit to `main` after each meaningful unit of work.
- Commit only the files changed by that unit. No unrelated batching.
- Always confirm `git branch` shows `main` before committing.
- Use clear commit messages: type(scope): description.

---

## Session start checklist

1. `git branch` — confirm on `main`. If not, `git checkout main`.
2. `git status` — handle any uncommitted changes from a prior session.
3. `git worktree list` — remove stale worktrees under `.claude/worktrees/` with `git worktree remove --force <path> && git worktree prune`.
4. Restore context via context-mode MCP before reading any files.

---

## Session end checklist

1. All changes committed to `main`.
2. No stale branches — delete any branch created this session.
3. No stale worktrees — run `git worktree prune`.
4. Save context via context-mode MCP.
