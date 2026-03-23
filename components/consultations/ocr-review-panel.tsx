"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useMeetingOcrJobs } from "@/hooks/use-ingestion";
import { saveOcrCorrections } from "@/lib/actions/ocr";
import { createOcrBatch, updateOcrJob } from "@/lib/actions/ingestion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface OcrReviewPanelProps {
  meetingId?: string;
  consultationId?: string;
  /** Legacy: pin to a specific job ID. Ignored when an active batch is in progress. */
  ocrJobId?: string;
}

interface StagedFile {
  id: string;
  file: File;
}

type PageStatus = "queued" | "processing" | "completed" | "failed";

interface PageProgress {
  status: PageStatus;
  error?: string;
}

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
const HEIC_TYPES = ["image/heic", "image/heif"];
const ACCEPTED_EXTENSIONS = ".jpg, .jpeg, .png, .gif, .webp, .heic, .heif";

function LoadingSpinner() {
  return <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

function formatConfidence(score: number | null): string {
  if (score === null) return "";
  return `${Math.round(score * 100)}% confidence`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString();
}

async function loadHeic2Any() {
  if (typeof window === "undefined") {
    throw new Error("HEIC conversion is only available in the browser.");
  }
  const heicModule = await import("heic2any");
  return heicModule.default;
}

async function prepareImageBlob(file: File): Promise<{ blob: Blob; name: string }> {
  const isHeic = HEIC_TYPES.includes(file.type) || /\.(heic|heif)$/i.test(file.name);
  if (!isHeic) return { blob: file, name: file.name };
  const heic2any = await loadHeic2Any();
  const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  return { blob, name: file.name.replace(/\.(heic|heif)$/i, ".jpg") };
}

function PageStatusBadge({ status }: { status: PageStatus }) {
  const styles: Record<PageStatus, string> = {
    queued: "bg-muted text-muted-foreground",
    processing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };
  const labels: Record<PageStatus, string> = {
    queued: "Queued",
    processing: "Processing…",
    completed: "Done",
    failed: "Failed",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status === "processing" && <LoadingSpinner />}
      {labels[status]}
    </span>
  );
}

export function OcrReviewPanel({ meetingId, consultationId, ocrJobId }: OcrReviewPanelProps) {
  const resolvedMeetingId = meetingId ?? consultationId;
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const storedBlobs = useRef<Map<string, { blob: Blob; name: string }>>(new Map());
  const { data: ocrJobs, isPending } = useMeetingOcrJobs(resolvedMeetingId ?? "");

  const [guideOpen, setGuideOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Staged files (before processing)
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);

  // Active batch tracking (for the current session)
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [batchJobIds, setBatchJobIds] = useState<string[]>([]);
  const [pageProgress, setPageProgress] = useState<Record<string, PageProgress>>({});

  // Per-page correction state
  const [editedTexts, setEditedTexts] = useState<Record<string, string>>({});
  const [dirtyPages, setDirtyPages] = useState<Set<string>>(new Set());
  const [savingPages, setSavingPages] = useState<Set<string>>(new Set());
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  // ── Derive display jobs ──
  // If an active batch was started this session, show those jobs (ordered by imageSequence).
  // Otherwise fall back to the most recent batch or standalone job from the DB.
  const hasActiveBatch = batchJobIds.length > 0;

  const activeBatchDbId = hasActiveBatch
    ? (ocrJobs?.find((j) => batchJobIds.includes(j.id))?.batch_id ?? null)
    : null;

  const fallbackBatchId = !hasActiveBatch
    ? (ocrJobs?.find((j) => j.batch_id && j.status === "completed")?.batch_id ?? null)
    : null;

  const displayBatchId = activeBatchDbId ?? fallbackBatchId;

  const displayJobs = displayBatchId
    ? (ocrJobs ?? [])
        .filter((j) => j.batch_id === displayBatchId)
        .sort((a, b) => (a.image_sequence ?? 0) - (b.image_sequence ?? 0))
    : ocrJobId
    ? (ocrJobs?.filter((j) => j.id === ocrJobId) ?? [])
    : (ocrJobs?.filter((j) => j.status === "completed" && !j.batch_id).slice(0, 1) ?? []);

  // Seed edited texts when server data arrives (only for non-dirty pages)
  useEffect(() => {
    for (const job of displayJobs) {
      if (!dirtyPages.has(job.id) && job.extracted_text != null) {
        setEditedTexts((prev) => {
          if (prev[job.id] === job.extracted_text) return prev;
          return { ...prev, [job.id]: job.extracted_text! };
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocrJobs]);

  function handleFileSelection(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (inputRef.current) inputRef.current.value = "";

    const invalid = files.filter(
      (f) =>
        !ACCEPTED_IMAGE_TYPES.includes(f.type) &&
        !HEIC_TYPES.includes(f.type) &&
        !/\.(heic|heif)$/i.test(f.name)
    );
    if (invalid.length > 0) {
      setUploadError(
        `"${invalid[0].name}" is not a supported image type. Accepted: ${ACCEPTED_EXTENSIONS}`
      );
      return;
    }

    setUploadError(null);
    setStagedFiles((prev) => [
      ...prev,
      ...files.map((f) => ({ id: crypto.randomUUID(), file: f })),
    ]);
  }

  function movePage(index: number, direction: -1 | 1) {
    setStagedFiles((prev) => {
      const next = [...prev];
      const swapIndex = index + direction;
      if (swapIndex < 0 || swapIndex >= next.length) return prev;
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return next;
    });
  }

  function removeStagedPage(id: string) {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  }

  async function handleExtract() {
    if (stagedFiles.length === 0 || !resolvedMeetingId) return;
    setUploadError(null);
    setIsProcessingBatch(true);

    // Snapshot the staged files before clearing — the closure will hold this reference.
    const snapshot = [...stagedFiles];
    const now = Date.now();
    const fileKeys = snapshot.map(
      (sf, i) => `inline/${resolvedMeetingId}/${now}-${i}-${sf.file.name}`
    );

    let jobIds: string[] = [];
    try {
      const result = await createOcrBatch({
        meetingId: resolvedMeetingId,
        imageFileKeys: fileKeys,
      });
      jobIds = result.jobIds;
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Failed to start batch. Please try again."
      );
      setIsProcessingBatch(false);
      return;
    }

    setBatchJobIds(jobIds);
    setStagedFiles([]);
    setPageProgress(
      Object.fromEntries(jobIds.map((id) => [id, { status: "queued" as PageStatus }]))
    );

    // Process pages sequentially in declared order
    for (let i = 0; i < snapshot.length; i++) {
      const sf = snapshot[i];
      const jobId = jobIds[i];

      setPageProgress((prev) => ({ ...prev, [jobId]: { status: "processing" } }));

      try {
        await updateOcrJob({
          jobId,
          meetingId: resolvedMeetingId,
          status: "processing",
          startedAt: new Date().toISOString(),
        });

        const { blob, name } = await prepareImageBlob(sf.file);
        storedBlobs.current.set(jobId, { blob, name });
        const formData = new FormData();
        formData.append("image_file", blob, name);

        const response = await fetch("/api/ocr/extract", { method: "POST", body: formData });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { detail?: string };
          throw new Error(body.detail ?? `OCR request failed (${response.status})`);
        }

        const result = (await response.json()) as {
          extracted_text: string;
          confidence: number;
        };

        await updateOcrJob({
          jobId,
          meetingId: resolvedMeetingId,
          status: "completed",
          extractedText: result.extracted_text,
          confidenceScore: result.confidence,
          completedAt: new Date().toISOString(),
        });

        setPageProgress((prev) => ({ ...prev, [jobId]: { status: "completed" } }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "OCR extraction failed";
        await updateOcrJob({
          jobId,
          meetingId: resolvedMeetingId,
          status: "failed",
          errorMessage: message,
          completedAt: new Date().toISOString(),
        }).catch(() => undefined);
        setPageProgress((prev) => ({ ...prev, [jobId]: { status: "failed", error: message } }));
      }
    }

    await queryClient.invalidateQueries({
      queryKey: ["ocr_jobs", "meeting", resolvedMeetingId],
    });
    await queryClient.invalidateQueries({
      queryKey: ["audit_log", "meeting", resolvedMeetingId],
    });
    setIsProcessingBatch(false);
  }

  async function handleRetryPage(jobId: string) {
    if (!resolvedMeetingId) return;
    const stored = storedBlobs.current.get(jobId);
    if (!stored) return;

    setPageProgress((prev) => ({ ...prev, [jobId]: { status: "processing" } }));
    try {
      await updateOcrJob({
        jobId,
        meetingId: resolvedMeetingId,
        status: "processing",
        startedAt: new Date().toISOString(),
      });

      const formData = new FormData();
      formData.append("image_file", stored.blob, stored.name);

      const response = await fetch("/api/ocr/extract", { method: "POST", body: formData });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? `OCR request failed (${response.status})`);
      }

      const result = (await response.json()) as {
        extracted_text: string;
        confidence: number;
      };

      await updateOcrJob({
        jobId,
        meetingId: resolvedMeetingId,
        status: "completed",
        extractedText: result.extracted_text,
        confidenceScore: result.confidence,
        completedAt: new Date().toISOString(),
      });

      setPageProgress((prev) => ({ ...prev, [jobId]: { status: "completed" } }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "OCR extraction failed";
      await updateOcrJob({
        jobId,
        meetingId: resolvedMeetingId,
        status: "failed",
        errorMessage: message,
        completedAt: new Date().toISOString(),
      }).catch(() => undefined);
      setPageProgress((prev) => ({ ...prev, [jobId]: { status: "failed", error: message } }));
    }

    await queryClient.invalidateQueries({
      queryKey: ["ocr_jobs", "meeting", resolvedMeetingId],
    });
  }

  async function handleSavePage(jobId: string) {
    if (!resolvedMeetingId) return;
    setSaveErrors((prev) => {
      const n = { ...prev };
      delete n[jobId];
      return n;
    });
    setSavingPages((prev) => new Set(prev).add(jobId));
    try {
      await saveOcrCorrections(resolvedMeetingId, jobId, editedTexts[jobId] ?? "");
      setDirtyPages((prev) => {
        const n = new Set(prev);
        n.delete(jobId);
        return n;
      });
      await queryClient.invalidateQueries({
        queryKey: ["ocr_jobs", "meeting", resolvedMeetingId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["audit_log", "meeting", resolvedMeetingId],
      });
      toast.success("Corrections saved");
    } catch (err) {
      setSaveErrors((prev) => ({
        ...prev,
        [jobId]: err instanceof Error ? err.message : "Failed to save corrections",
      }));
    } finally {
      setSavingPages((prev) => {
        const n = new Set(prev);
        n.delete(jobId);
        return n;
      });
    }
  }

  const isBatchComplete =
    batchJobIds.length > 0 &&
    batchJobIds.every((id) => {
      const p = pageProgress[id];
      return p?.status === "completed" || p?.status === "failed";
    });

  const combinedText =
    displayJobs.length > 1
      ? displayJobs
          .filter((j) => j.status === "completed" && (editedTexts[j.id] ?? j.extracted_text))
          .map((j, idx) => `--- Page ${idx + 1} ---\n${editedTexts[j.id] ?? j.extracted_text ?? ""}`)
          .join("\n\n")
      : null;

  const showReview =
    (isBatchComplete || (batchJobIds.length === 0 && displayJobs.length > 0)) &&
    displayJobs.some((j) => j.status === "completed");

  return (
    <Card className="rounded-lg border border-border/60 bg-card/40">
      <CardContent className="space-y-4 p-4">

        {/* Photo tips toggle */}
        <div>
          <button
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
            onClick={() => setGuideOpen((o) => !o)}
          >
            {guideOpen ? "Hide photo tips" : "How to take a clear photo"}
          </button>
          {guideOpen && (
            <div className="mt-3 rounded-lg border border-border/70 bg-muted/20 p-4">
              <p className="mb-2 text-sm font-medium">Tips for a clear photo</p>
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
                <li>Lay the notes flat on a plain, light-coloured surface.</li>
                <li>Shoot from directly above — avoid shooting at an angle.</li>
                <li>Use good natural or overhead lighting; avoid shadows across the page.</li>
                <li>Make sure the entire page fits in the frame with a small margin.</li>
                <li>Hold the phone steady, or rest it on a surface to avoid blur.</li>
                <li>Use your camera&apos;s highest resolution and avoid digital zoom.</li>
              </ol>
            </div>
          )}
        </div>

        {/* Hidden file input — multiple enabled */}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          multiple
          className="sr-only"
          onChange={handleFileSelection}
          aria-label="Upload photos of handwritten notes"
        />

        {/* Upload error */}
        {uploadError && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {uploadError}
          </p>
        )}

        {/* ── STAGED FILE LIST (before processing) ── */}
        {stagedFiles.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {stagedFiles.length} page{stagedFiles.length > 1 ? "s" : ""} ready — reorder before extracting
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => inputRef.current?.click()}
              >
                + Add more
              </Button>
            </div>

            <ol className="space-y-2">
              {stagedFiles.map((sf, idx) => (
                <li
                  key={sf.id}
                  className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/10 px-3 py-2"
                >
                  <span className="min-w-[1.5rem] text-center font-mono text-xs text-muted-foreground">
                    {idx + 1}
                  </span>
                  <span className="flex-1 truncate text-sm">{sf.file.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {(sf.file.size / 1024).toFixed(0)} KB
                  </span>
                  <div className="flex items-center gap-0.5">
                    <button
                      aria-label="Move page up"
                      disabled={idx === 0}
                      onClick={() => movePage(idx, -1)}
                      className="rounded p-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      aria-label="Move page down"
                      disabled={idx === stagedFiles.length - 1}
                      onClick={() => movePage(idx, 1)}
                      className="rounded p-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      aria-label="Remove page"
                      onClick={() => removeStagedPage(sf.id)}
                      className="rounded p-1 text-sm text-muted-foreground hover:text-destructive"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ol>

            <div className="flex items-center gap-3">
              <Button
                size="sm"
                disabled={isProcessingBatch}
                onClick={() => void handleExtract()}
              >
                {isProcessingBatch ? (
                  <>
                    <LoadingSpinner />
                    Extracting…
                  </>
                ) : (
                  `Extract text from ${stagedFiles.length} page${stagedFiles.length > 1 ? "s" : ""}`
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={isProcessingBatch}
                onClick={() => setStagedFiles([])}
              >
                Clear all
              </Button>
            </div>
          </div>
        )}

        {/* ── ADD PHOTOS BUTTON (idle or after previous batch) ── */}
        {!isPending && stagedFiles.length === 0 && !isProcessingBatch && (
          <div className="space-y-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              {displayJobs.length > 0 ? "Upload another batch" : "Choose photos"}
            </Button>
            <p className="text-xs text-muted-foreground">
              {ACCEPTED_EXTENSIONS} · Multiple files, reorder before extracting
            </p>
          </div>
        )}

        {/* ── BATCH PROCESSING PROGRESS ── */}
        {batchJobIds.length > 0 && Object.keys(pageProgress).length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {isBatchComplete ? "Extraction complete" : "Extracting pages…"}
            </p>
            <ol className="space-y-1.5">
              {batchJobIds.map((jobId, idx) => {
                const progress = pageProgress[jobId];
                if (!progress) return null;
                return (
                  <li key={jobId} className="flex items-center gap-3 text-sm">
                    <span className="min-w-[1.5rem] text-center font-mono text-xs text-muted-foreground">
                      {idx + 1}
                    </span>
                    <PageStatusBadge status={progress.status} />
                    {progress.error && (
                      <span className="truncate text-xs text-destructive">{progress.error}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* ── PER-PAGE REVIEW ── */}
        {showReview && (
          <div className="space-y-4">
            {displayJobs.length > 1 && (
              <p className="text-sm font-medium">Review extracted text — edit each page as needed</p>
            )}

            {displayJobs.map((job, idx) => {
              const isFailed = job.status === "failed";
              const isCompleted = job.status === "completed";
              const pageLabel = displayJobs.length > 1 ? `Page ${idx + 1}` : "Extracted text";

              return (
                <div key={job.id} className="space-y-2 rounded-md border border-border/60 bg-muted/5 p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    {displayJobs.length > 1 && (
                      <span className="text-sm font-medium">{pageLabel}</span>
                    )}
                    {isCompleted && job.confidence_score !== null && (
                      <span className="text-xs text-muted-foreground">
                        {formatConfidence(job.confidence_score)}
                      </span>
                    )}
                    {isCompleted && job.completed_at && (
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(job.completed_at)}
                      </span>
                    )}
                    {isCompleted && (
                      <span className="text-xs text-muted-foreground">
                        {(editedTexts[job.id] ?? job.extracted_text ?? "").length} chars
                      </span>
                    )}
                  </div>

                  {isFailed ? (
                    <div className="space-y-2">
                      <p className="text-sm text-destructive">
                        {job.error_message ?? "Extraction failed"}
                      </p>
                      {storedBlobs.current.has(job.id) && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pageProgress[job.id]?.status === "processing"}
                          onClick={() => void handleRetryPage(job.id)}
                        >
                          {pageProgress[job.id]?.status === "processing" ? (
                            <><LoadingSpinner />Retrying…</>
                          ) : (
                            "Retry"
                          )}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <>
                      <textarea
                        value={editedTexts[job.id] ?? job.extracted_text ?? ""}
                        onChange={(e) => {
                          setEditedTexts((prev) => ({ ...prev, [job.id]: e.target.value }));
                          setDirtyPages((prev) => new Set(prev).add(job.id));
                          setSaveErrors((prev) => {
                            const n = { ...prev };
                            delete n[job.id];
                            return n;
                          });
                        }}
                        className="w-full max-h-[300px] min-h-[120px] resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        spellCheck={false}
                        aria-label={`Extracted text for ${pageLabel.toLowerCase()}`}
                      />
                      {saveErrors[job.id] && (
                        <p className="text-sm text-destructive">{saveErrors[job.id]}</p>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={savingPages.has(job.id) || !dirtyPages.has(job.id)}
                        onClick={() => void handleSavePage(job.id)}
                      >
                        {savingPages.has(job.id) ? (
                          <>
                            <LoadingSpinner />
                            Saving…
                          </>
                        ) : (
                          "Save corrections"
                        )}
                      </Button>
                    </>
                  )}
                </div>
              );
            })}

            {/* Combined transcript (multi-page batches only) */}
            {combinedText && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Combined transcript</p>
                <pre className="max-h-[400px] w-full overflow-auto rounded-md border border-border/70 bg-muted/10 px-3 py-2 font-mono text-sm text-foreground whitespace-pre-wrap">
                  {combinedText}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* ── IDLE PLACEHOLDER ── */}
        {!isPending && !isProcessingBatch && stagedFiles.length === 0 && !showReview && (
          <p className="text-sm text-muted-foreground">
            No text extracted yet. Choose photos above to get started.
          </p>
        )}

      </CardContent>
    </Card>
  );
}
