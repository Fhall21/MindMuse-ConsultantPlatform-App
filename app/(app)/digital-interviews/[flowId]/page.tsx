"use client";

import { use } from "react";
import { useDigitalInterviewDetail } from "@/hooks/use-digital-interviews";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const FRAMEWORK_LABELS: Record<string, string> = {
  appreciative_inquiry: "Appreciative Inquiry",
  psychological_safety: "Psychological Safety",
  custom: "Custom",
};

const DEPTH_LABELS: Record<string, string> = {
  surface: "Surface",
  moderate: "Moderate",
  deep: "Deep",
};

export default function DigitalInterviewDetailPage({
  params,
}: {
  params: Promise<{ flowId: string }>;
}) {
  const { flowId } = use(params);
  const { data: flow, isLoading, error } = useDigitalInterviewDetail(flowId);

  const shareUrl =
    typeof window !== "undefined" && flow?.share_token
      ? `${window.location.origin}/interview/${flow.share_token}`
      : null;

  function copyLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success("Link copied to clipboard");
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-7 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-96 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (error || !flow) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Digital interview not found</h1>
        <p className="text-sm text-muted-foreground">
          This interview may have been deleted or you do not have access.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{flow.title}</h1>
        <p className="text-sm text-muted-foreground">
          {FRAMEWORK_LABELS[flow.framework] ?? flow.framework} ·{" "}
          {DEPTH_LABELS[flow.depth_level] ?? flow.depth_level}
          {flow.completed_count > 0 && (
            <> · {flow.completed_count} response{flow.completed_count !== 1 ? "s" : ""}</>
          )}
        </p>
      </div>

      {/* Share link — primary action */}
      {shareUrl && (
        <div className="space-y-2 rounded-md border p-4">
          <p className="text-sm font-medium">Shareable link</p>
          <p className="text-xs text-muted-foreground">
            Send this link to interviewees. Anyone with the link can complete the interview.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-muted px-3 py-2 font-mono text-xs">
              {shareUrl}
            </code>
            <Button type="button" size="sm" onClick={copyLink}>
              Copy link
            </Button>
          </div>
        </div>
      )}

      <Separator />

      {/* Details */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Interview configuration
        </h2>
        <dl className="divide-y rounded-md border text-sm">
          <DetailRow label="Framework" value={FRAMEWORK_LABELS[flow.framework] ?? flow.framework} />
          <DetailRow label="Depth" value={DEPTH_LABELS[flow.depth_level] ?? flow.depth_level} />
          <DetailRow
            label="Topics"
            value={flow.topics.map((t, i) => `${i + 1}. ${t}`).join("\n")}
            multiline
          />
          <DetailRow label="Status" value={flow.status} last />
        </dl>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  multiline,
  last,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  last?: boolean;
}) {
  return (
    <div className={`flex gap-6 px-4 py-3 ${last ? "" : "border-b"}`}>
      <dt className="w-28 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={`flex-1 ${multiline ? "whitespace-pre-line" : ""}`}>{value}</dd>
    </div>
  );
}
