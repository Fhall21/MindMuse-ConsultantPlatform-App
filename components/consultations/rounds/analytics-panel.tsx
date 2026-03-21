"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  PencilLine,
  RotateCcw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Lightbulb,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  RoundDecisionHistoryItem,
  RoundDetailConsultation,
  RoundAnalyticsSummary,
} from "@/types/round-detail";
import {
  isAnalyticsJobActive,
  useAnalyticsClusterDecision,
  useRoundAnalyticsJobs,
  useTriggerRoundAnalyticsJobs,
} from "@/hooks/use-analytics";
import { addAnalyticsClusterAsInsight } from "@/lib/actions/analytics-insights";

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

function getPanelState(
  analytics: RoundAnalyticsSummary,
  hasActiveJobs: boolean
): AnalyticsPanelState {
  if (hasActiveJobs) {
    if (analytics.latestJobStatus?.phase === "queued") return "queued";
    return "running";
  }
  if (analytics.latestJobStatus?.phase === "failed") return "failed";
  if (analytics.clusterCount > 0 || analytics.processedConsultationCount > 0) return "complete";
  return "idle";
}

export function getAnalyticsPanelState(
  analytics: RoundAnalyticsSummary,
  hasActiveJobs: boolean
) {
  return getPanelState(analytics, hasActiveJobs);
}

function StatusPill({ state }: { state: AnalyticsPanelState }) {
  if (state === "idle") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock3 className="h-3.5 w-3.5" />
        Not run
      </span>
    );
  }
  if (state === "queued") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Queued
      </span>
    );
  }
  if (state === "running") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Running
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
        <AlertTriangle className="h-3.5 w-3.5" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Complete
    </span>
  );
}

function getDecisionActionLabel(decision: RoundDecisionHistoryItem | null) {
  if (!decision) return null;
  const action =
    typeof decision.metadata?.analytics_decision_action === "string"
      ? decision.metadata.analytics_decision_action
      : null;
  if (action === "reject") return "rejected";
  if (action === "edit") return "edited";
  return decision.decisionType === "management_rejected" ? "rejected" : "accepted";
}

function DecisionBadge({ decision }: { decision: RoundDecisionHistoryItem | null }) {
  const label = getDecisionActionLabel(decision);
  if (!label || label === "accepted") {
    return (
      <Badge variant="secondary" className="text-xs font-normal">
        {label === "accepted" ? "Accepted" : "Suggestion"}
      </Badge>
    );
  }
  if (label === "rejected") {
    return (
      <Badge variant="outline" className="border-destructive/30 text-destructive text-xs font-normal">
        Rejected
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs font-normal">
      Edited
    </Badge>
  );
}

export function AnalyticsPanel({
  roundId,
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
  const [isPending, startTransition] = useTransition();
  const [convertedClusters, setConvertedClusters] = useState<Set<number>>(new Set());

  const consultationLabelById = useMemo(
    () => new Map(consultations.map((c) => [c.id, c.title])),
    [consultations]
  );

  const hasActiveJobs = Boolean(
    roundJobsQuery.data?.data.some((job) => isAnalyticsJobActive(job.jobStatus))
  );
  const panelState = getPanelState(analytics, hasActiveJobs);

  useEffect(() => {
    if (!roundJobsQuery.data) return;
    void queryClient.invalidateQueries({
      queryKey: ["consultation_rounds", roundId, "detail"],
    });
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
      toast.success(
        result.jobCount > 1
          ? `${result.jobCount} analytics jobs queued`
          : "Analytics job queued"
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to queue analytics run";
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
      const message =
        error instanceof Error ? error.message : "Failed to save cluster decision";
      setErrorMessage(message);
      toast.error(message);
    }
  }

  async function handleAddAsInsight(clusterId: number) {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const result = await addAnalyticsClusterAsInsight(roundId, clusterId);
        setConvertedClusters((prev) => new Set([...prev, clusterId]));
        toast.success("Insight created and added to theme grouping", {
          description: result.clusterLabel,
        });
        // Invalidate round detail query to refresh theme grouping
        await queryClient.invalidateQueries({
          queryKey: ["consultation_rounds", roundId, "detail"],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create insight";
        setErrorMessage(message);
        toast.error(message);
      }
    });
  }

  const progress = analytics.latestJobStatus
    ? Math.max(0, Math.min(100, analytics.latestJobStatus.progress))
    : 0;

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatusPill state={panelState} />
          {(panelState === "running" || panelState === "queued") &&
          analytics.latestJobStatus ? (
            <span className="text-xs text-muted-foreground">
              {analytics.latestJobStatus.phase}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {panelState === "failed" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleTriggerRoundAnalytics()}
              disabled={triggerRoundAnalyticsMutation.isPending}
            >
              {triggerRoundAnalyticsMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Retry
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleTriggerRoundAnalytics()}
              disabled={
                triggerRoundAnalyticsMutation.isPending ||
                panelState === "queued" ||
                panelState === "running"
              }
            >
              {triggerRoundAnalyticsMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              {analytics.clusterCount > 0 ? "Re-run analytics" : "Run analytics"}
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar — only visible while active */}
      {(panelState === "running" || panelState === "queued") ? (
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary/60 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}

      {/* Error banners */}
      {errorMessage ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      {roundJobsQuery.isError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Could not load job statuses.
        </p>
      ) : null}

      {analytics.latestJobStatus?.errorMessage ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {analytics.latestJobStatus.errorMessage}
        </p>
      ) : null}

      {/* Idle state */}
      {panelState === "idle" ? (
        <p className="text-sm text-muted-foreground">
          No analytics have been run for this round yet. Run analytics to generate
          cluster suggestions from extraction data.
        </p>
      ) : null}

      {/* Stats row — visible once there is data */}
      {panelState !== "idle" ? (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            <span className="font-medium">{analytics.clusterCount}</span>
            <span className="ml-1 text-muted-foreground">
              cluster{analytics.clusterCount !== 1 ? "s" : ""}
            </span>
          </span>
          <span>
            <span className="font-medium">{analytics.totalTermCount}</span>
            <span className="ml-1 text-muted-foreground">terms</span>
          </span>
          <span>
            <span className="font-medium">{analytics.processedConsultationCount}</span>
            <span className="ml-1 text-muted-foreground">
              of {analytics.consultationCount} consultations processed
            </span>
          </span>
          {analytics.outlierTermCount > 0 ? (
            <span>
              <span className="font-medium">{analytics.outlierTermCount}</span>
              <span className="ml-1 text-muted-foreground">outliers</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Per-consultation job list — only while active */}
      {(panelState === "running" || panelState === "queued") &&
      roundJobsQuery.data?.data.length ? (
        <div className="space-y-1.5">
          {roundJobsQuery.data.data.map((entry) => {
            const title =
              consultationLabelById.get(entry.consultationId) ?? entry.consultationId;
            const job = entry.jobStatus;
            const active = isAnalyticsJobActive(job);
            const failed = job?.phase === "failed";

            return (
              <div
                key={entry.consultationId}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <span className={cn("truncate", !active && !failed && "text-muted-foreground")}>
                  {title}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-xs",
                    active
                      ? "text-blue-600 dark:text-blue-400"
                      : failed
                        ? "text-destructive"
                        : "text-muted-foreground"
                  )}
                >
                  {job ? `${job.phase} · ${Math.max(job.progress, 0)}%` : "idle"}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Cluster list */}
      {analytics.clusterCount > 0 ? (
        <div className="space-y-3">
          <Separator />
          {analytics.clusters.map((cluster) => {
            const decision =
              clusterDecisionById.get(cluster.clusterId.toString()) ?? null;
            const terms =
              cluster.representativeTerms.length > 0
                ? cluster.representativeTerms
                : cluster.allTerms;
            const isPending = pendingDecision?.clusterId === cluster.clusterId;

            return (
              <div key={cluster.clusterId} className="space-y-2.5 rounded-md border px-4 py-3">
                {/* Cluster header */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{cluster.label}</p>
                      <DecisionBadge decision={decision} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {cluster.consultationCount}{" "}
                      {cluster.consultationCount !== 1
                        ? "consultations"
                        : "consultation"}{" "}
                      · {terms.length} term{terms.length !== 1 ? "s" : ""}
                    </p>
                  </div>

                  {!isPending ? (
                    <div className="flex items-center gap-1.5">
                      {!convertedClusters.has(cluster.clusterId) && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => void handleAddAsInsight(cluster.clusterId)}
                          title="Create a cross-consultation insight and theme group from this cluster"
                        >
                          <Lightbulb className="mr-1.5 h-3.5 w-3.5" />
                          Add as Insight
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={analyticsDecisionMutation.isPending}
                        onClick={() =>
                          void handleClusterDecision(cluster.clusterId, "accept")
                        }
                      >
                        <ThumbsUp className="mr-1.5 h-3.5 w-3.5" />
                        Accept
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={analyticsDecisionMutation.isPending}
                        onClick={() => {
                          setPendingDecision({
                            clusterId: cluster.clusterId,
                            mode: "reject",
                          });
                          setDecisionRationale("");
                          setEditedLabel("");
                        }}
                      >
                        <ThumbsDown className="mr-1.5 h-3.5 w-3.5" />
                        Reject
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={analyticsDecisionMutation.isPending}
                        onClick={() => {
                          setPendingDecision({
                            clusterId: cluster.clusterId,
                            mode: "edit",
                          });
                          setEditedLabel(cluster.label);
                          setDecisionRationale("");
                        }}
                      >
                        <PencilLine className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </div>
                  ) : null}
                </div>

                {/* Representative terms */}
                <p className="text-xs text-muted-foreground">
                  {terms.slice(0, 8).join(", ")}
                  {terms.length > 8 ? `, +${terms.length - 8} more` : ""}
                </p>

                {/* Inline decision form */}
                {isPending ? (
                  <div className="space-y-3 rounded-md border border-dashed p-3">
                    {pendingDecision.mode === "reject" ? (
                      <>
                        <div className="space-y-1">
                          <Label
                            htmlFor={`reject-rationale-${cluster.clusterId}`}
                            className="text-xs"
                          >
                            Rejection rationale
                          </Label>
                          <Textarea
                            id={`reject-rationale-${cluster.clusterId}`}
                            value={decisionRationale}
                            onChange={(e) => setDecisionRationale(e.target.value)}
                            placeholder="Why is this suggestion not useful?"
                            className="text-sm"
                            rows={2}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              void handleClusterDecision(cluster.clusterId, "reject")
                            }
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
                      </>
                    ) : (
                      <>
                        <div className="space-y-1">
                          <Label
                            htmlFor={`edit-label-${cluster.clusterId}`}
                            className="text-xs"
                          >
                            Edited label
                          </Label>
                          <Input
                            id={`edit-label-${cluster.clusterId}`}
                            value={editedLabel}
                            onChange={(e) => setEditedLabel(e.target.value)}
                            placeholder="Refined cluster label"
                            className="text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label
                            htmlFor={`edit-rationale-${cluster.clusterId}`}
                            className="text-xs"
                          >
                            Rationale (optional)
                          </Label>
                          <Textarea
                            id={`edit-rationale-${cluster.clusterId}`}
                            value={decisionRationale}
                            onChange={(e) => setDecisionRationale(e.target.value)}
                            placeholder="Why does this label better fit the evidence?"
                            className="text-sm"
                            rows={2}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              void handleClusterDecision(cluster.clusterId, "edit")
                            }
                            disabled={
                              analyticsDecisionMutation.isPending ||
                              editedLabel.trim().length === 0
                            }
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
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Outlier notice */}
      {analytics.outlierTermCount > 0 && panelState === "complete" ? (
        <p className="text-xs text-muted-foreground">
          {analytics.outlierTermCount} term
          {analytics.outlierTermCount !== 1 ? "s" : ""} were too dissimilar to cluster
          and have been set aside as outliers.
        </p>
      ) : null}

      {/* Audit note */}
      {panelState !== "idle" ? (
        <p className="text-xs text-muted-foreground">
          Cluster suggestions are never auto-accepted. Each accept, reject, or edit is
          written to the audit trail.
        </p>
      ) : null}
    </div>
  );
}
