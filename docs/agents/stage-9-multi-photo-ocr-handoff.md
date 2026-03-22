# Stage 9 — Multi-Photo OCR Handoff

**Branch:** `feat/stage9-multi-photo-ocr`
**Worktree:** `ConsultantPlatformApp/.claude/worktrees/stage9-multi-photo-ocr`
**Date:** 2026-03-22
**Status:** Implementation complete; pending merge to main

---

## Executive Summary

Users can now upload **multiple handwritten note photos** in one session, **reorder the pages** before processing (so page 2 does not paste before page 1), and review per-page extracted text with per-page corrections. A read-only **combined transcript** is assembled from all pages in order.

The AI sidecar's single-image contract is unchanged. Orchestration happens in the Next.js app layer.

---

## What Changed

### Database (migration `0011_gifted_mister_fear.sql`)
- `ocr_jobs.batch_id UUID` — nullable; groups all pages in one upload session.
- `ocr_jobs.image_sequence INTEGER` — nullable; 0-based page order within a batch.
- `idx_ocr_jobs_batch_sequence` index on `(batch_id, image_sequence)`.
- Existing single-photo rows are unaffected (both columns remain NULL).

### Server Actions (`lib/actions/ingestion.ts`)
| Function | Change |
|---|---|
| `createOcrJob` | Extended: accepts optional `batchId` / `imageSequence` params |
| `createOcrBatch` | **New** — takes `{meetingId, imageFileKeys[]}`, inserts all pages atomically with a shared UUID batchId, emits `OCR_BATCH_CREATED` audit event, returns `{batchId, jobIds}` |
| `getOcrJobsForBatch` | **New** — returns all jobs for a batch ordered by `imageSequence` |
| `getOcrJobsForMeeting` | Updated — now routes through `sortOcrJobsBatchAware()` which groups pages within a batch (ASC by imageSequence) and orders batches/standalone jobs newest-first |
| `mapOcrRow` | Extended to map `batch_id` and `image_sequence` |

### Types (`types/database.ts`)
- `OcrJob` extended with `batch_id: string | null` and `image_sequence: number | null`.

### Audit (`lib/actions/audit-actions.ts` + `components/audit/audit-trail.tsx`)
- New constant: `OCR_BATCH_CREATED = "ocr.batch_created"`.
- Audit trail label: `"Multi-page OCR batch started"`.

### UI (`components/consultations/ocr-review-panel.tsx`) — full rewrite
**Staged upload phase:**
- `<input type="file" multiple>` — user picks N files at once (or incrementally via "+ Add more").
- Staged list shows filename, size, and ↑/↓/✕ controls for reordering and removal before any DB write.

**Batch extraction:**
- "Extract text from N pages" calls `createOcrBatch` → then processes each page sequentially via `/api/ocr/extract`, updating job status as it goes.
- Per-page progress badge: Queued → Processing… → Done / Failed.

**Review phase:**
- Each completed page renders its own editable textarea + "Save corrections" button.
- Corrections are saved per-job via `saveOcrCorrections` (unchanged).
- Multi-page batches get a read-only **Combined transcript** view below the per-page cards, concatenated with `— Page N —` dividers.

**Backwards compatibility:**
- `ocrJobId` prop: still accepted; used as fallback if no active batch.
- Single-photo jobs (no `batch_id`): displayed as before in the per-page review section.
- If the user navigates away and returns, the panel falls back to the most recent batch/job from the DB query.

---

## Data Flow

```
User selects files
       ↓
Staged file list (client-only, no DB)
       ↓ reorder as needed
"Extract text" clicked
       ↓
createOcrBatch() → N ocr_jobs rows (status=queued) + OCR_BATCH_CREATED audit event
       ↓ for each page in imageSequence order:
  updateOcrJob(processing)
  POST /api/ocr/extract  ← AI sidecar unchanged
  updateOcrJob(completed | failed)
  OCR_UPLOADED + OCR_EXTRACTION_REQUESTED audit events (via createOcrJob path)
       ↓
invalidateQueries → useMeetingOcrJobs refetches
       ↓
Per-page review / saveOcrCorrections
```

---

## Files Modified

| File | Change |
|---|---|
| `db/schema/domain.ts` | `ocrJobs` table: `batchId`, `imageSequence`, composite index |
| `drizzle/0011_gifted_mister_fear.sql` | Generated migration |
| `drizzle/meta/0011_snapshot.json` | Generated snapshot |
| `drizzle/meta/_journal.json` | Journal entry for migration 0011 |
| `lib/actions/ingestion.ts` | `createOcrBatch`, `getOcrJobsForBatch`, `sortOcrJobsBatchAware`, extended `createOcrJob` + `mapOcrRow` + `getOcrJobsForMeeting` |
| `lib/actions/audit-actions.ts` | `OCR_BATCH_CREATED` constant |
| `types/database.ts` | `OcrJob.batch_id`, `OcrJob.image_sequence` |
| `components/consultations/ocr-review-panel.tsx` | Full rewrite — multi-photo staged upload, reorder, batch progress, per-page review |
| `components/audit/audit-trail.tsx` | Label for `ocr.batch_created` |

---

## Verification Checklist

- [ ] `bun run db:migrate` applies `0011_gifted_mister_fear.sql` cleanly.
- [ ] Selecting multiple photos shows the staged list with correct filenames and sizes.
- [ ] ↑/↓ moves a page; the numbered order updates immediately.
- [ ] ✕ removes a page from the staged list.
- [ ] "Extract text from N pages" runs sequentially — each badge transitions Queued → Processing → Done.
- [ ] After extraction, each page's text appears in its own card.
- [ ] Editing a page's text and clicking "Save corrections" persists the change via `saveOcrCorrections`.
- [ ] Multi-page batches show the "Combined transcript" read-only pane below individual pages.
- [ ] The audit trail shows `OCR_BATCH_CREATED` (`"Multi-page OCR batch started"`) for the batch event.
- [ ] A single-photo upload (one file selected) still works end-to-end.
- [ ] Navigating away and back shows the previous batch's results from the DB.
- [ ] Existing single-photo OCR jobs (no `batch_id`) still display correctly in the review panel.
- [ ] `bunx tsc --noEmit --incremental false` exits 0 from the worktree.

---

## Merge Instructions

```bash
# From ConsultantPlatformApp/
git merge feat/stage9-multi-photo-ocr

# After merging, apply the migration:
bun run db:migrate

# Remove the worktree:
git worktree remove .claude/worktrees/stage9-multi-photo-ocr
git branch -d feat/stage9-multi-photo-ocr
```

---

## Known Limitations / Follow-up

- **Drag-and-drop reordering**: The ↑/↓ buttons are functional but not as smooth as drag handles. A future pass could add `@dnd-kit/sortable` for a drag-to-reorder UX.
- **Combined transcript editing**: The combined view is read-only. Editing must be done per-page. If a single editable combined field is needed, it would require a different storage model (a dedicated "batch summary" job or a separate field).
- **Parallel extraction**: Pages are processed sequentially to keep the AI sidecar simple and avoid race conditions. Parallel extraction per batch could be added if throughput becomes a bottleneck.
- **Retry on failure**: Failed pages show an error badge but there is no per-page retry button yet.
