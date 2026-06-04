"use client";

import { CHAT_SUGGESTED_REPLY_CHIP_CLASS } from "@/lib/chat/constants";
import type { SuggestedResponseOption } from "@/lib/chat/suggested-responses";

interface SuggestedResponsesBarProps {
  options: SuggestedResponseOption[];
  onSelect: (prefill: string) => void;
  disabled?: boolean;
}

export function SuggestedResponsesBar({
  options,
  onSelect,
  disabled = false,
}: SuggestedResponsesBarProps) {
  if (options.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 pt-1">
      <p className="sr-only" id="suggested-replies-label">
        Suggested replies
      </p>
      <div
        role="group"
        aria-labelledby="suggested-replies-label"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {options.map((option) => (
          <button
            key={`${option.label}-${option.prefill}`}
            type="button"
            disabled={disabled}
            className={CHAT_SUGGESTED_REPLY_CHIP_CLASS}
            onClick={() => onSelect(option.prefill)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
