"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateTranscript } from "@/lib/actions/consultations";

interface TranscriptEditorProps {
  meetingId?: string;
  consultationId?: string;
  initialValue: string | null;
  readOnly?: boolean;
  onSaved?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export function TranscriptEditor({
  meetingId,
  consultationId,
  initialValue,
  readOnly = false,
  onSaved,
  onDirtyChange,
}: TranscriptEditorProps) {
  const resolvedMeetingId = meetingId ?? consultationId;
  const [text, setText] = useState(initialValue ?? "");
  const [savedText, setSavedText] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [showSavedConfirm, setShowSavedConfirm] = useState(false);
  const savedConfirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const isDirty = text !== savedText;

  // Notify parent when dirty state changes so it can guard against server
  // refetches overwriting unsaved paste content (mirrors file/audio protection).
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Keep local state in sync if initialValue changes (e.g. after refetch)
  useEffect(() => {
    const val = initialValue ?? "";
    setText(val);
    setSavedText(val);
  }, [initialValue]);

  async function handleSave() {
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      await updateTranscript({ id: resolvedMeetingId!, transcriptRaw: text });
      setSavedText(text);
      setSavedAt(new Date());
      setShowSavedConfirm(true);
      queryClient.invalidateQueries({ queryKey: ["meetings", resolvedMeetingId] });
      queryClient.invalidateQueries({ queryKey: ["themes", "meeting", resolvedMeetingId] });
      queryClient.invalidateQueries({ queryKey: ["meeting-report", resolvedMeetingId] });
      onSaved?.();
      if (savedConfirmTimer.current) clearTimeout(savedConfirmTimer.current);
      savedConfirmTimer.current = setTimeout(() => setShowSavedConfirm(false), 3000);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save transcript. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="scroll-zone rounded-md">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          readOnly={readOnly}
          placeholder={
            readOnly
              ? "No transcript recorded."
              : "Paste or type the consultation transcript here…"
          }
          className="max-h-[60vh] min-h-[300px] resize-y font-mono text-sm leading-relaxed"
        />
      </div>

      {!readOnly && (
        <div className="flex items-center gap-4">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || saving}
          >
            {saving ? "Saving…" : "Save transcript"}
          </Button>

          <span className="text-xs text-muted-foreground">
            {isDirty && !saving && "Unsaved changes"}
            {!isDirty && showSavedConfirm && "Saved"}
            {!isDirty && !showSavedConfirm && savedAt && (
              <>Saved {formatRelative(savedAt)}</>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins === 1) return "1m ago";
  return `${diffMins}m ago`;
}
