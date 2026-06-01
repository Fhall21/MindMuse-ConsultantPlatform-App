"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CrossAnalysisCard } from "@/components/chat/cards/CrossAnalysisCard";
import type { CrossAnalysisResults } from "@/lib/chat/analysis-db";

export interface ChatAnalysisNotification {
  id: string;
  consultationId: string;
  results: CrossAnalysisResults;
}

interface ChatAnalysisNotificationsProps {
  notifications: ChatAnalysisNotification[];
  onDismiss?: (id: string) => void;
}

export function ChatAnalysisNotifications({
  notifications,
  onDismiss,
}: ChatAnalysisNotificationsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 py-2">
      {notifications.map((notification) => (
        <div key={notification.id} className="space-y-2">
          <div className="rounded-2xl border bg-card px-4 py-3 text-sm">
            <p>
              Analysis complete — {notification.results.pattern_count} emerging pattern
              {notification.results.pattern_count === 1 ? "" : "s"} across your last{" "}
              {notification.results.transcript_count} transcripts.
            </p>
            <Button
              type="button"
              variant="link"
              className="h-auto px-0"
              onClick={() =>
                setExpandedId((current) =>
                  current === notification.id ? null : notification.id
                )
              }
            >
              Review?
            </Button>
          </div>
          {expandedId === notification.id ? (
            <CrossAnalysisCard
              results={notification.results}
              consultationId={notification.consultationId}
              onDismiss={() => onDismiss?.(notification.id)}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
