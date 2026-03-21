"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useOcrJobs } from "@/hooks/use-ingestion";
import { saveOcrCorrections } from "@/lib/actions/ocr";
import { createOcrJob, updateOcrJob } from "@/lib/actions/ingestion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface OcrReviewPanelProps {
  consultationId: string;
  ocrJobId?: string;
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

export function OcrReviewPanel({ consultationId, ocrJobId }: OcrReviewPanelProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: ocrJobs, isPending } = useOcrJobs(consultationId);

  const [guideOpen, setGuideOpen] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [editedText, setEditedText] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Resolve the job to display: explicit prop, most recent completed, or most recent overall
  const job = ocrJobId
    ? ocrJobs?.find((j) => j.id === ocrJobId)
    : ocrJobs?.find((j) => j.status === "completed") ?? ocrJobs?.[0];

  const hasCompletedJob = !!job && job.status === "completed";

  // Seed the textarea when the job's text loads (but not while user is editing)
  useEffect(() => {
    if (!isDirty && job?.extracted_text != null) {
      setEditedText(job.extracted_text);
    }
  }, [job?.extracted_text, isDirty]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    let createdJobId: string | null = null;
    // Reset so selecting the same file again still fires onChange
    if (inputRef.current) inputRef.current.value = "";

    const isHeic = HEIC_TYPES.includes(file.type) ||
      /\.(heic|heif)$/i.test(file.name);

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type) && !isHeic) {
      setUploadError(`Unsupported file type. Please upload ${ACCEPTED_EXTENSIONS}.`);
      return;
    }

    setUploadError(null);
    setIsExtracting(true);

    try {
      createdJobId = await createOcrJob({
        consultationId,
        imageFileKey: `inline/${consultationId}/${Date.now()}-${file.name}`,
      });

      await updateOcrJob({
        jobId: createdJobId,
        consultationId,
        status: "processing",
        startedAt: new Date().toISOString(),
      });

      let imageBlob: Blob = file;

      if (isHeic) {
        const heic2any = await loadHeic2Any();
        const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
        imageBlob = Array.isArray(converted) ? converted[0] : converted;
      }

      const formData = new FormData();
      formData.append("image_file", imageBlob, isHeic ? file.name.replace(/\.(heic|heif)$/i, ".jpg") : file.name);

      const response = await fetch("/api/ocr/extract", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { detail?: string };
        throw new Error(body.detail ?? `OCR request failed (${response.status})`);
      }

      const result = await response.json() as { extracted_text: string; confidence: number };

      await updateOcrJob({
        jobId: createdJobId,
        consultationId,
        status: "completed",
        extractedText: result.extracted_text,
        confidenceScore: result.confidence,
        completedAt: new Date().toISOString(),
      });

      await queryClient.invalidateQueries({ queryKey: ["ocr_jobs", consultationId] });
      await queryClient.invalidateQueries({ queryKey: ["audit_log", consultationId] });

      // Seed textarea with fresh result
      setEditedText(result.extracted_text);
      setIsDirty(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to extract text. Please try again.";

      if (createdJobId) {
        await updateOcrJob({
          jobId: createdJobId,
          consultationId,
          status: "failed",
          errorMessage: message,
          completedAt: new Date().toISOString(),
        }).catch(() => undefined);
      }

      setUploadError(message);
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleSave() {
    if (!job) return;

    setSaveError(null);
    setIsSaving(true);

    try {
      await saveOcrCorrections(consultationId, job.id, editedText);
      setIsDirty(false);
      await queryClient.invalidateQueries({ queryKey: ["ocr_jobs", consultationId] });
      await queryClient.invalidateQueries({ queryKey: ["audit_log", consultationId] });
      toast.success("OCR corrections saved");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save corrections. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card className="border-border/70">
      <CardContent className="space-y-4">

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

        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          className="sr-only"
          onChange={handleFileChange}
          aria-label="Upload photo of handwritten notes"
        />

        {/* Upload / re-upload button */}
        {!isPending && (
          <div className="space-y-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={isExtracting}
              onClick={() => inputRef.current?.click()}
            >
              {isExtracting ? (
                <>
                  <LoadingSpinner />
                  Extracting text…
                </>
              ) : hasCompletedJob ? (
                "Upload another photo"
              ) : (
                "Choose photo"
              )}
            </Button>
            <p className="text-xs text-muted-foreground">{ACCEPTED_EXTENSIONS}</p>
          </div>
        )}

        {/* Upload error */}
        {uploadError && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {uploadError}
          </p>
        )}

        {/* Extracted text review */}
        {!isPending && hasCompletedJob && job && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {job.confidence_score !== null && (
                <span>{formatConfidence(job.confidence_score)}</span>
              )}
              {job.completed_at && (
                <span>Extracted {formatTimestamp(job.completed_at)}</span>
              )}
              <span>{editedText.length} characters</span>
            </div>

            <textarea
              value={editedText}
              onChange={(e) => {
                setEditedText(e.target.value);
                setIsDirty(true);
                setSaveError(null);
              }}
              className="w-full max-h-[400px] min-h-[200px] resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              spellCheck={false}
              aria-label="Extracted OCR text"
            />

            {saveError && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {saveError}
              </p>
            )}

            <Button
              size="sm"
              disabled={isSaving || !isDirty}
              onClick={() => void handleSave()}
            >
              {isSaving ? (
                <>
                  <LoadingSpinner />
                  Saving…
                </>
              ) : (
                "Save corrections"
              )}
            </Button>
          </div>
        )}

        {/* Idle placeholder — no jobs yet and not currently extracting */}
        {!isPending && !hasCompletedJob && !isExtracting && !uploadError && (
          <p className="text-sm text-muted-foreground">
            No text extracted yet. Choose a photo above to get started.
          </p>
        )}

      </CardContent>
    </Card>
  );
}
