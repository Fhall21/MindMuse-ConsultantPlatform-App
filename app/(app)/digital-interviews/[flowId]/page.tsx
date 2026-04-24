"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, ShieldCheck, ShieldX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { fetchJson } from "@/hooks/api";
import { useDigitalInterviewDetail } from "@/hooks/use-digital-interviews";
import { formatDigitalInterviewFramework } from "@/lib/digital-interviews";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatStatus(status: "draft" | "active" | "closed") {
  if (status === "active") {
    return <Badge variant="default">Active</Badge>;
  }

  if (status === "closed") {
    return <Badge variant="outline">Closed</Badge>;
  }

  return <Badge variant="secondary">Draft</Badge>;
}

export default function DigitalInterviewDetailPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useParams<{ flowId: string }>();
  const flowId = params.flowId ?? null;
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  const { data: flow, isLoading, error } = useDigitalInterviewDetail(flowId ?? "");

  async function updateStatus(status: "active" | "closed") {
    if (!flowId) {
      return;
    }

    setIsUpdating(true);
    try {
      await fetchJson(`/api/client/digital-interviews/${flowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      await queryClient.invalidateQueries({ queryKey: ["digital-interviews", "flow", flowId] });
      await queryClient.invalidateQueries({ queryKey: ["digital-interviews", "flows"] });
      await queryClient.invalidateQueries({ queryKey: ["digital-interviews", "unread-count"] });
      router.refresh();
    } catch (updateError) {
      toast.error(updateError instanceof Error ? updateError.message : "Failed to update interview");
    } finally {
      setIsUpdating(false);
    }
  }

  async function copyShareLink() {
    if (!flow?.share_token || typeof window === "undefined") {
      return;
    }

    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/interview/${flow.share_token}`);
      toast.success("Share link copied");
    } catch {
      toast.error("Failed to copy share link");
    } finally {
      setIsCopying(false);
    }
  }

  if (isLoading || !flow) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Card>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-40" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Digital Interview</h1>
          <p className="text-sm text-destructive">Failed to load digital interview.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/digital-interviews">Back to digital interviews</Link>
        </Button>
      </div>
    );
  }

  const shareLink = `/interview/${flow.share_token}`;
  const primaryAction = flow.status === "draft" ? "Activate Interview" : flow.status === "active" ? "Close Interview" : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{flow.title}</h1>
            {formatStatus(flow.status)}
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDigitalInterviewFramework(flow.framework)} · {flow.completed_count} response
            {flow.completed_count === 1 ? "" : "s"} received · Created {formatDate(flow.created_at)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/digital-interviews">Back</Link>
          </Button>
          <Button variant="outline" onClick={copyShareLink} disabled={isCopying}>
            {isCopying ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Copy className="mr-2 size-4" />}
            Copy share link
          </Button>
          {primaryAction && (
            <Button
              onClick={() => updateStatus(flow.status === "draft" ? "active" : "closed")}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : flow.status === "draft" ? (
                <ShieldCheck className="mr-2 size-4" />
              ) : (
                <ShieldX className="mr-2 size-4" />
              )}
              {primaryAction}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Share link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {shareLink}
          </p>
          <p className="text-xs text-muted-foreground">
            Task 07 will add transcript review, theme extraction, and canvas linking here.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Flow status: {flow.status}</p>
          <p>Share token: {flow.share_token}</p>
          <p>Responses received: {flow.completed_count}</p>
        </CardContent>
      </Card>
    </div>
  );
}
