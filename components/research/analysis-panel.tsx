"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Database,
  Download,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAIPreferences } from "@/hooks/use-ai-preferences";
import { useDataAnalysis } from "@/hooks/use-research";
import type { AnalysisArtifact } from "@/hooks/use-research";
import { cn } from "@/lib/utils";
import { AnswerText } from "./answer-text";
import { NotebookCells } from "./notebook-cells";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;
const MAX_FILES = 50;

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

  const handleFiles = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming);
      onAdd(list);
    },
    [onAdd]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      handleFiles(e.dataTransfer.files);
    },
    [disabled, handleFiles]
  );

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
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-muted-foreground/30 bg-card px-6 py-7 text-center transition-colors",
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
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="divide-y rounded-xl border bg-card text-sm">
          {files.map((file, idx) => (
            <li key={`${file.name}-${idx}`} className="flex items-center gap-3 px-3 py-2">
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{file.name}</span>
              <span className="text-xs text-muted-foreground">
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
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          <li className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
            <span>
              {files.length} file{files.length === 1 ? "" : "s"}
            </span>
            <span>{formatBytes(totalBytes)} total</span>
          </li>
        </ul>
      )}
    </div>
  );
}

function ArtifactList({ artifacts }: { artifacts: AnalysisArtifact[] }) {
  if (artifacts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No artifacts were produced for this analysis.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {artifacts.map((art, idx) => {
        const isImage = art.mime_type.startsWith("image/");
        const downloadHref = `/api/research/analysis/artifacts/${encodeURIComponent(
          art.entry_id
        )}`;
        return (
          <li
            key={`${art.entry_id}-${idx}`}
            className="rounded-lg border bg-card p-3"
          >
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{art.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {art.mime_type}
                  {art.size_bytes != null && ` · ${formatBytes(art.size_bytes)}`}
                </p>
                {art.error && (
                  <p className="mt-1 text-xs text-destructive">{art.error}</p>
                )}
              </div>
              <Button asChild variant="ghost" size="sm">
                <a href={downloadHref} download={art.filename}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download
                </a>
              </Button>
            </div>
            {isImage && art.inline_data_url && (
              <img
                src={art.inline_data_url}
                alt={art.filename}
                className="mt-3 max-h-[420px] max-w-full rounded-md border"
              />
            )}
            {!isImage && art.inline_text && (
              <ScrollArea className="mt-3 max-h-48 rounded-md border bg-muted/30">
                <pre className="whitespace-pre-wrap break-words p-3 font-mono text-xs">
                  {art.inline_text}
                </pre>
              </ScrollArea>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function AnalysisPanel() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { data: preferences } = useAIPreferences();
  const {
    status,
    result,
    error,
    elapsedSeconds,
    pollingMessage,
    notebookCells,
    submit,
    reset,
    cancel,
    isCancellable,
  } = useDataAnalysis();

  const [files, setFiles] = useState<File[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "notebook" | "artifacts">(
    "summary"
  );

  const industry = preferences?.industry || undefined;
  const isUploading = status === "uploading";
  const isLoading =
    status === "uploading" ||
    status === "submitted" ||
    status === "polling" ||
    status === "reconnecting";
  const hasResult = status === "complete" && result !== null;

  const liveCells = useMemo(
    () => (hasResult ? result.notebook_cells : notebookCells),
    [hasResult, result, notebookCells]
  );

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

  const handleSubmit = useCallback(() => {
    const query = textareaRef.current?.value.trim();
    if (!query) {
      setValidationError("Please describe the analysis you want to run");
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
    void submit({ query, files, industryCtx: industry ?? null });
  }, [files, industry, submit, validateFiles]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleReset = useCallback(() => {
    reset();
    setFiles([]);
    setValidationError(null);
    setActiveTab("summary");
    if (textareaRef.current) textareaRef.current.value = "";
  }, [reset]);

  return (
    <div className="space-y-4">
      <DatasetDropzone
        files={files}
        onAdd={handleAddFiles}
        onRemove={handleRemoveFile}
        disabled={isLoading}
      />

      <div className="space-y-2">
        <Textarea
          ref={textareaRef}
          placeholder="Analyse this HR data and surface the most pressing psychosocial risks…"
          className="min-h-[88px] resize-none"
          disabled={isLoading}
          onKeyDown={handleKeyDown}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleSubmit} disabled={isLoading} size="sm">
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {isUploading ? "Uploading…" : "Run analysis"}
          </Button>
          {isCancellable && (
            <Button variant="ghost" size="sm" onClick={cancel}>
              Cancel
            </Button>
          )}
          {(hasResult || status === "error") && (
            <Button variant="ghost" size="sm" onClick={handleReset}>
              New analysis
            </Button>
          )}
          {industry && (
            <span className="text-xs text-muted-foreground">
              Context: {industry}
            </span>
          )}
        </div>
      </div>

      {validationError && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm text-foreground/85">{validationError}</p>
        </div>
      )}

      {status === "error" && error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-destructive">Analysis failed</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {/* Loading state — spinner + live notebook progress */}
      {isLoading && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {pollingMessage ||
                  (isUploading ? "Uploading datasets" : "Running analysis")}
              </p>
              <p className="text-xs text-muted-foreground">
                Usually 2–5 minutes
                {elapsedSeconds > 0 && ` · ${elapsedSeconds}s elapsed`}
              </p>
            </div>
          </div>

          {liveCells.length > 0 && (
            <div className="rounded-lg border bg-card p-3">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Database className="h-3.5 w-3.5" />
                Notebook progress
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                  {liveCells.length}
                </Badge>
              </div>
              <ScrollArea className="max-h-[420px]">
                <NotebookCells cells={liveCells} isLive variant="panel" />
              </ScrollArea>
            </div>
          )}
        </div>
      )}

      {/* Result tabs */}
      {hasResult && (
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          className="w-full"
        >
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="notebook">
              Notebook
              <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                {result.notebook_cells.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="artifacts">
              Artifacts
              {result.artifacts.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                  {result.artifacts.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-3">
            <ScrollArea className="max-h-[480px] rounded-lg border bg-card p-4">
              <AnswerText text={result.answer || "_No summary returned._"} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="notebook" className="mt-3">
            <ScrollArea className="max-h-[600px] rounded-lg border bg-card p-3">
              <NotebookCells cells={result.notebook_cells} variant="panel" />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="artifacts" className="mt-3">
            <ScrollArea className="max-h-[480px]">
              <ArtifactList artifacts={result.artifacts} />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
