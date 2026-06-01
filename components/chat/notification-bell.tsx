"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Notification01Icon,
  FileEditIcon,
  Analytics01Icon,
  Book01Icon,
  LayoutTopIcon,
  ChartBarLineIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchJson } from "@/hooks/api";

type JobType =
  | "report_ready"
  | "analysis_complete"
  | "research_ready"
  | "layout_complete"
  | string;

interface JobNotificationOutput {
  job_type: JobType;
  job_id: string;
  summary: string;
  action_url?: string;
}

interface JobNotification {
  id: string;
  toolName: string;
  output: JobNotificationOutput | null;
  createdAt: string;
}

interface StatusResponse {
  notifications: JobNotification[];
}

const JOB_LABELS: Record<string, string> = {
  report_ready: "Report ready",
  analysis_complete: "Cross-analysis complete",
  research_ready: "Research ready",
  layout_complete: "Canvas layout complete",
};

const JOB_ICONS: Record<string, typeof FileEditIcon> = {
  report_ready: FileEditIcon,
  analysis_complete: Analytics01Icon,
  research_ready: Book01Icon,
  layout_complete: LayoutTopIcon,
};

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatBadgeCount(count: number): string {
  return count > 9 ? "9+" : String(count);
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<JobNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (document.visibilityState === "hidden") return;
    try {
      const data = await fetchJson<StatusResponse>("/api/jobs/status");
      setNotifications(data.notifications ?? []);
    } catch {
      // silent — bell degrades gracefully
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
    intervalRef.current = setInterval(() => void fetchNotifications(), 30_000);
    const onVisibility = () => void fetchNotifications();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchNotifications]);

  const markSeen = useCallback(async (id: string) => {
    await fetch(`/api/jobs/status/${id}/seen`, {
      method: "PATCH",
      credentials: "include",
    });
  }, []);

  const handleMarkAll = useCallback(async () => {
    if (markingAll || notifications.length === 0) return;
    setMarkingAll(true);
    const ids = notifications.map((n) => n.id);
    // Optimistic clear
    setNotifications([]);
    await Promise.allSettled(ids.map((id) => markSeen(id)));
    setMarkingAll(false);
  }, [markingAll, markSeen, notifications]);

  const handleAction = useCallback(
    (notification: JobNotification) => {
      const url = notification.output?.action_url;
      if (!url) return;
      // Mark seen optimistically
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
      void markSeen(notification.id);
      router.push(url);
      setOpen(false);
    },
    [markSeen, router]
  );

  const unreadCount = notifications.length;
  const hasBadge = unreadCount > 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative text-muted-foreground hover:text-foreground"
          aria-label={
            hasBadge
              ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
              : "Notifications"
          }
        >
          <HugeiconsIcon icon={Notification01Icon} size={18} strokeWidth={1.5} />
          {hasBadge && (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
            >
              {formatBadgeCount(unreadCount)}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="text-sm font-medium tracking-tight">
            Notifications
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          {notifications.length === 0 ? (
            <div className="px-5 py-10">
              <p className="text-sm text-muted-foreground">
                No completed jobs yet. Long-running work like cross-analysis and
                report generation will appear here when done.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((notification) => {
                const output = notification.output;
                const jobType = output?.job_type ?? "analysis_complete";
                const label = JOB_LABELS[jobType] ?? "Job complete";
                const Icon = JOB_ICONS[jobType] ?? ChartBarLineIcon;
                const hasAction = Boolean(output?.action_url);

                return (
                  <li key={notification.id} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                        <HugeiconsIcon
                          icon={Icon}
                          size={14}
                          strokeWidth={1.5}
                          className="text-muted-foreground"
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-medium text-foreground">
                            {label}
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground/70">
                            {timeAgo(notification.createdAt)}
                          </span>
                        </div>
                        {output?.summary && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                            {output.summary}
                          </p>
                        )}
                        {hasAction && (
                          <button
                            type="button"
                            onClick={() => handleAction(notification)}
                            className="mt-2 text-[11px] font-medium text-primary underline-offset-2 hover:underline"
                          >
                            {jobType === "report_ready"
                              ? "Open report →"
                              : "Review →"}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <div className="border-t border-border px-5 py-3">
            <button
              type="button"
              onClick={() => void handleMarkAll()}
              disabled={markingAll}
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
            >
              Mark all as read
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
