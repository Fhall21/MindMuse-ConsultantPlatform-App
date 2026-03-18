"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranscriptionStatus } from "@/hooks/use-transcription";
import { uploadAudioForTranscription } from "@/lib/actions/ingestion";
import type { TranscriptionJobStatus } from "@/lib/actions/ingestion";

interface AudioUploadPanelProps {
  consultationId: string;
  /** Called when transcription completes with the transcript text */
  onTranscriptReady: (transcript: string) => void;
}

const ACCEPTED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/flac",
  "audio/x-m4a",
];

const STATUS_LABELS: Record<TranscriptionJobStatus, string> = {
  queued: "Queued",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
};

const STATUS_ORDER: TranscriptionJobStatus[] = [
  "queued",
  "processing",
  "completed",
];

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins === 1) return "1m ago";
  return `${diffMins}m ago`;
}

export function AudioUploadPanel({
  consultationId,
  onTranscriptReady,
}: AudioUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [transcriptConsumed, setTranscriptConsumed] = useState(false);

  const { data: job, error: jobError } = useTranscriptionStatus(jobId);

  // Notify parent once when transcription completes — must be in an effect,
  // not render body, to avoid React Strict Mode double-fire and state-during-render warnings.
  useEffect(() => {
    if (job?.status === "completed" && job.transcript && !transcriptConsumed) {
      setTranscriptConsumed(true);
      onTranscriptReady(job.transcript);
    }
  }, [job?.status, job?.transcript, transcriptConsumed, onTranscriptReady]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_AUDIO_TYPES.includes(file.type)) {
      setUploadError(
        "Unsupported file type. Please upload an MP3, MP4, WAV, WEBM, OGG, FLAC, or M4A file."
      );
      return;
    }

    setUploadError(null);
    setUploading(true);
    setJobId(null);
    setTranscriptConsumed(false);

    try {
      // Read file as base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Strip data URI prefix
          resolve(result.split(",")[1] ?? result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { jobId: newJobId } = await uploadAudioForTranscription({
        consultationId,
        fileName: file.name,
        fileType: file.type,
        fileBase64: base64,
      });

      setJobId(newJobId);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Upload failed. Please try again.";
      // Show user-friendly message for stub state
      if (message.includes("not yet implemented")) {
        setUploadError(
          "Audio transcription is not yet available — the transcription service is pending deployment. Your transcript can be pasted manually."
        );
      } else {
        setUploadError(message);
      }
    } finally {
      setUploading(false);
    }
  }

  function handleChooseFile() {
    inputRef.current?.click();
  }

  function handleReset() {
    setJobId(null);
    setUploadError(null);
    setTranscriptConsumed(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  const activeStatus = job?.status ?? null;

  return (
    <div className="space-y-4">
      {/* File input (hidden) */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_AUDIO_TYPES.join(",")}
        className="sr-only"
        onChange={handleFileChange}
        aria-label="Upload audio file"
      />

      {/* Upload trigger — only show when no active job */}
      {!jobId && (
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleChooseFile}
            disabled={uploading}
          >
            {uploading ? "Uploading…" : "Choose audio file"}
          </Button>
          <p className="text-xs text-muted-foreground">
            MP3, MP4, WAV, WEBM, OGG, FLAC, M4A — max 200 MB
          </p>
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <p className="font-medium">Upload failed</p>
          <p className="mt-0.5 text-destructive/80">{uploadError}</p>
        </div>
      )}

      {/* Status timeline */}
      {jobId && job && (
        <div className="space-y-3">
          <div className="space-y-2">
            {STATUS_ORDER.map((step) => {
              const isCurrent = activeStatus === step;
              const isPast =
                STATUS_ORDER.indexOf(step) <
                STATUS_ORDER.indexOf(activeStatus as TranscriptionJobStatus);
              const isFailed = activeStatus === "failed" && isCurrent;

              return (
                <div key={step} className="flex items-start gap-3">
                  {/* Step indicator */}
                  <div
                    className={[
                      "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                      isPast
                        ? "bg-foreground/40"
                        : isCurrent && !isFailed
                        ? "bg-foreground animate-pulse"
                        : isCurrent && isFailed
                        ? "bg-destructive"
                        : "bg-muted",
                    ].join(" ")}
                  />

                  <div className="flex-1 min-w-0">
                    <span
                      className={[
                        "text-sm",
                        isCurrent ? "font-medium text-foreground" : "text-muted-foreground",
                      ].join(" ")}
                    >
                      {STATUS_LABELS[step]}
                    </span>
                    {isCurrent && job.updatedAt && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {formatUpdatedAt(job.updatedAt)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Failed step */}
            {activeStatus === "failed" && (
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-destructive" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-destructive">
                    Failed
                  </span>
                  {job.updatedAt && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatUpdatedAt(job.updatedAt)}
                    </span>
                  )}
                  {job.errorMessage && (
                    <p className="mt-1 text-xs text-destructive/80">
                      {job.errorMessage}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Completed message */}
          {activeStatus === "completed" && (
            <p className="text-sm text-muted-foreground">
              Transcript added to the editor above.
            </p>
          )}

          {/* Failed — actionable next steps */}
          {activeStatus === "failed" && (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Transcription failed. You can paste the transcript manually or
                try uploading again.
              </p>
              <Button variant="outline" size="sm" onClick={handleReset}>
                Try again
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Job fetch error */}
      {jobError && (
        <p className="text-sm text-destructive">
          Could not retrieve transcription status. Check your connection and
          refresh.
        </p>
      )}
    </div>
  );
}
