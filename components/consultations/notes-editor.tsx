"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateNotes } from "@/lib/actions/consultations";

// TODO: Agent 1 — this component depends on a `notes` column in the consultations
// table. Add migration: ALTER TABLE consultations ADD COLUMN notes text;
// Until then, saves will fail silently and show a "pending migration" notice.

interface NotesEditorProps {
  meetingId?: string;
  consultationId?: string;
  initialValue: string | null | undefined;
  readOnly?: boolean;
}

export function NotesEditor({
  meetingId,
  consultationId,
  initialValue,
  readOnly = false,
}: NotesEditorProps) {
  const resolvedMeetingId = meetingId ?? consultationId;
  const [text, setText] = useState(initialValue ?? "");
  const [savedText, setSavedText] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [showSavedConfirm, setShowSavedConfirm] = useState(false);
  const [migrationPending, setMigrationPending] = useState(false);
  const savedConfirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const isDirty = text !== savedText;

  useEffect(() => {
    const val = initialValue ?? "";
    setText(val);
    setSavedText(val);
  }, [initialValue]);

  async function handleSave() {
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      await updateNotes({ id: resolvedMeetingId!, notes: text });
      setSavedText(text);
      setSavedAt(new Date());
      setShowSavedConfirm(true);
      setMigrationPending(false);
      queryClient.invalidateQueries({ queryKey: ["meetings", resolvedMeetingId] });
      if (savedConfirmTimer.current) clearTimeout(savedConfirmTimer.current);
      savedConfirmTimer.current = setTimeout(() => setShowSavedConfirm(false), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Surface migration-pending state gracefully
      if (message.toLowerCase().includes("column") || message.toLowerCase().includes("notes")) {
        setMigrationPending(true);
      } else {
        toast.error("Failed to save notes. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        readOnly={readOnly}
        placeholder={
          readOnly
            ? "No notes recorded."
            : "Add any notes, context, or follow-up items from this consultation…"
        }
        className="min-h-[160px] resize-y text-sm leading-relaxed"
      />

      {migrationPending && (
        <p className="text-xs text-muted-foreground">
          Notes saving is pending a database migration (Agent 1).{" "}
          Your notes are preserved locally until the page is refreshed.
        </p>
      )}

      {!readOnly && (
        <div className="flex items-center gap-4">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSave}
            disabled={!isDirty || saving}
          >
            {saving ? "Saving…" : "Save notes"}
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
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins === 1) return "1m ago";
  return `${diffMins}m ago`;
}
