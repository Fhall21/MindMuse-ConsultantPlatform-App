"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, PencilLine, RotateCcw, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { RoundDecisionHistoryItem, RoundDetailConsultation, RoundAnalyticsSummary } from "@/types/round-detail";
import {
  isAnalyticsJobActive,
  useAnalyticsClusterDecision,
  useRoundAnalyticsJobs,
  useTriggerRoundAnalyticsJobs,
} from "@/hooks/use-analytics";

type AnalyticsPanelState = "idle" | "queued" | "running" | "failed" | "complete";

interface AnalyticsPanelProps {
  roundId: string;
  roundLabel: string;
  consultations: RoundDetailConsultation[];
  analytics: RoundAnalyticsSummary;
  decisionHistory: RoundDecisionHistoryItem[];
}

interface ClusterDecisionDraft {
  clusterId: number;
  mode: "reject" | "edit";
}

const stateConfig: Record<
  AnalyticsPanelState,
  { label: string; className: string; icon: typeof Clock3 }
> = {
  idle: {
    label: "Idle",
    className: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300",
    icon: Clock3,
  },
  queued: {
    label: "Queued",
    className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
    icon: Loader2,
  },
  running: {
    label: "Running",
    className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
    icon: Loader2,
  },
  failed: {
    label: "Failed",
    className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
    icon: AlertTriangle,
  },
  complete: {
    label: "Complete",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    icon: CheckCircle2,
  },
};

const decisionBadgeConfig: Record<
  string,
  { label: string; className: string }
> = {
  accepted: {
    label: "Accepted",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  rejected: {
    label: "Rejected",
    className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
  },
  edited: {
    label: "Edited",
    className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
  },
  pending: {
    label: "Suggestion",
    className: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300",
  },
};

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleString();
}

function getDecisionActionLabel(decision: RoundDecisionHistoryItem | null) {
  if (!decision) {
    return null;
  }

  const action =
    typeof decision.metadata?.analytics_decision_action === "string"
      ? decision.metadata.analytics_decision_action
      : null;

  if (action === "reject") {
    return "rejected";
  }

  if (action === "edit") {
    return "edited";
  }

  return decision.decisionType === "management_rejected" ? "rejected" : "accepted";
}

function getPanelState(analytics: RoundAnalyticsSummary, hasActiveJobs: boolean): AnalyticsPanelState {
  if (hasActiveJobs) {
    if (analytics.latestJobStatus?.phase === "queued") {
      return "queued";
    }

    return "running";
  }

  if (analytics.latestJobStatus?.phase === "failed") {
    return "failed";
  }

  if (analytics.clusterCount > 0 || analytics.processedConsultationCount > 0) {
    return "complete";
  }

  return "idle";
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-background/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function ClusterTerms({ terms }: { terms: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {terms.slice(0, 6).map((term) => (
        <Badge key={term} variant="secondary" className="rounded-full">
          {term}
        </Badge>
      ))}
      {terms.length > 6 ? (
        <Badge variant="outline" className="rounded-full">
          +{terms.length - 6} more
        </Badge>
      ) : null}
    </div>
  );
}

export function getAnalyticsPanelState(
  analytics: RoundAnalyticsSummary,
  hasActiveJobs: boolean
) {
  return getPanelState(analytics, hasActiveJobs);
}

export function AnalyticsPanel({
  roundId,
  roundLabel,
  consultations,
  analytics,
  decisionHistory,
}: AnalyticsPanelProps) {
  const queryClient = useQueryClient();
  const roundJobsQuery = useRoundAnalyticsJobs(roundId);
  const triggerRoundAnalyticsMutation = useTriggerRoundAnalyticsJobs(roundId);
  const analyticsDecisionMutation = useAnalyticsClusterDecision(roundId);
  const [pendingDecision, setPendingDecision] = useState<ClusterDecisionDraft | null>(null);
  const [decisionRationale, setDecisionRationale] = useState("");
  const [editedLabel, setEditedLabel] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const consultationLabelById = useMemo(
    () => new Map(consultations.map((consultation) => [consultation.id, consultation.title])),
    [consultations]
  );

  const hasActiveJobs = Boolean(roundJobsQuery.data?.data.some((job) => isAnalyticsJobActive(job.jobStatus)));
  const panelState = getPanelState(analytics, hasActiveJobs);
  const statusConfig = stateConfig[panelState];
  const StatusIcon = statusConfig.icon;

  useEffect(() => {
    if (!roundJobsQuery.data) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ["consultation_rounds", roundId, "detail"] });
  }, [queryClient, roundId, roundJobsQuery.data]);

  const clusterDecisionById = useMemo(() => {
    const map = new Map<string, RoundDecisionHistoryItem>();

    for (const decision of decisionHistory) {
      const metadataClusterId =
        typeof decision.metadata?.analytics_cluster_record_id === "string"
          ? decision.metadata.analytics_cluster_record_id
          : null;
      const key = metadataClusterId ?? decision.targetId;
      const existing = map.get(key);

      if (!existing || existing.timestamp < decision.timestamp) {
        map.set(key, decision);
      }
    }

    return map;
  }, [decisionHistory]);

  async function handleTriggerRoundAnalytics() {
    setErrorMessage(null);

    try {
      const result = await triggerRoundAnalyticsMutation.mutateAsync();
      toast.success(result.jobCount > 1 ? `${result.jobCount} analytics jobs queued` : "Analytics job queued");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to queue analytics run";
      setErrorMessage(message);
      toast.error(message);
    }
  }

  async function handleClusterDecision(
    clusterId: number,
    action: "accept" | "reject" | "edit"
  ) {
    setErrorMessage(null);

    try {
      const payload =
        action === "accept"
          ? { clusterId, action }
          : action === "reject"
            ? { clusterId, action, rationale: decisionRationale }
            : { clusterId, action, editedLabel };

      await analyticsDecisionMutation.mutateAsync(payload);
      toast.success(
        action === "accept"
          ? "Cluster suggestion accepted"
          : action === "reject"
            ? "Cluster suggestion rejected"
            : "Cluster suggestion edited"
      );
      setPendingDecision(null);
      setDecisionRationale("");
      setEditedLabel("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save cluster decision";
      setErrorMessage(message);
      toast.error(message);
    }
  }

  function renderDecisionBadge(decision: RoundDecisionHistoryItem | null) {
    const label = getDecisionActionLabel(decision);
    const config = label ? decisionBadgeConfig[label] : decisionBadgeConfig.pending;

    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  }

  return (
    <Card className="overflow-hidden border-border/70">
      <CardHeader className="space-y-4 bg-gradient-to-r from-slate-950 to-slate-800 text-slate-50">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base text-slate-50">Analytics</CardTitle>
              <Badge variant="outline" className="border-white/20 bg-white/10 text-slate-50">
                Suggestion only
              </Badge>
              <Badge variant="outline" className={cn("border-white/20 bg-white/10 text-slate-50", statusConfig.className)}>
                <StatusIcon className="mr-1 h-3.5 w-3.5" />
                {statusConfig.label}
              </Badge>
            </div>
            <CardDescription className="max-w-2xl text-slate-300">
              AI-generated cluster suggestions for {roundLabel}. Every acceptance, rejection, or edit
              remains explicit and auditable.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleTriggerRoundAnalytics()}
              disabled={triggerRoundAnalyticsMutation.isPending}
            >
              {triggerRoundAnalyticsMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {analytics.clusterCount > 0 ? "Refresh analytics" : "Run analytics"}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <StatTile label="Consultations" value={analytics.consultationCount} />
          <StatTile label="Processed" value={analytics.processedConsultationCount} />
          <StatTile label="Active" value={analytics.activeConsultationCount} />
          <StatTile label="Failed" value={analytics.failedConsultationCount} />
          <StatTile label="Terms" value={analytics.totalTermCount} />
          <StatTile label="Outliers" value={analytics.outlierTermCount} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-6">
        {errorMessage ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            {errorMessage}
          </div>
        ) : null}

        {roundJobsQuery.isError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            Could not load analytics job statuses. Use refresh to retry.
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Job lifecycle</CardTitle>
              <CardDescription>
                {panelState === "idle"
                  ? "No analytics job has been triggered for this round yet."
                  : panelState === "failed"
                    ? "The latest run failed. Review the error and retry when ready."
                    : panelState === "complete"
                      ? "The latest run completed successfully."
                      : "Analytics processing is in flight. Polling stops automatically when the run finishes."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <StatTile label="Latest clustered at" value={formatDateTime(analytics.latestClusteredAt)} />
                <StatTile label="Last extraction" value={formatDateTime(analytics.latestExtractionAt)} />
                <StatTile label="Latest job phase" value={analytics.latestJobStatus?.phase ?? "none"} />
                <StatTile label="Average confidence" value={analytics.averageExtractionConfidence ?? "n/a"} />
              </div>

              {analytics.latestJobStatus ? (
                <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">Latest run</p>
                      <p className="text-muted-foreground">
                        {analytics.latestJobStatus.phase} · {Math.max(analytics.latestJobStatus.progress, 0)}%
                      </p>
                    </div>
                    <Badge variant="outline" className={statusConfig.className}>
                      {statusConfig.label}
                    </Badge>
                  </div>
                  {analytics.latestJobStatus.errorMessage ? (
                    <p className="mt-3 text-sm text-red-700 dark:text-red-300">
                      {analytics.latestJobStatus.errorMessage}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {panelState === "idle" ? (
                <div className="rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground">
                  This round has not been analyzed yet. Trigger analytics to start explainable
                  extraction, clustering, and suggestion generation.
                </div>
              ) : null}

              {panelState === "failed" ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">Analytics failed</p>
                      <p>
                        Retry the job after checking the error above. No suggestions were auto-accepted.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleTriggerRoundAnalytics()}
                      disabled={triggerRoundAnalyticsMutation.isPending}
                    >
                      {triggerRoundAnalyticsMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="mr-2 h-4 w-4" />
                      )}
                      Retry
                    </Button>
                  </div>
                </div>
              ) : null}

              {roundJobsQuery.data?.data.length ? (
                <div className="space-y-2">
                  {roundJobsQuery.data.data.map((entry) => {
                    const consultationTitle = consultationLabelById.get(entry.consultationId) ?? entry.consultationId;
                    const job = entry.jobStatus;
                    const active = isAnalyticsJobActive(job);
                    const failed = job?.phase === "failed";
                    const done = job?.phase === "complete";

                    return (
                      <div
                        key={entry.consultationId}
                        className={cn(
                          "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3",
                          active ? "border-blue-200 bg-blue-50/60" : failed ? "border-red-200 bg-red-50/60" : "bg-background"
                        )}
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{consultationTitle}</p>
                          <p className="text-xs text-muted-foreground">
                            {job ? `${job.phase} · ${Math.max(job.progress, 0)}%` : "No job yet"}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            active
                              ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
                              : failed
                                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                                : done
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300"
                          )}
                        >
                          {job?.phase ?? "idle"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Evidence summary</CardTitle>
              <CardDescription>
                The analytics summary keeps extraction provenance, clustering, and noise visible.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <StatTile label="Clusters" value={analytics.clusterCount} />
                <StatTile label="Latest job" value={analytics.latestJobStatus?.phase ?? "none"} />
              </div>

              {analytics.clusterCount === 0 ? (
                <div className="rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground">
                  No clusters are available yet. Outlier-heavy runs will still surface here once the
                  pipeline completes.
                </div>
              ) : (
                <div className="space-y-2">
                  {analytics.clusters.map((cluster) => (
                    <div key={cluster.clusterId} className="rounded-lg border px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold">{cluster.label}</p>
                            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                              Suggestion
                            </Badge>
                            {renderDecisionBadge(clusterDecisionById.get(cluster.clusterId.toString()) ?? null)}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {cluster.consultationCount} consultation{cluster.consultationCount !== 1 ? "s" : ""} represented
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={analyticsDecisionMutation.isPending}
                            onClick={() => void handleClusterDecision(cluster.clusterId, "accept")}
                          >
                            <ThumbsUp className="mr-2 h-4 w-4" />
                            Accept
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={analyticsDecisionMutation.isPending}
                            onClick={() => {
                              setPendingDecision({ clusterId: cluster.clusterId, mode: "reject" });
                              setDecisionRationale("");
                              setEditedLabel("");
                            }}
                          >
                            <ThumbsDown className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={analyticsDecisionMutation.isPending}
                            onClick={() => {
                              setPendingDecision({ clusterId: cluster.clusterId, mode: "edit" });
                              setEditedLabel(cluster.label);
                              setDecisionRationale("");
                            }}
                          >
                            <PencilLine className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3 space-y-3">
                        <ClusterTerms terms={cluster.representativeTerms.length > 0 ? cluster.representativeTerms : cluster.allTerms} />

                        {cluster.allTerms.length > cluster.representativeTerms.length ? (
                          <p className="text-xs text-muted-foreground">
                            All terms: {cluster.allTerms.slice(0, 8).join(", ")}
                            {cluster.allTerms.length > 8 ? "…" : ""}
                          </p>
                        ) : null}

                        {pendingDecision?.clusterId === cluster.clusterId ? (
                          <div className="rounded-lg border border-dashed bg-muted/20 p-4">
                            {pendingDecision.mode === "reject" ? (
                              <div className="space-y-3">
                                <div className="space-y-1">
                                  <Label htmlFor={`reject-rationale-${cluster.clusterId}`}>Rejection rationale</Label>
                                  <Textarea
                                    id={`reject-rationale-${cluster.clusterId}`}
                                    value={decisionRationale}
                                    onChange={(event) => setDecisionRationale(event.target.value)}
                                    placeholder="Why is this suggestion not useful?"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => void handleClusterDecision(cluster.clusterId, "reject")}
                                    disabled={analyticsDecisionMutation.isPending}
                                  >
                                    Confirm reject
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setPendingDecision(null);
                                      setDecisionRationale("");
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="space-y-1">
                                  <Label htmlFor={`edit-label-${cluster.clusterId}`}>Edited label</Label>
                                  <Input
                                    id={`edit-label-${cluster.clusterId}`}
                                    value={editedLabel}
                                    onChange={(event) => setEditedLabel(event.target.value)}
                                    placeholder="Refined cluster label"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label htmlFor={`edit-rationale-${cluster.clusterId}`}>Optional rationale</Label>
                                  <Textarea
                                    id={`edit-rationale-${cluster.clusterId}`}
                                    value={decisionRationale}
                                    onChange={(event) => setDecisionRationale(event.target.value)}
                                    placeholder="Why does this label better fit the evidence?"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => void handleClusterDecision(cluster.clusterId, "edit")}
                                    disabled={analyticsDecisionMutation.isPending || editedLabel.trim().length === 0}
                                  >
                                    Save edit
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setPendingDecision(null);
                                      setDecisionRationale("");
                                      setEditedLabel("");
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {analytics.outlierTermCount > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  {analytics.outlierTermCount} outlier term{analytics.outlierTermCount !== 1 ? "s" : ""} were kept separate from clusters.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Separator />

        <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          Consultant decision history remains explicit: cluster suggestions are never auto-accepted, and
          each mutation is written to the audit trail.
        </div>
      </CardContent>
    </Card>
  );
}