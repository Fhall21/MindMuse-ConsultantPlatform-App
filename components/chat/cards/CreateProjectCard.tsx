"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCardSuccessShellProps } from "@/lib/chat/card-success-destinations";
import { CREATE_CONSULTATION_COPY } from "@/lib/chat/onboarding-copy";
import { createRound } from "@/lib/actions/rounds";
import { fetchJson } from "@/hooks/api";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import { notifyCardConfirmation } from "./notify-card-confirmation";
import type { ChatCardProps } from "./types";

interface CreateProjectCardProps extends ChatCardProps {
  onProjectCreated?: (consultationId: string) => void;
}

export function CreateProjectCard({
  messageId,
  onProjectCreated,
}: CreateProjectCardProps) {
  const confirmKey = `create-project:${messageId}`;
  const { isPending, setPending } = useCardConfirm();
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [createdLabel, setCreatedLabel] = useState<string | null>(null);
  const [createdConsultationId, setCreatedConsultationId] = useState<string | null>(null);
  const pending = isPending(confirmKey);

  async function handleCreate() {
    const trimmed = label.trim();
    if (!trimmed || pending) {
      return;
    }

    setPending(confirmKey, true);
    try {
      const consultationId = await createRound({ label: trimmed });
      const bootstrap = await fetchJson<{ sessionId: string }>("/api/chat/bootstrap");
      await fetchJson("/api/chat/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: bootstrap.sessionId,
          consultationId,
          syncOnboarding: true,
        }),
      });
      await notifyCardConfirmation(bootstrap.sessionId, "consultation_created");
      queryClient.invalidateQueries({ queryKey: ["consultations"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_stats"] });
      setCreatedLabel(trimmed);
      setCreatedConsultationId(consultationId);
      setPending(confirmKey, false);
      onProjectCreated?.(consultationId);
    } catch (error) {
      console.error(error);
      toast.error(CREATE_CONSULTATION_COPY.error);
      setPending(confirmKey, false);
    }
  }

  if (createdLabel) {
    const { successLink } = getCardSuccessShellProps("create_project", {
      consultationId: createdConsultationId,
    });
    return (
      <ChatToolCardShell
        success
        title="Consultation created"
        description={`${createdLabel} is ready.`}
        successLink={successLink}
      />
    );
  }

  return (
    <ChatToolCardShell
      title={CREATE_CONSULTATION_COPY.title}
      description={CREATE_CONSULTATION_COPY.description}
      footer={
        <Button
          type="button"
          onClick={() => void handleCreate()}
          disabled={pending || !label.trim()}
        >
          {pending ? CREATE_CONSULTATION_COPY.pending : CREATE_CONSULTATION_COPY.submit}
        </Button>
      }
    >
      <div className="space-y-2">
        <Label htmlFor={`project-label-${messageId}`}>{CREATE_CONSULTATION_COPY.label}</Label>
        <Input
          id={`project-label-${messageId}`}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={CREATE_CONSULTATION_COPY.placeholder}
          disabled={pending}
          className="h-9 text-sm"
        />
      </div>
    </ChatToolCardShell>
  );
}
