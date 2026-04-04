"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

const DISMISSED_KEY = (userId: string) => `onboarding_checklist_dismissed:${userId}`;

export interface OnboardingChecklistProps {
  userId: string;
  hasConsultation: boolean;
  hasMeeting: boolean;
  hasInsight: boolean;
  hasTheme: boolean;
  hasCanvasConnection: boolean;
  hasReport: boolean;
  /** Step 7 (download): no download audit trail exists — always false, shown as optional */
  hasDownloadedReport?: boolean;
  hasCustomTemplate: boolean;
}

interface ChecklistStep {
  id: number;
  label: string;
  hint: string;
  completed: boolean;
  optional: boolean;
  sectionHref: string;
  sectionLabel: string;
}

function buildSteps(props: OnboardingChecklistProps): ChecklistStep[] {
  return [
    {
      id: 1,
      label: "Create your first consultation",
      hint: "Use the sidebar or the New Meeting button above.",
      completed: props.hasConsultation,
      optional: false,
      sectionHref: "/consultations",
      sectionLabel: "Consultations",
    },
    {
      id: 2,
      label: "Create your first meeting",
      hint: "Go to Meetings in the sidebar, then click New Meeting.",
      completed: props.hasMeeting,
      optional: false,
      sectionHref: "/meetings",
      sectionLabel: "Meetings",
    },
    {
      id: 3,
      label: "Create your first insight from a meeting",
      hint: "Open a meeting, then use the Insights panel.",
      completed: props.hasInsight,
      optional: false,
      sectionHref: "/meetings",
      sectionLabel: "Meetings",
    },
    {
      id: 4,
      label: "Create your first consultation theme",
      hint: "Open a consultation, then go to the Themes tab.",
      completed: props.hasTheme,
      optional: false,
      sectionHref: "/consultations",
      sectionLabel: "Consultations",
    },
    {
      id: 5,
      label: "Connect two nodes on the Evidence Canvas",
      hint: "Open a consultation, then click Evidence Canvas.",
      completed: props.hasCanvasConnection,
      optional: false,
      sectionHref: "/consultations",
      sectionLabel: "Consultations",
    },
    {
      id: 6,
      label: "Generate your first report",
      hint: "Open a consultation, then click Generate Report.",
      completed: props.hasReport,
      optional: false,
      sectionHref: "/consultations",
      sectionLabel: "Consultations",
    },
    {
      id: 7,
      // No download audit trail — step derives as always-incomplete. Marked optional.
      label: "Download your first report",
      hint: "Open a report, then use the Export button.",
      completed: props.hasDownloadedReport ?? false,
      optional: true,
      sectionHref: "/reports",
      sectionLabel: "Reports",
    },
    {
      id: 8,
      label: "Create a custom report template",
      hint: "Go to Settings, then Report template.",
      completed: props.hasCustomTemplate,
      optional: true,
      sectionHref: "/settings/report-template",
      sectionLabel: "Report template",
    },
  ];
}

export function OnboardingChecklist(props: OnboardingChecklistProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Read localStorage only on client to avoid SSR mismatch
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      setIsDismissed(localStorage.getItem(DISMISSED_KEY(props.userId)) === "true");
    }
  }, [props.userId]);

  const steps = buildSteps(props);
  const requiredSteps = steps.filter((s) => !s.optional);
  const completedRequired = requiredSteps.filter((s) => s.completed).length;
  const allRequiredDone = completedRequired === requiredSteps.length;

  function dismiss() {
    if (typeof window !== "undefined") {
      localStorage.setItem(DISMISSED_KEY(props.userId), "true");
    }
    setIsDismissed(true);
  }

  // Don't render until mounted (prevents localStorage hydration flash)
  if (!isMounted || isDismissed) return null;

  // Congratulations state — all required steps done
  if (allRequiredDone) {
    return (
      <div className="flex items-center justify-between border-b pb-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-foreground" />
          Core workflow complete. You&apos;re all set.
        </span>
        <button
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground"
        >
          Hide
        </button>
      </div>
    );
  }

  return (
    <div className="border-b pb-5">
      {/* Header row */}
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">
          Getting started &middot; {completedRequired}&thinsp;/&thinsp;{requiredSteps.length} steps
        </span>
        <button
          onClick={dismiss}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Hide
        </button>
      </div>

      {/* Step list */}
      <ul className="space-y-2.5">
        {steps.map((step) => (
          <li key={step.id} className="flex items-start justify-between gap-4">
            {/* Left: indicator + label + hint */}
            <div className="flex min-w-0 items-start gap-2">
              {step.completed ? (
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 translate-y-[3px] rounded-full bg-foreground opacity-60" />
              ) : (
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 translate-y-[3px] rounded-full border border-muted-foreground/40" />
              )}
              <div className="min-w-0">
                <span
                  className={
                    step.completed
                      ? "text-xs text-muted-foreground line-through"
                      : "text-xs"
                  }
                >
                  {step.label}
                  {step.optional && (
                    <span className="ml-1 text-muted-foreground/60">(optional)</span>
                  )}
                </span>
                {!step.completed && (
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground/70">
                    {step.hint}
                  </p>
                )}
              </div>
            </div>

            {/* Right: section link */}
            {!step.completed && (
              <Link
                href={step.sectionHref}
                className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
              >
                {step.sectionLabel} →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
