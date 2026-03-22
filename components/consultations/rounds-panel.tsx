"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConsultations } from "@/hooks/use-consultations";
import { assignMeetingConsultation } from "@/lib/actions/consultations";

interface RoundsPanelProps {
  meetingId?: string;
  consultationId?: string;
  currentRoundId: string | null;
  currentRoundLabel: string | null;
}

export function RoundsPanel({
  meetingId,
  consultationId,
  currentRoundId,
  currentRoundLabel,
}: RoundsPanelProps) {
  const resolvedMeetingId = meetingId ?? consultationId;
  const queryClient = useQueryClient();
  const { data: rounds } = useConsultations();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);

  async function handleSelect(roundId: string | null) {
    setAssigning(roundId ?? "__clear__");
    try {
      await assignMeetingConsultation(resolvedMeetingId!, roundId);
      queryClient.invalidateQueries({ queryKey: ["meetings", resolvedMeetingId] });
      setDialogOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update consultation.");
    } finally {
      setAssigning(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="text-sm text-muted-foreground">
        {currentRoundLabel ?? "No consultation linked"}
      </span>

      <Button
        size="sm"
        variant="outline"
        onClick={() => setDialogOpen(true)}
      >
        {currentRoundId ? "Change consultation" : "Link consultation"}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Link consultation</DialogTitle>
          </DialogHeader>

          <div className="space-y-1">
            <button
              onClick={() => handleSelect(null)}
              disabled={assigning === "__clear__"}
              className="flex w-full items-center justify-between rounded px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
            >
              <span className="text-muted-foreground">No consultation</span>
              {currentRoundId === null && (
                <span className="text-xs text-muted-foreground">current</span>
              )}
            </button>

            {rounds?.map((round) => (
              <button
                key={round.id}
                onClick={() => handleSelect(round.id)}
                disabled={assigning === round.id}
                className="flex w-full items-center justify-between rounded px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
              >
                <span>{round.label}</span>
                {currentRoundId === round.id && (
                  <span className="text-xs text-muted-foreground">current</span>
                )}
              </button>
            ))}

            {(!rounds || rounds.length === 0) && (
              <p className="py-2 text-center text-sm text-muted-foreground">
                No consultations created yet. Add consultations in Settings.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
