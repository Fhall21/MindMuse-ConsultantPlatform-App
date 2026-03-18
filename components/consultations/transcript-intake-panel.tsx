"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TranscriptEditor } from "./transcript-editor";
import { AudioUploadPanel } from "./audio-upload-panel";

// TODO: Agent 1 — when file processing service is available, call an ingestion
// action here to store the file reference in Supabase Storage and return processed text.

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

// Accepted file extensions for display
const ACCEPTED_EXTENSIONS = ".txt, .md, .docx, .pdf";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync transcriptValue when the server refetches the transcript (e.g. after save).
  // Skip sync if a local file/audio load is pending to avoid clobbering it.
  useEffect(() => {
    if (!pendingLocalRef.current) {
      setTranscriptValue(initialTranscript);
    }
  }, [initialTranscript]);

  function handleTranscriptFromAudio(text: string) {
    pendingLocalRef.current = true;
    setTranscriptValue(text);
    setActiveTab("paste");
  }

  function handleTranscriptSaved() {
    // Local value has been persisted — allow server refetches to sync again
    pendingLocalRef.current = false;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);

    const isTextType = ACCEPTED_TEXT_TYPES[file.type];
    const name = file.name.toLowerCase();
    const isTextExt = name.endsWith(".txt") || name.endsWith(".md");

    if (isTextType || isTextExt) {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        pendingLocalRef.current = true;
        setTranscriptValue(text);
        setActiveTab("paste");
      };
      reader.onerror = () => {
        setFileError("Could not read file. Please try again.");
      };
      reader.readAsText(file);
      return;
    }

    if (name.endsWith(".docx")) {
      // TODO: Agent 1 — integrate mammoth.js (or server-side docx processing)
      // to extract text from .docx files.
      setFileError(
        ".docx support is coming soon. For now, open the file and paste the text manually."
      );
      return;
    }

    if (name.endsWith(".pdf")) {
      // TODO: Agent 1 — integrate pdf.js (or server-side PDF processing)
      // to extract text from .pdf files.
      setFileError(
        ".pdf support is coming soon. For now, copy the text from the PDF and paste it manually."
      );
      return;
    }

    setFileError(
      `Unsupported file type. Please upload ${ACCEPTED_EXTENSIONS}.`
    );
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
              {ACCEPTED_EXTENSIONS} — text is extracted and loaded into the
              editor
            </p>
          </div>

          {fileError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
              <p className="font-medium text-destructive">Could not process file</p>
              <p className="mt-0.5 text-destructive/80">{fileError}</p>
            </div>
          )}

          {transcriptValue && !fileError && (
            <div className="rounded-md border border-border bg-muted/20 px-4 py-3 text-sm">
              <p className="text-muted-foreground">
                File loaded.{" "}
                <button
                  className="underline underline-offset-2 hover:text-foreground transition-colors"
                  onClick={() => setActiveTab("paste")}
                >
                  Review and save in the Paste tab.
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
