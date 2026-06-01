"use client";

import React from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatPageHeaderProps {
  view: "home" | "chat";
  sessionPreview?: string | null;
  onBackToHome?: () => void;
  rightSlot?: React.ReactNode;
}

export function ChatPageHeader({
  view,
  sessionPreview,
  onBackToHome,
  rightSlot,
}: ChatPageHeaderProps) {
  if (view === "home") {
    if (!rightSlot) return null;
    return (
      <div className="flex items-center justify-end pb-4">
        {rightSlot}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 pb-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        onClick={onBackToHome}
      >
        <ArrowLeft className="h-4 w-4" />
        Conversations
      </Button>
      {sessionPreview ? (
        <span className="min-w-0 truncate text-sm text-muted-foreground/60">
          {sessionPreview}
        </span>
      ) : null}
      {rightSlot ? <div className="ml-auto">{rightSlot}</div> : null}
    </div>
  );
}
