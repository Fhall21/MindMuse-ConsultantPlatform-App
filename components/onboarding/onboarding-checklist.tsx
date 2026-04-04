"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CheckCircle2, Circle, ChevronRight, X } from "lucide-react";

const DISMISSED_KEY = "onboarding_checklist_dismissed";

export interface OnboardingChecklistProps {
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
      completed: props.hasConsultation,
      optional: false,
      sectionHref: "/consultations/new",
      sectionLabel: "New consultation",
    },
    {
      id: 2,
      label: "Create your first meeting",
      completed: props.hasMeeting,
      optional: false,
      sectionHref: "/meetings/new",
      sectionLabel: "New meeting",
    },
    {
      id: 3,
      label: "Create your first insight from a meeting",
      completed: props.hasInsight,
      optional: false,
      sectionHref: "/meetings",
      sectionLabel: "Go to meetings",
    },
    {
      id: 4,
      label: "Create your first consultation theme",
      completed: props.hasTheme,
      optional: false,
      sectionHref: "/consultations",
      sectionLabel: "Go to consultations",
    },
    {
      id: 5,
      label: "Open the Evidence Canvas and connect two nodes",
      completed: props.hasCanvasConnection,
      optional: false,
      sectionHref: "/consultations",
      sectionLabel: "Go to consultations",
    },
    {
      id: 6,
      label: "Create your first report",
      completed: props.hasReport,
      optional: false,
      sectionHref: "/consultations",
      sectionLabel: "Go to consultations",
    },
    {
      id: 7,
      // No download audit trail — step derives as always-incomplete. Marked optional.
      label: "Download your first report",
      completed: props.hasDownloadedReport ?? false,
      optional: true,
      sectionHref: "/reports",
      sectionLabel: "Go to reports",
    },
    {
      id: 8,
      label: "Create a custom report template",
      completed: props.hasCustomTemplate,
      optional: true,
      sectionHref: "/settings/report-template",
      sectionLabel: "Go to templates",
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
      setIsDismissed(localStorage.getItem(DISMISSED_KEY) === "true");
    }
  }, []);

  const steps = buildSteps(props);
  const requiredSteps = steps.filter((s) => !s.optional);
  const completedRequired = requiredSteps.filter((s) => s.completed).length;
  const allRequiredDone = completedRequired === requiredSteps.length;

  function dismiss() {
    if (typeof window !== "undefined") {
      localStorage.setItem(DISMISSED_KEY, "true");
    }
    setIsDismissed(true);
  }

  // Don't render until mounted (prevents localStorage hydration flash)
  if (!isMounted || isDismissed) return null;

  // Congratulations state — all required steps done
  if (allRequiredDone) {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-semibold text-green-800 dark:text-green-300">
              You&apos;re all set!
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-green-700 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900"
            onClick={dismiss}
          >
            Hide this
          </Button>
        </CardHeader>
        <CardContent className="pb-3 pt-0">
          <p className="text-xs text-green-700 dark:text-green-400">
            You&apos;ve completed the core workflow. The platform is now set up for your evidence trail.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold tracking-tight">Getting started</h3>
          <p className="text-xs text-muted-foreground">
            {completedRequired} of {requiredSteps.length} steps complete
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={dismiss}
          title="Hide this checklist"
        >
          <X className="mr-1 h-3 w-3" />
          Hide this
        </Button>
      </CardHeader>

      <CardContent className="pb-3 pt-0">
        <ul className="space-y-1">
          {steps.map((step) => (
            <li key={step.id} className="flex items-center justify-between gap-2 rounded-sm py-1">
              <div className="flex min-w-0 items-center gap-2">
                {step.completed ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                )}
                <span
                  className={
                    step.completed
                      ? "truncate text-xs text-muted-foreground line-through"
                      : "truncate text-xs"
                  }
                >
                  {step.label}
                </span>
                {step.optional && (
                  <Badge
                    variant="secondary"
                    className="shrink-0 px-1.5 py-0 text-[10px] leading-4"
                  >
                    Optional
                  </Badge>
                )}
              </div>

              {!step.completed && (
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-6 shrink-0 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Link href={step.sectionHref}>
                    {step.sectionLabel}
                    <ChevronRight className="ml-0.5 h-3 w-3" />
                  </Link>
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
