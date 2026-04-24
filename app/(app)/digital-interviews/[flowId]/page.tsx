"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart2, FileText, ShieldCheck, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponseCard } from "@/components/digital-interviews/response-card";
import { DigitalInterviewThemePanel } from "@/components/digital-interviews/digital-interview-theme-panel";
import { useDigitalInterviewDetail } from "@/hooks/use-digital-interviews";
import { getActiveDigitalInterviewGuardrails } from "@/lib/digital-interview-guardrails";
import { formatDigitalInterviewFramework } from "@/lib/digital-interviews";

function StatusBadge({ status }: { status: "draft" | "active" | "closed" }) {
  if (status === "active") return <Badge variant="default">Active</Badge>;
  if (status === "closed") return <Badge variant="outline">Closed</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}

type FeatureInterestKey = "polis_voting" | "survey_injection";

type FeatureInterestSummary = {
  feature_key: FeatureInterestKey;
  count: number;
  interested: boolean;
};

export default function DigitalInterviewDetailPage() {
  const params = useParams<{ flowId: string }>();
  const flowId = params.flowId ?? "";
  const queryClient = useQueryClient();
  const { data: flow, isPending, isLoading, error } = useDigitalInterviewDetail(flowId);

  const [togglingStatus, setTogglingStatus] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy share link");

  async function handleStatusToggle() {
    if (!flow) return;
    const nextStatus = flow.status === "active" ? "closed" : "active";
    setTogglingStatus(true);
    try {
      const res = await fetch(`/api/client/digital-interviews/${flowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      await queryClient.invalidateQueries({ queryKey: ["digital-interviews", "flow", flowId] });
      await queryClient.invalidateQueries({ queryKey: ["digital-interviews", "flows"] });
      toast.success(nextStatus === "active" ? "Interview activated." : "Interview closed.");
    } catch {
      toast.error("Failed to update status.");
    } finally {
      setTogglingStatus(false);
    }
  }

  function handleCopyShareLink() {
    if (!flow) return;
    const url = `${window.location.origin}/interview/${flow.share_token}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopyLabel("Copied");
      toast.success("Share link copied.");
      setTimeout(() => setCopyLabel("Copy share link"), 2000);
    });
  }

  if (isPending || isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !flow) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">
          Failed to load interview data. Please refresh.
        </p>
        <Button variant="ghost" asChild>
          <Link href="/digital-interviews">Back to digital interviews</Link>
        </Button>
      </div>
    );
  }

  const completedResponses = flow.responses ?? [];
  const responseCount = completedResponses.length;
  const boundaryMoments = completedResponses.flatMap((response) =>
    response.boundary_moments.map((moment) => ({
      ...moment,
      responseId: response.id,
      intervieweeName: response.interviewee_name,
    }))
  );
  const guardrails = getActiveDigitalInterviewGuardrails({
    title: flow.title,
    framework: flow.framework,
    customFrameworkPrompt: flow.custom_framework_prompt,
    topics: flow.topics,
    guardrailsConfig: flow.guardrails_config,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <nav className="text-sm text-muted-foreground">
          <Link href="/digital-interviews" className="hover:text-foreground">
            Digital Interviews
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{flow.title}</span>
        </nav>

        <div className="space-y-4 rounded-xl border border-border/50 bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <h1 className="text-xl font-semibold tracking-tight">{flow.title}</h1>
              <p className="text-sm text-muted-foreground">
                {formatDigitalInterviewFramework(flow.framework)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <StatusBadge status={flow.status} />
              {flow.status !== "closed" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleStatusToggle()}
                  disabled={togglingStatus}
                >
                  {togglingStatus
                    ? "Saving…"
                    : flow.status === "active"
                      ? "Close interview"
                      : "Activate"}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-3">
            <p className="text-sm text-muted-foreground">
              {responseCount === 0
                ? "No responses yet"
                : `${responseCount} response${responseCount === 1 ? "" : "s"} received`}
            </p>
            <Button size="sm" variant="outline" onClick={handleCopyShareLink}>
              {copyLabel}
            </Button>
          </div>
        </div>
      </div>

      <BoundaryReviewPanel guardrails={guardrails} boundaryMoments={boundaryMoments} />

      <Separator />

      {/* Responses */}
      <section className="space-y-3">
        <SectionHeading>Responses</SectionHeading>
        {responseCount === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              No responses yet. Share the interview link to start collecting data.
            </p>
            <Button size="sm" variant="outline" onClick={handleCopyShareLink}>
              {copyLabel}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {completedResponses.map((response) => (
              <ResponseCard key={response.id} flowId={flowId} response={response} />
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* Theme extraction */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <SectionHeading>Themes</SectionHeading>
          {flow.consultation_id ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/canvas/round/${flow.consultation_id}`}>
                Evidence canvas &rarr;
              </Link>
            </Button>
          ) : null}
        </div>
        <DigitalInterviewThemePanel flowId={flowId} hasResponses={responseCount > 0} />
      </section>

      <FeaturePlaceholders />
    </div>
  );
}

function BoundaryReviewPanel({
  guardrails,
  boundaryMoments,
}: {
  guardrails: ReturnType<typeof getActiveDigitalInterviewGuardrails>;
  boundaryMoments: Array<{
    source: "universal" | "recommended" | "custom";
    label: string;
    reason: string | null;
    turn_index: number;
    timestamp: string | null;
    responseId: string;
    intervieweeName: string | null;
  }>;
}) {
  const sections = [
    { label: "Universal", items: guardrails.universal },
    { label: "Recommended", items: guardrails.recommended },
    { label: "Custom", items: guardrails.custom },
  ];

  return (
    <section className="space-y-3">
      <SectionHeading>Active boundaries</SectionHeading>
      <div className="space-y-4 rounded-lg border border-border/70 p-4">
        {sections.map((section) => (
          <div key={section.label} className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {section.label}
            </p>
            {section.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">None configured.</p>
            ) : (
              <div className="space-y-2">
                {section.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {boundaryMoments.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-border/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Boundary moments
          </p>
          {boundaryMoments.map((moment) => (
            <div key={`${moment.responseId}-${moment.turn_index}`} className="space-y-1 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{moment.label}</span>
                <span className="rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground">
                  {moment.source}
                </span>
                <span className="text-xs text-muted-foreground">
                  {moment.intervieweeName ?? "Response"} turn {moment.turn_index}
                </span>
              </div>
              {moment.reason ? (
                <p className="text-muted-foreground">{moment.reason}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function FeaturePlaceholders() {
  const [interests, setInterests] = useState<Record<FeatureInterestKey, FeatureInterestSummary>>({
    polis_voting: { feature_key: "polis_voting", count: 0, interested: false },
    survey_injection: { feature_key: "survey_injection", count: 0, interested: false },
  });
  const [savingKey, setSavingKey] = useState<FeatureInterestKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/client/feature-interests?keys=polis_voting,survey_injection")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { data?: FeatureInterestSummary[] } | null) => {
        if (cancelled || !payload?.data) return;
        setInterests((current) => {
          const next = { ...current };
          for (const item of payload.data ?? []) {
            next[item.feature_key] = item;
          }
          return next;
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleInterest(featureKey: FeatureInterestKey) {
    setSavingKey(featureKey);
    try {
      const response = await fetch("/api/client/feature-interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureKey }),
      });
      if (!response.ok) throw new Error("Failed to record interest");
      const payload = (await response.json()) as { data: FeatureInterestSummary };
      setInterests((current) => ({ ...current, [featureKey]: payload.data }));
    } catch {
      toast.error("Failed to record interest.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <section className="space-y-3">
      <FeaturePlaceholderCard
        featureKey="polis_voting"
        title="Statement voting"
        description="Send extracted themes back to participants as statements to vote on. Useful for round 2 consultations to surface consensus and divergence across the group."
        icon={<BarChart2 className="size-4 text-muted-foreground" />}
        interest={interests.polis_voting}
        saving={savingKey === "polis_voting"}
        onInterest={handleInterest}
      />
      <FeaturePlaceholderCard
        featureKey="survey_injection"
        title="In-interview surveys"
        description="Add short multi-choice questions to an interview flow and let the interviewer place them at the right moment."
        icon={<FileText className="size-4 text-muted-foreground" />}
        interest={interests.survey_injection}
        saving={savingKey === "survey_injection"}
        onInterest={handleInterest}
      />
    </section>
  );
}

function FeaturePlaceholderCard({
  featureKey,
  title,
  description,
  icon,
  interest,
  saving,
  onInterest,
}: {
  featureKey: FeatureInterestKey;
  title: string;
  description: string;
  icon: ReactNode;
  interest: FeatureInterestSummary;
  saving: boolean;
  onInterest: (featureKey: FeatureInterestKey) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border/80 bg-muted/20 p-4">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Coming soon</p>
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-medium">{title}</h2>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant={interest.interested ? "ghost" : "outline"}
          disabled={interest.interested || saving}
          onClick={() => onInterest(featureKey)}
        >
          {interest.interested ? (
            "✓ You're interested"
          ) : (
            <>
              <ThumbsUp className="size-3.5" />
              {saving ? "Saving…" : "Interested"}
            </>
          )}
        </Button>
        {interest.count > 0 ? (
          <p className="text-xs text-muted-foreground">
            {interest.count} interested
          </p>
        ) : null}
      </div>
    </div>
  );
}
