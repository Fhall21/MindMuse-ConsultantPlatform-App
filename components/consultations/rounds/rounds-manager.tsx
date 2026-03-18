"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConsultationRounds } from "@/hooks/use-consultations";
import { deleteRound, createRound, updateRound } from "@/lib/actions/rounds";
import { createClient } from "@/lib/supabase/client";
import { consultationRoundSchema } from "@/lib/validations/consultation";

export function RoundsManager() {
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
      if (roundIds.length === 0) return {} as Record<string, number>;
      const supabase = createClient();
      const { data, error } = await supabase
        .from("consultations")
        .select("round_id")
        .in("round_id", roundIds);
      if (error) throw error;
      return (data ?? []).reduce<Record<string, number>>((acc, row) => {
        if (!row.round_id) return acc;
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
      <Card>
        <CardHeader>
          <CardTitle>Add round</CardTitle>
          <CardDescription>Create a new round label for filing consultations.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All rounds</CardTitle>
          <CardDescription>Manage existing consultation rounds.</CardDescription>
        </CardHeader>
        <CardContent>
          {roundsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : !rounds || rounds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rounds yet.</p>
          ) : (
            <div className="space-y-3">
              {rounds.map((round) => {
                const linkedCount = consultationCounts[round.id] ?? 0;
                return (
                  <div key={round.id} className="rounded-md border p-4">
                    {editingRoundId === round.id ? (
                      <form
                        className="space-y-3"
                        onSubmit={async (event) => {
                          event.preventDefault();
                          const parsed = consultationRoundSchema.safeParse({
                            label: editingLabel,
                            description: editingDescription || undefined,
                          });
                          if (!parsed.success) {
                            setFormError(
                              parsed.error.issues[0]?.message ?? "Invalid round details."
                            );
                            return;
                          }
                          await updateMutation.mutateAsync({ id: round.id, ...parsed.data });
                        }}
                      >
                        <div className="space-y-2">
                          <Label htmlFor={`edit-label-${round.id}`}>Label</Label>
                          <Input
                            id={`edit-label-${round.id}`}
                            value={editingLabel}
                            onChange={(event) => setEditingLabel(event.target.value)}
                            disabled={updateMutation.isPending}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`edit-desc-${round.id}`}>Description</Label>
                          <Input
                            id={`edit-desc-${round.id}`}
                            value={editingDescription}
                            onChange={(event) => setEditingDescription(event.target.value)}
                            disabled={updateMutation.isPending}
                          />
                        </div>
                        {formError ? (
                          <p className="text-sm text-destructive">{formError}</p>
                        ) : null}
                        <div className="flex gap-2">
                          <Button type="submit" size="sm" disabled={updateMutation.isPending}>
                            {updateMutation.isPending ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingRoundId(null);
                              setFormError(null);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium">{round.label}</p>
                          {round.description ? (
                            <p className="text-sm text-muted-foreground">{round.description}</p>
                          ) : null}
                          <p className="text-xs text-muted-foreground">
                            {linkedCount} consultation{linkedCount !== 1 ? "s" : ""} linked
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingRoundId(round.id);
                              setEditingLabel(round.label);
                              setEditingDescription(round.description ?? "");
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
                                linkedCount > 0
                                  ? `Delete "${round.label}"? This round is linked to ${linkedCount} consultation(s) and cannot be deleted until unlinked.`
                                  : `Delete "${round.label}"?`
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
