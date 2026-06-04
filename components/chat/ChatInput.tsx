"use client";

import { useRef, type FormEvent, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CAPTURE_NOTES_ACCEPT_ATTR,
  CAPTURE_TRANSCRIPT_ACCEPT_ATTR,
} from "@/lib/capture/constants";
import { CHAT_QUICK_ACTION_BUTTON_CLASS } from "@/lib/chat/constants";
import { SuggestedResponsesBar } from "@/components/chat/SuggestedResponsesBar";
import type { SuggestedResponseOption } from "@/lib/chat/suggested-responses";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  blockedReason?: string | null;
  placeholder?: string;
  onAttachFile?: (file: File, kind: "transcript" | "notes") => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  suggestedResponses?: SuggestedResponseOption[] | null;
  onSelectSuggestion?: (prefill: string) => void;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  blockedReason = null,
  placeholder = "Ask MindMuse or describe what you need…",
  onAttachFile,
  textareaRef: textareaRefProp,
  suggestedResponses = null,
  onSelectSuggestion,
}: ChatInputProps) {
  const inputDisabled = disabled || Boolean(blockedReason);
  const effectivePlaceholder = blockedReason ?? placeholder;
  const transcriptInputRef = useRef<HTMLInputElement>(null);
  const notesInputRef = useRef<HTMLInputElement>(null);
  const localTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = textareaRefProp ?? localTextareaRef;

  const showSuggestions =
    Boolean(suggestedResponses?.length) &&
    Boolean(onSelectSuggestion) &&
    !inputDisabled &&
    !value.trim();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!value.trim() || inputDisabled) {
      return;
    }
    onSubmit();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!value.trim() || inputDisabled) {
        return;
      }
      onSubmit();
    }
  }

  return (
    <div className="shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <form onSubmit={handleSubmit} className="px-4 py-4 sm:px-6">
        <input
          ref={transcriptInputRef}
          type="file"
          className="hidden"
          accept={CAPTURE_TRANSCRIPT_ACCEPT_ATTR}
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
          accept={CAPTURE_NOTES_ACCEPT_ATTR}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file && onAttachFile) {
              onAttachFile(file, "notes");
            }
            event.target.value = "";
          }}
        />
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
          {showSuggestions && suggestedResponses ? (
            <SuggestedResponsesBar
              options={suggestedResponses}
              disabled={inputDisabled}
              onSelect={(prefill) => onSelectSuggestion?.(prefill)}
            />
          ) : null}
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={effectivePlaceholder}
            disabled={inputDisabled}
            rows={2}
            className="min-h-[52px] resize-none"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2.5">
              {onAttachFile ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={inputDisabled}
                    className={CHAT_QUICK_ACTION_BUTTON_CLASS}
                    onClick={() => transcriptInputRef.current?.click()}
                  >
                    Attach consultation transcript
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={inputDisabled}
                    className={CHAT_QUICK_ACTION_BUTTON_CLASS}
                    onClick={() => notesInputRef.current?.click()}
                  >
                    Attach consultation notes
                  </Button>
                </>
              ) : null}
            </div>
            <Button
              type="submit"
              className="min-h-11 shrink-0"
              disabled={inputDisabled || !value.trim()}
            >
              Send
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
