"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
      hint: "Use the New Consultation button in the Consultations section.",
      completed: props.hasConsultation,
      optional: false,
      sectionHref: "/consultations",
      sectionLabel: "Consultations",
    },
    {
      id: 2,
      label: "Create your first meeting",
      hint: 'Click "New Meeting" above or go to Meetings in the sidebar.',
      completed: props.hasMeeting,
      optional: false,
      sectionHref: "/meetings",
      sectionLabel: "Meetings",
    },
    {
      id: 3,
      label: "Create your first insight from a meeting",
      hint: "Open a meeting, then use the Insights panel on the right.",
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

function StepDot({ completed }: { completed: boolean }) {
  if (completed) {
    return (
      <span className="mt-[5px] h-3 w-3 shrink-0 rounded-full bg-foreground/50" />
    );
  }
  return (
    <span className="mt-[5px] h-3 w-3 shrink-0 rounded-full border-2 border-muted-foreground/35 bg-background" />
  );
}

export function OnboardingChecklist(props: OnboardingChecklistProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showOptional, setShowOptional] = useState(false);

  // Read localStorage only on client to avoid SSR mismatch
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      setIsDismissed(localStorage.getItem(DISMISSED_KEY(props.userId)) === "true");
    }
  }, [props.userId]);

  const allSteps = buildSteps(props);
  const requiredSteps = allSteps.filter((s) => !s.optional);
  const optionalSteps = allSteps.filter((s) => s.optional);
  const completedRequired = requiredSteps.filter((s) => s.completed).length;
  const allRequiredDone = completedRequired === requiredSteps.length;
  const visibleSteps = showOptional ? allSteps : requiredSteps;

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
      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <span>Core workflow complete. You&apos;re all set.</span>
        <button
          onClick={dismiss}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Hide
        </button>
      </div>
    );
  }

  const completedOptional = optionalSteps.filter((s) => s.completed).length;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-muted-foreground">
          {completedRequired} of {requiredSteps.length} steps complete
        </span>
        <button
          onClick={dismiss}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Hide
        </button>
      </div>

      {/* Step list */}
      <ul className="space-y-3">
        {visibleSteps.map((step) => (
          <li key={step.id} className="flex items-start gap-2.5">
            <StepDot completed={step.completed} />

            {/* Label + hint block */}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-4">
                <span
                  className={
                    step.completed
                      ? "text-sm text-muted-foreground/65"
                      : "text-sm text-foreground"
                  }
                >
                  {step.label}
                  {step.optional && (
                    <span className="ml-1 text-muted-foreground/50">(optional)</span>
                  )}
                </span>

                {!step.completed && (
                  <Link
                    href={step.sectionHref}
                    className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
                  >
                    {step.sectionLabel} →
                  </Link>
                )}
              </div>

              {!step.completed && (
                <p className="mt-1 text-xs leading-5 text-muted-foreground/70">
                  {step.hint}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Optional steps toggle */}
      <div className="mt-3">
        <button
          onClick={() => setShowOptional((v) => !v)}
          className="text-xs text-muted-foreground/60 hover:text-muted-foreground"
        >
          {showOptional
            ? "Hide optional steps"
            : `${optionalSteps.length} optional steps${completedOptional > 0 ? ` (${completedOptional} done)` : ""}`}
        </button>
      </div>
    </div>
  );
}
