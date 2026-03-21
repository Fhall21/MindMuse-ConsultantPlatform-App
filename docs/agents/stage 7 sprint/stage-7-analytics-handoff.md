# Stage 7 Analytics Handoff
**Date:** 2026-03-21
**Branch:** `main`
**Status:** In progress, with core analytics implementation committed

## Purpose
This document captures what we finished for Stage 7 analytics, what still needs to be done, what we want to do next, and how we are working in this repo.

## What We Finished

### Data layer
- Built a round analytics read layer in [lib/data/analytics-read.ts](../../../lib/data/analytics-read.ts) that derives round analytics from analytics tables instead of theme-only summaries.
- Added support for processed counts, active and failed job counts, outlier handling, cluster summaries, and extraction confidence aggregation.
- Removed the stray `use server` directive from the analytics read module so it no longer trips Next.js server-action rules during render.

### Backend
- Added analytics backend endpoints under `app/api/client/analytics/**` for consultation reads, job status, round reads, job triggers, and cluster decisions.
- Added analytics server actions in [lib/actions/analytics.ts](../../../lib/actions/analytics.ts).
- Wired audit logging into analytics job triggers and consultant decision writes.
- Kept ownership checks in place so analytics access still follows the existing consultation and round permissions model.

### UI
- Replaced the round analytics placeholder with a real panel in [components/consultations/rounds/analytics-panel.tsx](../../../components/consultations/rounds/analytics-panel.tsx).
- Wired the round detail page to render the new analytics panel in [app/(app)/consultations/rounds/[id]/page.tsx](../../../app/(app)/consultations/rounds/%5Bid%5D/page.tsx).
- Added a hook layer in [hooks/use-analytics.ts](../../../hooks/use-analytics.ts) for polling, triggering analytics, and saving cluster decisions.
- Removed the obsolete placeholder component after the new panel replaced it.

### Runtime fix discovered during debugging
- Fixed a build/runtime crash caused by [lib/openai/client.ts](../../../lib/openai/client.ts) reading `AI_SERVICE_URL` at module load time.
- The URL lookup now happens inside the AI call function, so round pages can render without requiring AI configuration just to open the page.

## What Still Needs To Be Done
- Add UI tests for the analytics panel states:
  - idle
  - queued/running
  - failed with retry
  - complete with cluster browsing and decisions
- Verify the round page in the browser against the live dev server once the browser tooling is available again.
- Decide whether any of the unrelated local edits in the worktree should be committed separately or left for their own task.
- Confirm the round page behaves correctly after a dev server restart, since the runtime fix changes the import graph.

## What We Want To Do Next
- Tighten the analytics panel UX so the state machine is obvious at a glance and the consultant decision flow stays explicit.
- Add regression coverage for the exact failure mode we hit on the round page.
- Keep improving the audit trail around analytics decisions and job lifecycle transitions.
- If the stage 7 analytics flow settles, fold this work into release documentation and changelog notes.

## How We Work
- We ask clarifying questions when scope is ambiguous, but we do not stall once the path is clear.
- We plan before coding when the change spans multiple layers.
- We keep changes small and reviewable, and we avoid mixing unrelated fixes into the same change set.
- We commit our own work as discrete units and leave unrelated edits alone.
- We validate with lint, typecheck, and targeted tests before calling a change done.
- We prefer fixes at the root cause rather than patching symptoms.
- We keep auditability, ownership checks, and explicit human approval as non-negotiable constraints.
- We treat AI outputs as suggestions only; nothing auto-accepts.

## Current State
- Analytics backend is committed.
- Analytics UI replacement is committed.
- The rounds page render crash caused by eager env loading has been fixed.
- Unrelated local edits remain in the worktree and should be handled separately.

## Notes For Future Handoffs
- The most recent runtime issue was not caused by the analytics panel itself.
- It came from an import-time environment lookup in the OpenAI client.
- If the rounds page appears blank again, check the server console first, then the import chain from the round workflow into shared server helpers.
- Keep the docs aligned with the exact state of the worktree; do not assume unfinished local edits are part of the analytics task.
