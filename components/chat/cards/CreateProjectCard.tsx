"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CREATE_CONSULTATION_COPY } from "@/lib/chat/onboarding-copy";
import { createRound } from "@/lib/actions/rounds";
import { fetchJson } from "@/hooks/api";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import type { ChatCardProps } from "@/components/chat/cards/types";

interface CreateProjectCardProps extends ChatCardProps {
  onProjectCreated?: (consultationId: string) => void;
}

export function CreateProjectCard({
  tool: _tool,
  messageId,
  onProjectCreated,
}: CreateProjectCardProps) {
  const confirmKey = `create-project:${messageId}`;
  const { isPending, setPending } = useCardConfirm();
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
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
      queryClient.invalidateQueries({ queryKey: ["consultations"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_stats"] });
      onProjectCreated?.(consultationId);
      toast.success(CREATE_CONSULTATION_COPY.success);
    } catch (error) {
      console.error(error);
      toast.error(CREATE_CONSULTATION_COPY.error);
      setPending(confirmKey, false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 text-card-foreground">
      <p className="text-sm font-medium">{CREATE_CONSULTATION_COPY.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {CREATE_CONSULTATION_COPY.description}
      </p>
      <div className="mt-4 space-y-2">
        <Label htmlFor={`project-label-${messageId}`}>{CREATE_CONSULTATION_COPY.label}</Label>
        <Input
          id={`project-label-${messageId}`}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={CREATE_CONSULTATION_COPY.placeholder}
          disabled={pending}
        />
      </div>
      <Button
        type="button"
        className="mt-4"
        onClick={() => void handleCreate()}
        disabled={pending || !label.trim()}
      >
        {pending ? CREATE_CONSULTATION_COPY.pending : CREATE_CONSULTATION_COPY.submit}
      </Button>
    </div>
  );
}
