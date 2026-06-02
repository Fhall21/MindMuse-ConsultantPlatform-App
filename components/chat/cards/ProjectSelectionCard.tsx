"use client";

import { useConsultations } from "@/hooks/use-consultations";
import { fetchJson } from "@/hooks/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import { CHAT_QUICK_ACTION_BUTTON_CLASS } from "@/lib/chat/constants";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import { notifyCardConfirmation } from "./notify-card-confirmation";
import type { ChatCardProps } from "./types";

interface ProjectSelectionCardProps extends ChatCardProps {
  sessionId: string;
  onConsultationSelected?: (consultationId: string) => void;
}

export function ProjectSelectionCard({
  messageId,
  sessionId,
  onConsultationSelected,
}: ProjectSelectionCardProps) {
  const consultationsQuery = useConsultations();
  const { isPending, setPending } = useCardConfirm();

  async function selectProject(consultationId: string) {
    const confirmKey = `select-project:${messageId}:${consultationId}`;
    if (isPending(confirmKey)) {
      return;
    }

    setPending(confirmKey, true);
    try {
      await fetchJson("/api/chat/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, consultationId }),
      });
      await notifyCardConfirmation(sessionId, "consultation_selected");
      onConsultationSelected?.(consultationId);
    } catch (error) {
      console.error(error);
      setPending(confirmKey, false);
    }
  }

  if (consultationsQuery.isLoading) {
    return (
      <ChatToolCardShell title="Choose a consultation" description="Loading your consultations…">
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </ChatToolCardShell>
    );
  }

  const consultations = consultationsQuery.data ?? [];

  if (consultations.length === 0) {
    return (
      <ChatToolCardShell
        title="Choose a consultation"
        description="No consultation projects yet. Create one above to continue."
      />
    );
  }

  return (
    <ChatToolCardShell
      title="Which project should we work on?"
      description="Select a consultation to scope this conversation."
    >
      <div className="flex flex-wrap gap-2">
        {consultations.map((consultation) => {
          const confirmKey = `select-project:${messageId}:${consultation.id}`;
          const pending = isPending(confirmKey);
          return (
            <Button
              key={consultation.id}
              type="button"
              variant="outline"
              className={CHAT_QUICK_ACTION_BUTTON_CLASS}
              disabled={pending}
              onClick={() => void selectProject(consultation.id)}
            >
              {pending ? "Selecting…" : consultation.label}
            </Button>
          );
        })}
      </div>
    </ChatToolCardShell>
  );
}
