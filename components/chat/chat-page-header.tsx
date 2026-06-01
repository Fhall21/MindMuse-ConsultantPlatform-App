"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Consultation } from "@/types/db";

interface ChatPageHeaderProps {
  activeProject: Consultation | null;
  showNewChat: boolean;
  onNewChat: () => void;
  isCreatingSession?: boolean;
}

export function ChatPageHeader({
  activeProject,
  showNewChat,
  onNewChat,
  isCreatingSession = false,
}: ChatPageHeaderProps) {
  return (
    <div className="space-y-1 pb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Upload material, review outputs, and confirm records in one place.
          </p>
        </div>
        {showNewChat ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={isCreatingSession}
            onClick={onNewChat}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New chat
          </Button>
        ) : null}
      </div>
      {activeProject ? (
        <p className="text-xs text-muted-foreground">
          Consultation{" "}
          <span className="font-medium text-foreground">{activeProject.label}</span>
        </p>
      ) : null}
    </div>
  );
}
