"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, FileSpreadsheet, Loader2, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EnhancementClarifier } from "@/components/research/enhancement-clarifier";
import { useAIPreferences } from "@/hooks/use-ai-preferences";
import {
  useCreateAnalysisSession,
  useEnhanceQuestion,
  type EnhancePriorAnswer,
  type EnhanceQuestionResponse,
} from "@/hooks/use-research";
import { extractHeaders } from "@/lib/research/csv-headers";
import { cn } from "@/lib/utils";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;
const MAX_FILES = 50;

type Step =
  | { kind: "compose" }
  | { kind: "enhancing" }
  | { kind: "clarify"; payload: EnhanceQuestionResponse }
  | { kind: "submitting" };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface DropzoneProps {
  files: File[];
  onAdd: (added: File[]) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}

function DatasetDropzone({ files, onAdd, onRemove, disabled }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalBytes = files.reduce((s, f) => s + f.size, 0);

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (disabled) return;
          onAdd(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-muted-foreground/30 bg-card/50 px-6 py-7 text-center transition-colors",
          "hover:border-foreground/40 hover:bg-muted/30",
          isDragging && "border-foreground/50 bg-muted/40",
          disabled && "pointer-events-none opacity-60"
        )}
      >
        <Upload className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm">
          <span className="font-medium">Click to choose CSV files</span>{" "}
          <span className="text-muted-foreground">or drop them here</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Up to {MAX_FILES} files · 50 MB each · 200 MB total
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) onAdd(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="divide-y divide-border/40 rounded-xl border bg-card text-sm">
          {files.map((file, idx) => (
            <li key={`${file.name}-${idx}`} className="flex items-center gap-3 px-3 py-2">
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{file.name}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatBytes(file.size)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(idx);
                }}
                disabled={disabled}
                className="rounded-md p-1 text-muted-foreground/70 hover:bg-muted hover:text-foreground disabled:opacity-40"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          <li className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
            <span>
              {files.length} file{files.length === 1 ? "" : "s"}
            </span>
            <span className="tabular-nums">{formatBytes(totalBytes)} total</span>
          </li>
        </ul>
      )}
    </div>
  );
}

function EnhancingPanel({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Reviewing your question…
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel} aria-label="Cancel">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function AnalysisComposer() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const originalQueryRef = useRef("");
  const router = useRouter();
  const { data: preferences } = useAIPreferences();
  const createAnalysis = useCreateAnalysisSession();
  const enhanceQuestion = useEnhanceQuestion();

  const [files, setFiles] = useState<File[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ kind: "compose" });

  const industry = preferences?.industry || undefined;
  const isBusy =
    step.kind === "enhancing" ||
    step.kind === "submitting" ||
    createAnalysis.isPending ||
    enhanceQuestion.isPending;

  const validateFiles = useCallback((all: File[]): string | null => {
    if (all.length === 0) return null;
    if (all.length > MAX_FILES) return `Maximum ${MAX_FILES} files`;
    let total = 0;
    for (const f of all) {
      if (!/\.csv$/i.test(f.name)) {
        return `Only CSV files are supported (rejected: ${f.name})`;
      }
      if (f.size > MAX_FILE_BYTES) {
        return `${f.name} exceeds the 50 MB per-file limit`;
      }
      total += f.size;
    }
    if (total > MAX_TOTAL_BYTES) return "Total upload exceeds 200 MB";
    return null;
  }, []);

  const handleAddFiles = useCallback(
    (added: File[]) => {
      const all = [...files, ...added];
      const err = validateFiles(all);
      setValidationError(err);
      setFiles(err ? files : all);
    },
    [files, validateFiles]
  );

  const handleRemoveFile = useCallback(
    (index: number) => {
      const next = files.filter((_, i) => i !== index);
      setFiles(next);
      setValidationError(validateFiles(next));
    },
    [files, validateFiles]
  );

  const buildFileMeta = useCallback(async () => {
    const headers = await Promise.all(files.map(extractHeaders));
    return files.map((f, i) => ({ filename: f.name, columns: headers[i] ?? [] }));
  }, [files]);

  const finalSubmit = useCallback(
    async (queryToRun: string) => {
      setStep({ kind: "submitting" });
      try {
        const { id } = await createAnalysis.mutateAsync({
          query: queryToRun,
          files,
          industryCtx: industry ?? null,
        });
        router.push(`/research/${id}`);
      } catch (err) {
        setStep({ kind: "compose" });
        toast.error(
          (err as Error).message || "Failed to start analysis. Please try again."
        );
      }
    },
    [createAnalysis, files, industry, router]
  );

  const runEnhancement = useCallback(
    async (priorAnswers?: EnhancePriorAnswer[] | null) => {
      const query = priorAnswers ? originalQueryRef.current : textareaRef.current?.value.trim();
      if (!query) {
        setValidationError("Describe the analysis you want to run");
        return;
      }

      setStep({ kind: "enhancing" });
      try {
        const fileMeta = await buildFileMeta();
        const res = await enhanceQuestion.mutateAsync({
          query,
          industry_ctx: industry ?? null,
          files: fileMeta,
          prior_answers: priorAnswers ?? null,
        });

        if (!res.needs_clarification && res.enhanced_query) {
          await finalSubmit(res.enhanced_query);
          return;
        }

        if (res.needs_clarification) {
          if (!priorAnswers) {
            originalQueryRef.current = query;
          }
          setStep({ kind: "clarify", payload: res });
          return;
        }

        throw new Error("Enhancement did not return a refined question");
      } catch (err) {
        setStep({ kind: "compose" });
        toast.error(
          (err as Error).message || "Failed to refine your question. Please try again."
        );
      }
    },
    [buildFileMeta, enhanceQuestion, finalSubmit, industry]
  );

  const handleStartEnhance = async () => {
    const query = textareaRef.current?.value.trim();
    if (!query) {
      setValidationError("Describe the analysis you want to run");
      return;
    }
    if (files.length === 0) {
      setValidationError("Upload at least one CSV file");
      return;
    }
    const err = validateFiles(files);
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    originalQueryRef.current = query;
    await runEnhancement();
  };

  const handleClarifySubmit = (answers: EnhancePriorAnswer[]) => {
    void runEnhancement(answers);
  };

  const handleSkipClarify = () => {
    void finalSubmit(originalQueryRef.current);
  };

  const handleCancelEnhance = () => {
    setStep({ kind: "compose" });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (!isBusy) void handleStartEnhance();
    }
  };

  const showComposeInputs = step.kind === "compose" || step.kind === "enhancing";

  return (
    <div className="space-y-3">
      {showComposeInputs && (
        <>
          <DatasetDropzone
            files={files}
            onAdd={handleAddFiles}
            onRemove={handleRemoveFile}
            disabled={isBusy}
          />

          <div className="space-y-2">
            <Textarea
              ref={textareaRef}
              placeholder="Surface the most pressing psychosocial risks across this dataset…"
              className="min-h-[80px] resize-none"
              disabled={isBusy}
              onKeyDown={handleKeyDown}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => void handleStartEnhance()}
                disabled={isBusy}
                size="sm"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {step.kind === "enhancing" ? "Reviewing…" : "Run analysis"}
              </Button>
              {industry && (
                <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground">
                  {industry}
                </span>
              )}
            </div>
          </div>
        </>
      )}

      {step.kind === "enhancing" && <EnhancingPanel onCancel={handleCancelEnhance} />}

      {step.kind === "submitting" && (
        <div className="flex items-center gap-2 rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Uploading datasets and starting analysis…
        </div>
      )}

      {step.kind === "clarify" && (
        <EnhancementClarifier
          payload={step.payload}
          originalQuery={originalQueryRef.current}
          disabled={isBusy}
          onSubmit={handleClarifySubmit}
          onSkip={handleSkipClarify}
        />
      )}

      {validationError && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm text-foreground/85">{validationError}</p>
        </div>
      )}
    </div>
  );
}
