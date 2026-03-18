"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AuditExportPanel } from "@/components/audit/audit-export-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConsultationRounds } from "@/hooks/use-consultations";
import { deleteRound, createRound, updateRound } from "@/lib/actions/rounds";
import { createClient } from "@/lib/supabase/client";
import { consultationRoundSchema } from "@/lib/validations/consultation";

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const [newLabel, setNewLabel] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [editingDescription, setEditingDescription] = useState("");

  const roundsQuery = useConsultationRounds();
  const rounds = roundsQuery.data;
  const roundIds = useMemo(() => (rounds ?? []).map((round) => round.id), [rounds]);

  const consultationCountsQuery = useQuery({
    queryKey: ["consultation_rounds", "counts", roundIds],
    queryFn: async () => {
      if (roundIds.length === 0) {
        return {} as Record<string, number>;
      }

      const supabase = createClient();
      const { data, error } = await supabase
        .from("consultations")
        .select("round_id")
        .in("round_id", roundIds);

      if (error) throw error;

      return (data ?? []).reduce<Record<string, number>>((acc, row) => {
        if (!row.round_id) {
          return acc;
        }

        acc[row.round_id] = (acc[row.round_id] ?? 0) + 1;
        return acc;
      }, {});
    },
    enabled: roundIds.length > 0,
  });

  const createMutation = useMutation({
    mutationFn: (payload: { label: string; description?: string }) => createRound(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["consultation_rounds"] });
      setNewLabel("");
      setNewDescription("");
      setFormError(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; label: string; description?: string }) =>
      updateRound(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["consultation_rounds"] });
      setEditingRoundId(null);
      setEditingLabel("");
      setEditingDescription("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (roundId: string) => deleteRound(roundId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["consultation_rounds"] });
    },
  });

  const consultationCounts = consultationCountsQuery.data ?? {};

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <AuditExportPanel />

      <Card>
        <CardHeader>
          <CardTitle>Consultation Rounds</CardTitle>
          <CardDescription>
            Create and manage round labels used when filing consultations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form
            className="space-y-3 rounded-md border p-4"
            onSubmit={async (event) => {
              event.preventDefault();

              const parsed = consultationRoundSchema.safeParse({
                label: newLabel,
                description: newDescription || undefined,
              });

              if (!parsed.success) {
                setFormError(parsed.error.issues[0]?.message ?? "Invalid round details.");
                return;
              }

              await createMutation.mutateAsync(parsed.data);
            }}
          >
            <h2 className="text-sm font-medium">Add round</h2>

            <div className="space-y-2">
              <Label htmlFor="round-label">Label</Label>
              <Input
                id="round-label"
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
                placeholder="Round label"
                disabled={createMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="round-description">Description</Label>
              <Input
                id="round-description"
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                placeholder="Optional description"
                disabled={createMutation.isPending}
              />
            </div>

            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Adding..." : "Add round"}
            </Button>
          </form>

          {(rounds ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No rounds added yet.</p>
          ) : (
            <div className="space-y-3">
              {(rounds ?? []).map((round) => {
                const linkedConsultationCount = consultationCounts[round.id] ?? 0;
                const isEditing = editingRoundId === round.id;

                return (
                  <div key={round.id} className="rounded-md border p-4">
                    {isEditing ? (
                      <form
                        className="space-y-3"
                        onSubmit={async (event) => {
                          event.preventDefault();

                          const parsed = consultationRoundSchema.safeParse({
                            label: editingLabel,
                            description: editingDescription || undefined,
                          });

                          if (!parsed.success) {
                            return;
                          }

                          await updateMutation.mutateAsync({
                            id: round.id,
                            label: parsed.data.label,
                            description: parsed.data.description,
                          });
                        }}
                      >
                        <div className="space-y-2">
                          <Label htmlFor={`edit-round-label-${round.id}`}>Label</Label>
                          <Input
                            id={`edit-round-label-${round.id}`}
                            value={editingLabel}
                            onChange={(event) => setEditingLabel(event.target.value)}
                            disabled={updateMutation.isPending}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`edit-round-description-${round.id}`}>Description</Label>
                          <Input
                            id={`edit-round-description-${round.id}`}
                            value={editingDescription}
                            onChange={(event) => setEditingDescription(event.target.value)}
                            disabled={updateMutation.isPending}
                          />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button type="submit" size="sm" disabled={updateMutation.isPending}>
                            Save
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingRoundId(null);
                              setEditingLabel("");
                              setEditingDescription("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <p className="font-medium">{round.label}</p>
                          <p className="text-sm text-muted-foreground">{round.description || "-"}</p>
                          <p className="text-xs text-muted-foreground">
                            {linkedConsultationCount === 0
                              ? "-"
                              : `${linkedConsultationCount} ${
                                  linkedConsultationCount === 1
                                    ? "consultation"
                                    : "consultations"
                                }`}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingRoundId(round.id);
                              setEditingLabel(round.label);
                              setEditingDescription(round.description || "");
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={deleteMutation.isPending}
                            onClick={async () => {
                              const confirmed = window.confirm(
                                linkedConsultationCount > 0
                                  ? `Delete ${round.label}? This round is linked to ${linkedConsultationCount} consultation(s) and cannot be deleted until unlinked.`
                                  : `Delete ${round.label}?`
                              );

                              if (!confirmed) return;

                              try {
                                await deleteMutation.mutateAsync(round.id);
                              } catch (error) {
                                setFormError(
                                  error instanceof Error
                                    ? error.message
                                    : "Unable to delete round."
                                );
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
