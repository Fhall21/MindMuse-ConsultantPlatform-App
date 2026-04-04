"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fetchJson } from "@/hooks/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConsultations } from "@/hooks/use-consultations";
import { deleteRound, createRound, updateRound } from "@/lib/actions/rounds";
import { consultationSchema as consultationRoundSchema } from "@/lib/validations/consultation";

export function RoundsManager() {
  const queryClient = useQueryClient();

  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingError, setEditingError] = useState<string | null>(null);

  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [editingDescription, setEditingDescription] = useState("");

  const roundsQuery = useConsultations();
  const rounds = roundsQuery.data;
  const roundIds = useMemo(() => (rounds ?? []).map((round) => round.id), [rounds]);

  const consultationCountsQuery = useQuery({
    queryKey: ["consultation_rounds", "counts", roundIds],
    queryFn: () =>
      fetchJson<Record<string, number>>("/api/client/consultations/consultation-counts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: roundIds }),
      }),
    enabled: roundIds.length > 0,
  });

  const createMutation = useMutation({
    mutationFn: (payload: { label: string; description?: string }) => createRound(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["consultations"] });
      setNewLabel("");
      setNewDescription("");
      setCreateError(null);
      setIsCreateFormOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; label: string; description?: string }) =>
      updateRound(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["consultations"] });
      setEditingRoundId(null);
      setEditingLabel("");
      setEditingDescription("");
      setEditingError(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (roundId: string) => deleteRound(roundId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["consultations"] });
    },
  });

  const consultationCounts = consultationCountsQuery.data ?? {};
  const hasNoRounds = !roundsQuery.isLoading && (!rounds || rounds.length === 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Consultation rounds</CardTitle>
            <CardDescription>
              Keep recurring consultation cycles clearly labeled so records stay organised.
            </CardDescription>
          </div>
          <Button
            type="button"
            onClick={() => {
              setIsCreateFormOpen(true);
              setCreateError(null);
            }}
          >
            Create Round
          </Button>
        </CardHeader>
        <CardContent>
          {isCreateFormOpen ? (
            <form
              className="space-y-4 rounded-xl border bg-muted/20 p-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const parsed = consultationRoundSchema.safeParse({
                  label: newLabel,
                  description: newDescription || undefined,
                });
                if (!parsed.success) {
                  setCreateError(parsed.error.issues[0]?.message ?? "Invalid round details.");
                  return;
                }
                await createMutation.mutateAsync(parsed.data);
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="round-label">Label</Label>
                  <Input
                    id="round-label"
                    value={newLabel}
                    onChange={(event) => setNewLabel(event.target.value)}
                    placeholder="Initial consultation"
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
              </div>
              {createError ? <p className="text-sm text-destructive">{createError}</p> : null}
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Round"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={createMutation.isPending}
                  onClick={() => {
                    setIsCreateFormOpen(false);
                    setCreateError(null);
                    setNewLabel("");
                    setNewDescription("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              Rounds are a reusable labels for stages of consultation work.
            </p>
          )}
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
          ) : hasNoRounds ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="mb-4 text-sm text-muted-foreground">
                No consultation rounds yet.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateFormOpen(true);
                  setCreateError(null);
                }}
              >
                Create Round
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {rounds?.map((round) => {
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
                            setEditingError(
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
                        {editingError ? (
                          <p className="text-sm text-destructive">{editingError}</p>
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
                              setEditingError(null);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="space-y-4">
                        {/* Info row — management actions are secondary icon-only buttons */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 space-y-1">
                            <p className="text-sm font-semibold text-foreground">{round.label}</p>
                            {round.description ? (
                              <p className="text-sm text-muted-foreground">{round.description}</p>
                            ) : null}
                            <p className="text-xs text-muted-foreground">
                              {linkedCount} consultation{linkedCount !== 1 ? "s" : ""} linked
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground"
                              onClick={() => {
                                setEditingRoundId(round.id);
                                setEditingLabel(round.label);
                                setEditingDescription(round.description ?? "");
                                setEditingError(null);
                              }}
                              aria-label="Edit round"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
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
                                  setEditingError(
                                    error instanceof Error
                                      ? error.message
                                      : "Unable to delete round."
                                  );
                                }
                              }}
                              aria-label="Delete round"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Primary CTA — dominant, changes based on whether meetings exist */}
                        <div className="flex flex-col items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-4 md:flex-row md:items-center md:justify-between">
                          <p className="text-sm text-muted-foreground">
                            {linkedCount === 0
                              ? "No meetings yet — create the first one to start building the evidence trail."
                              : `${linkedCount} meeting${linkedCount !== 1 ? "s" : ""} linked — open to view themes, analysis, and reports.`}
                          </p>
                          <Button asChild className="shrink-0 gap-2 self-start md:self-auto">
                            <Link
                              href={
                                linkedCount === 0
                                  ? `/meetings/new?consultationId=${round.id}`
                                  : `/consultations/rounds/${round.id}`
                              }
                            >
                              {linkedCount === 0 ? "Create first meeting" : "View themes and analysis"}
                              <ArrowRight className="h-4 w-4" />
                            </Link>
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
