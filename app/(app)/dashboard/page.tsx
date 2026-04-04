"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMeetings } from "@/hooks/use-meetings";
import { useConsultations } from "@/hooks/use-consultations";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";
import type { Meeting } from "@/types/db";
import type { Consultation } from "@/types/db";

const ONBOARDING_EXIT_MS = 220;
const ONBOARDING_DISMISSED_KEY = (userId: string) =>
  `onboarding_checklist_dismissed:${userId}`;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDurationMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "complete") {
    return <Badge variant="default">Complete</Badge>;
  }
  return <Badge variant="secondary">Draft</Badge>;
}

function StatCard({
  label,
  value,
  description,
  isLoading,
  isError,
  formatter = (currentValue: number) => currentValue.toLocaleString(),
}: {
  label: string;
  value: number;
  description: string;
  isLoading: boolean;
  isError: boolean;
  formatter?: (currentValue: number) => string;
}) {
  return (
    <div className="space-y-1 sm:px-6 sm:first:pl-0 sm:last:pr-0">
      <dt className="text-sm font-medium text-foreground">{label}</dt>
      <dd className="text-xs text-muted-foreground">{description}</dd>
      <dd className="pt-1 text-3xl font-semibold tracking-tight">
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : isError ? (
          "—"
        ) : (
          formatter(value)
        )}
      </dd>
    </div>
  );
}

function RecentMeetingRow({ meeting }: { meeting: Meeting }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="min-w-0 flex-1">
        <Link
          href={`/meetings/${meeting.id}`}
          className="truncate text-sm font-medium hover:underline"
        >
          {meeting.title}
        </Link>
        <p className="text-xs text-muted-foreground">{formatDate(meeting.created_at)}</p>
      </div>
      <div className="ml-4 flex-shrink-0">
        <StatusBadge status={meeting.status} />
      </div>
    </div>
  );
}

function RecentMeetingsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-3">
          <div className="space-y-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

function RecentMeetingEmptyState() {
  return (
    <div className="py-10 text-center">
      <p className="text-sm text-muted-foreground">No meetings yet.</p>
      <Button asChild size="sm" className="mt-4">
        <Link href="/meetings/new">New Meeting</Link>
      </Button>
    </div>
  );
}

function RecentConsultationRow({ consultation }: { consultation: Consultation }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <Link
          href={`/consultations/rounds/${consultation.id}`}
          className="block truncate text-sm font-medium hover:underline"
        >
          {consultation.label}
        </Link>
        <p className="text-xs text-muted-foreground">
          {formatDate(consultation.created_at)}
        </p>
      </div>
      <Link
        href={`/consultations/rounds/${consultation.id}`}
        className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
      >
        Themes and analysis →
      </Link>
    </div>
  );
}

function RecentConsultationsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-start justify-between gap-4 py-3">
          <div className="space-y-1">
            <Skeleton className="h-4 w-52" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </div>
  );
}

function RecentConsultationEmptyState() {
  return (
    <div className="py-10 text-center">
      <p className="text-sm text-muted-foreground">No consultation projects yet.</p>
      <Button asChild size="sm" className="mt-4">
        <Link href="/consultations">Open Consultations</Link>
      </Button>
    </div>
  );
}

export default function DashboardPage() {
  const meetingsQuery = useMeetings();
  const consultationsQuery = useConsultations();
  const statsQuery = useDashboardStats();
  const [showOnboardingCard, setShowOnboardingCard] = useState(true);
  const [isOnboardingExiting, setIsOnboardingExiting] = useState(false);

  const recentMeetings = (meetingsQuery.data ?? []).slice(0, 10);
  const recentConsultations = (consultationsQuery.data ?? []).slice(0, 5);
  const isMeetingsLoading = meetingsQuery.isLoading;
  const isConsultationsLoading = consultationsQuery.isLoading;
  const hasNoMeetings = !isMeetingsLoading && recentMeetings.length === 0;
  const hasNoConsultations = !isConsultationsLoading && recentConsultations.length === 0;

  useEffect(() => {
    if (!isOnboardingExiting) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowOnboardingCard(false);
      setIsOnboardingExiting(false);
    }, ONBOARDING_EXIT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isOnboardingExiting]);

  useEffect(() => {
    const userId = statsQuery.data?.userId;
    if (!userId || typeof window === "undefined") {
      return;
    }

    const isDismissed =
      localStorage.getItem(ONBOARDING_DISMISSED_KEY(userId)) === "true";
    setShowOnboardingCard(!isDismissed);
    if (isDismissed) {
      setIsOnboardingExiting(false);
    }
  }, [statsQuery.data?.userId]);

  function handleOnboardingDismiss() {
    setIsOnboardingExiting(true);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Current workspace activity.</p>
      </div>

      <dl className="grid gap-5 border-y py-5 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:py-4">
        <StatCard
          label="Consultation Projects"
          value={statsQuery.data?.totalConsultations ?? 0}
          description="Recorded consultation projects"
          isLoading={statsQuery.isLoading}
          isError={statsQuery.isError}
        />
        <StatCard
          label="AI Insights Generated"
          value={statsQuery.data?.totalAiInsights ?? 0}
          description="Insights generated by AI"
          isLoading={statsQuery.isLoading}
          isError={statsQuery.isError}
        />
        <StatCard
          label="Potential Time Saved"
          value={statsQuery.data?.potentialTimeSavedMinutes ?? 0}
          description="15m per evidence email, 1h per distinct report"
          isLoading={statsQuery.isLoading}
          isError={statsQuery.isError}
          formatter={formatDurationMinutes}
        />
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        {!statsQuery.isLoading && statsQuery.data?.userId && showOnboardingCard && (
          <Card
            className={`lg:col-span-2 transition-all duration-200 ease-out ${
              isOnboardingExiting
                ? "-translate-y-1 opacity-0"
                : "translate-y-0 opacity-100"
            }`}
          >
            <CardHeader className="space-y-0.5 pb-2">
              <CardTitle className="text-sm font-semibold tracking-tight">
                Onboarding
              </CardTitle>
              <CardDescription>
                Keep the first-time path visible until the core flow is complete.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OnboardingChecklist
                userId={statsQuery.data.userId}
                hasConsultation={(statsQuery.data.totalConsultations ?? 0) > 0}
                hasMeeting={(statsQuery.data.totalMeetings ?? 0) > 0}
                hasInsight={(statsQuery.data.totalInsights ?? 0) > 0}
                hasTheme={(statsQuery.data.totalThemes ?? 0) > 0}
                hasCanvasConnection={(statsQuery.data.totalCanvasConnections ?? 0) > 0}
                hasReport={(statsQuery.data.totalReports ?? 0) > 0}
                hasCustomTemplate={(statsQuery.data.totalCustomTemplates ?? 0) > 0}
                onDismiss={handleOnboardingDismiss}
              />
            </CardContent>
          </Card>
        )}

        <Card className="flex h-[400px] flex-col">
          <CardHeader className="flex shrink-0 flex-row items-start justify-between space-y-0 pb-4">
            <div className="space-y-1">
              <CardTitle className="text-sm font-semibold tracking-tight">
                Recent Meetings
              </CardTitle>
              <CardDescription>Latest recorded work.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link href="/meetings">View all →</Link>
            </Button>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto">
            {isMeetingsLoading ? (
              <RecentMeetingsSkeleton />
            ) : hasNoMeetings ? (
              <RecentMeetingEmptyState />
            ) : (
              <div className="divide-y border-t">
                {recentMeetings.map((meeting) => (
                  <div key={meeting.id} className="px-1">
                    <RecentMeetingRow meeting={meeting} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex h-[400px] flex-col">
          <CardHeader className="flex shrink-0 flex-row items-start justify-between space-y-0 pb-4">
            <div className="space-y-1">
              <CardTitle className="text-sm font-semibold tracking-tight">
                Recent Consultations
              </CardTitle>
              <CardDescription>
                Jump straight to themes and analysis for each project.
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link href="/consultations">View all →</Link>
            </Button>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto">
            {isConsultationsLoading ? (
              <RecentConsultationsSkeleton />
            ) : hasNoConsultations ? (
              <RecentConsultationEmptyState />
            ) : (
              <div className="divide-y border-t">
                {recentConsultations.map((consultation) => (
                  <div key={consultation.id} className="px-1">
                    <RecentConsultationRow consultation={consultation} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
