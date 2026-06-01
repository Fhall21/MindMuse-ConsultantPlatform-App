"use client";

import { useConsultations } from "@/hooks/use-consultations";
import { fetchJson } from "@/hooks/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import type { ChatCardProps } from "@/components/chat/cards/types";

interface ProjectSelectionCardProps extends ChatCardProps {
  sessionId: string;
  onConsultationSelected?: (consultationId: string) => void;
}

export function ProjectSelectionCard({
  tool: _tool,
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
      onConsultationSelected?.(consultationId);
    } catch (error) {
      console.error(error);
      setPending(confirmKey, false);
    }
  }

  if (consultationsQuery.isLoading) {
    return (
      <div className="space-y-2 rounded-lg border bg-card p-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  const consultations = consultationsQuery.data ?? [];

  if (consultations.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-4 text-card-foreground">
        <p className="text-sm text-muted-foreground">
          No consultation projects yet. Create one above to continue.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4 text-card-foreground">
      <p className="text-sm font-medium">Which project should we work on?</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Select a consultation to scope this conversation.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {consultations.map((consultation) => {
          const confirmKey = `select-project:${messageId}:${consultation.id}`;
          const pending = isPending(confirmKey);
          return (
            <Button
              key={consultation.id}
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => void selectProject(consultation.id)}
            >
              {pending ? "Selecting…" : consultation.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
