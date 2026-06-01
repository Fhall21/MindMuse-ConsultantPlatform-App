"use client";

import { useRef, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  onAttachFile?: (file: File, kind: "transcript" | "notes") => void;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Ask MindMuse or describe what you need…",
  onAttachFile,
}: ChatInputProps) {
  const transcriptInputRef = useRef<HTMLInputElement>(null);
  const notesInputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!value.trim() || disabled) {
      return;
    }
    onSubmit();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!value.trim() || disabled) {
        return;
      }
      onSubmit();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6"
    >
      <input
        ref={transcriptInputRef}
        type="file"
        className="hidden"
        accept=".txt,.doc,.docx,.pdf"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && onAttachFile) {
            onAttachFile(file, "transcript");
          }
          event.target.value = "";
        }}
      />
      <input
        ref={notesInputRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && onAttachFile) {
            onAttachFile(file, "notes");
          }
          event.target.value = "";
        }}
      />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={2}
          className="min-h-[52px] resize-none"
        />
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            {onAttachFile ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={() => transcriptInputRef.current?.click()}
                >
                  Attach transcript
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={() => notesInputRef.current?.click()}
                >
                  Attach notes
                </Button>
              </>
            ) : null}
          </div>
          <Button type="submit" disabled={disabled || !value.trim()}>
            Send
          </Button>
        </div>
      </div>
    </form>
  );
}
