"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponseCard } from "@/components/digital-interviews/response-card";
import { DigitalInterviewThemePanel } from "@/components/digital-interviews/digital-interview-theme-panel";
import { useDigitalInterviewDetail } from "@/hooks/use-digital-interviews";
import { formatDigitalInterviewFramework } from "@/lib/digital-interviews";

function StatusBadge({ status }: { status: "draft" | "active" | "closed" }) {
  if (status === "active") return <Badge variant="default">Active</Badge>;
  if (status === "closed") return <Badge variant="outline">Closed</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}

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
    </div>
  );
}
