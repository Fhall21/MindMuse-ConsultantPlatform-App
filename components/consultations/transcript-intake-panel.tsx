"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { updateTranscript } from "@/lib/actions/consultations";
import { TranscriptEditor } from "./transcript-editor";
import { AudioUploadPanel } from "./audio-upload-panel";

// TODO: When file processing is expanded beyond local extraction, persist an
// ingestion artifact and capture any server-side processing metadata.

type Tab = "paste" | "file" | "audio";

const TABS: { id: Tab; label: string }[] = [
  { id: "paste", label: "Paste" },
  { id: "file", label: "File upload" },
  { id: "audio", label: "Audio" },
];

const ACCEPTED_TEXT_TYPES: Record<string, boolean> = {
  "text/plain": true,
  "text/markdown": true,
};

const EXTRACTABLE_EXTENSIONS = ".txt, .md, .vtt, .docx";
const ACCEPTED_EXTENSIONS = `${EXTRACTABLE_EXTENSIONS}, .pdf`;

interface MammothLike {
  extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
}

interface ConsultationCacheData {
  consultation?: {
    transcript_raw: string | null;
  } & Record<string, unknown>;
  [key: string]: unknown;
}

const VTT_TIMESTAMP_PATTERN =
  /^\d{2}:\d{2}(?::\d{2})?\.\d{3}\s+-->\s+\d{2}:\d{2}(?::\d{2})?\.\d{3}/;

function normalizeExtractedText(text: string) {
  return text.replace(/\uFEFF/g, "").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function decodeHtmlEntities(text: string) {
  if (typeof window === "undefined") {
    return text;
  }

  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

function stripVttMarkup(text: string) {
  return decodeHtmlEntities(text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
}

function extractSpeakerFromVoiceTag(text: string) {
  const match = text.match(/<v(?:\.[^ >]+)*\s+([^>]+)>/i);
  return match?.[1]?.trim() ?? null;
}

function extractSpeakerFromCueLines(lines: string[]) {
  for (const line of lines) {
    const voiceTagSpeaker = extractSpeakerFromVoiceTag(line);
    if (voiceTagSpeaker) return voiceTagSpeaker;

    const prefixedSpeaker = line.match(/^([A-Z][\w .'-]{1,80}):\s+/);
    if (prefixedSpeaker) return prefixedSpeaker[1].trim();
  }

  return null;
}

function formatCueLines(lines: string[], speaker: string | null) {
  const cleanedLines = lines
    .map((line) => {
      const withoutSpeakerPrefix = speaker
        ? line.replace(new RegExp(`^${speaker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s+`), "")
        : line;
      return stripVttMarkup(withoutSpeakerPrefix);
    })
    .filter(Boolean);

  if (cleanedLines.length === 0) return null;

  return speaker
    ? `[${speaker}]\n${cleanedLines.join("\n")}`
    : cleanedLines.join("\n");
}

function extractTranscriptFromVtt(content: string) {
  const blocks = normalizeExtractedText(content).split(/\n{2,}/);
  const cues: { speaker: string | null; text: string }[] = [];

  for (const block of blocks) {
    const rawLines = block
      .split("\n")
      .map((line) => line.trimEnd())
      .filter(Boolean);

    if (rawLines.length === 0) continue;
    if (/^(WEBVTT|STYLE|REGION|NOTE)\b/i.test(rawLines[0].trim())) continue;

    const cueLines = [...rawLines];

    if (cueLines[0] && !VTT_TIMESTAMP_PATTERN.test(cueLines[0].trim()) && VTT_TIMESTAMP_PATTERN.test(cueLines[1]?.trim() ?? "")) {
      cueLines.shift();
    }

    if (!VTT_TIMESTAMP_PATTERN.test(cueLines[0]?.trim() ?? "")) {
      continue;
    }

    cueLines.shift();

    const speaker = extractSpeakerFromCueLines(cueLines);
    const formattedCue = formatCueLines(cueLines, speaker);

    if (!formattedCue) {
      continue;
    }

    const previousCue = cues[cues.length - 1];
    if (speaker && previousCue && previousCue.speaker === speaker) {
      previousCue.text = `${previousCue.text}\n${formattedCue.replace(/^\[[^\]]+\]\n/, "")}`;
    } else {
      cues.push({ speaker, text: formattedCue });
    }
  }

  return normalizeExtractedText(cues.map((cue) => cue.text).join("\n\n"));
}

async function extractTranscriptFromDocx(file: File) {
  const mammothModule = await import("mammoth");
  const mammoth = ("default" in mammothModule
    ? mammothModule.default
    : mammothModule) as unknown as MammothLike;

  const result = await mammoth.extractRawText({
    arrayBuffer: await file.arrayBuffer(),
  });

  return normalizeExtractedText(result.value);
}

interface TranscriptIntakePanelProps {
  consultationId: string;
  initialTranscript: string | null;
  readOnly?: boolean;
}

export function TranscriptIntakePanel({
  consultationId,
  initialTranscript,
  readOnly = false,
}: TranscriptIntakePanelProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("paste");
  // transcriptValue seeds TranscriptEditor on (re)mount.
  // It can be updated by file/audio routes, but also stays in sync with the
  // server value so that after a save+refetch the editor doesn't show stale data.
  const [transcriptValue, setTranscriptValue] = useState<string | null>(
    initialTranscript
  );
  // Track whether we have a pending locally-loaded value (file/audio) that hasn't
  // been saved yet — while pending we don't overwrite with the server value.
  const pendingLocalRef = useRef(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync transcriptValue when the server refetches the transcript (e.g. after save).
  // Skip sync if a local file/audio load is pending to avoid clobbering it.
  useEffect(() => {
    if (!pendingLocalRef.current) {
      const syncTimer = window.setTimeout(() => {
        setTranscriptValue(initialTranscript);
      }, 0);

      return () => window.clearTimeout(syncTimer);
    }
  }, [initialTranscript]);

  function applyLocalTranscript(text: string) {
    pendingLocalRef.current = true;
    setTranscriptValue(text);
    setActiveTab("paste");
    queryClient.setQueryData<ConsultationCacheData>(
      ["consultations", consultationId],
      (current) => {
        if (!current?.consultation) {
          return current;
        }

        return {
          ...current,
          consultation: {
            ...current.consultation,
            transcript_raw: text,
          },
        };
      }
    );
  }

  function handleTranscriptFromAudio(text: string) {
    applyLocalTranscript(text);
    // Auto-save so downstream panels respond immediately (same reason as file upload).
    updateTranscript({ id: consultationId, transcriptRaw: text })
      .then(() => {
        pendingLocalRef.current = false;
        return queryClient.invalidateQueries({ queryKey: ["consultations", consultationId] });
      })
      .catch(() => {
        // Optimistic update still in place; user can manually save.
      });
  }

  function handleTranscriptSaved() {
    // Local value has been persisted — allow server refetches to sync again
    pendingLocalRef.current = false;
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    setFileError(null);
    setLoadedFileName(null);

    try {
      const name = file.name.toLowerCase();
      const isTextType = ACCEPTED_TEXT_TYPES[file.type];
      const isPlainTextExt = name.endsWith(".txt") || name.endsWith(".md");

      let extractedText = "";

      if (name.endsWith(".vtt")) {
        extractedText = extractTranscriptFromVtt(await file.text());
      } else if (isTextType || isPlainTextExt) {
        extractedText = normalizeExtractedText(await file.text());
      } else if (name.endsWith(".docx")) {
        extractedText = await extractTranscriptFromDocx(file);
      } else if (name.endsWith(".pdf")) {
        throw new Error(
          "PDF extraction is not available yet. Copy the text from the PDF and paste it into the editor."
        );
      } else {
        throw new Error(`Unsupported file type. Please upload ${ACCEPTED_EXTENSIONS}.`);
      }

      if (!extractedText) {
        throw new Error(
          "No readable transcript text was found in that file. Open it to confirm the content or paste the text manually."
        );
      }

      applyLocalTranscript(extractedText);
      setLoadedFileName(file.name);

      // Auto-save so other panels (EmailDraftPanel, ThemePanel) see the
      // transcript immediately. Without this, the TanStack Query
      // refetchOnWindowFocus triggered by the OS file picker closing can
      // overwrite the optimistic setQueryData patch with stale server data.
      try {
        await updateTranscript({ id: consultationId, transcriptRaw: extractedText });
        pendingLocalRef.current = false;
        await queryClient.invalidateQueries({ queryKey: ["consultations", consultationId] });
      } catch {
        // Auto-save failed — the optimistic update is still in place; the
        // user can manually save from the Paste tab.
      }
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Could not process file. Please try again.");
    } finally {
      input.value = "";
    }
  }

  if (readOnly) {
    return (
      <TranscriptEditor
        consultationId={consultationId}
        initialValue={transcriptValue}
        readOnly
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Segmented tab control */}
      <div className="flex gap-1 rounded-md border p-1 w-fit bg-muted/30">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              "rounded px-3 py-1 text-sm transition-colors",
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Paste tab */}
      {activeTab === "paste" && (
        <TranscriptEditor
          consultationId={consultationId}
          initialValue={transcriptValue}
          readOnly={false}
          onSaved={handleTranscriptSaved}
        />
      )}

      {/* File upload tab */}
      {activeTab === "file" && (
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            className="sr-only"
            onChange={handleFileChange}
            aria-label="Upload transcript file"
          />
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose file
            </Button>
            <p className="text-xs text-muted-foreground">
              Upload {EXTRACTABLE_EXTENSIONS} to extract text into the editor.
              PDFs can still be selected, but their text needs to be pasted
              manually.
            </p>
          </div>

          {fileError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
              <p className="font-medium text-destructive">Could not process file</p>
              <p className="mt-0.5 text-destructive/80">{fileError}</p>
            </div>
          )}

          {loadedFileName && !fileError && (
            <div className="rounded-md border border-border bg-muted/20 px-4 py-3 text-sm">
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">{loadedFileName}</span>{" "}
                loaded.{" "}
                <button
                  className="underline underline-offset-2 hover:text-foreground transition-colors"
                  onClick={() => setActiveTab("paste")}
                >
                  Review the extracted text and save it in the Paste tab.
                </button>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Audio tab */}
      {activeTab === "audio" && (
        <AudioUploadPanel
          consultationId={consultationId}
          onTranscriptReady={handleTranscriptFromAudio}
        />
      )}
    </div>
  );
}
