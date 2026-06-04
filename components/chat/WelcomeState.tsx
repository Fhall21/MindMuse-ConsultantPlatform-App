"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { CreateProjectCard } from "@/components/chat/cards/CreateProjectCard";
import type { WelcomeVariant } from "@/lib/chat/onboarding-copy";
import {
  getWelcomeGreeting,
  getWelcomeQuickActionPriority,
} from "@/lib/chat/onboarding-copy";
import type { OnboardingPhase } from "@/lib/chat/onboarding-state";
import type { Consultation } from "@/types/db";
import {
  CAPTURE_NOTES_ACCEPT_ATTR,
  CAPTURE_TRANSCRIPT_ACCEPT_ATTR,
} from "@/lib/capture/constants";
import { CHAT_QUICK_ACTION_BUTTON_CLASS } from "@/lib/chat/constants";

export type WelcomeQuickAction =
  | { type: "prefill"; text: string }
  | { type: "file"; accept: string; label: string };

interface WelcomeStateProps {
  displayName: string;
  welcomeVariant: WelcomeVariant;
  onboardingPhase: OnboardingPhase;
  activeProject?: Consultation | null;
  showCreateProject?: boolean;
  onQuickAction: (action: WelcomeQuickAction) => void;
  onAttachFile?: (file: File, kind: "transcript" | "notes") => void;
  onProjectCreated?: (consultationId: string) => void;
}

function formatHoursSaved(minutes: number) {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainder}m`;
}

function StatPill({
  label,
  value,
  isLoading,
}: {
  label: string;
  value: string;
  isLoading: boolean;
}) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      {isLoading ? (
        <Skeleton className="mt-1 h-5 w-12" />
      ) : (
        <p className="text-sm font-semibold tabular-nums">{value}</p>
      )}
    </div>
  );
}

export function WelcomeState({
  displayName,
  welcomeVariant,
  onboardingPhase,
  activeProject,
  showCreateProject = false,
  onQuickAction,
  onAttachFile,
  onProjectCreated,
}: WelcomeStateProps) {
  const statsQuery = useDashboardStats();
  const [statsOpen, setStatsOpen] = useState(false);
  const transcriptInputRef = useRef<HTMLInputElement>(null);
  const notesInputRef = useRef<HTMLInputElement>(null);

  const greeting = getWelcomeGreeting(welcomeVariant, displayName);
  const chipPriority = getWelcomeQuickActionPriority(onboardingPhase);

  const chips: { label: string; action: WelcomeQuickAction }[] = [];

  if (chipPriority.showUploadTranscript) {
    chips.push({
      label: "Send transcript",
      action: { type: "file", accept: CAPTURE_TRANSCRIPT_ACCEPT_ATTR, label: "transcript" },
    });
  }

  if (chipPriority.showUploadNotes) {
    chips.push({
      label: "Send notes",
      action: { type: "file", accept: CAPTURE_NOTES_ACCEPT_ATTR, label: "notes" },
    });
  }

  if (chipPriority.showPendingInsights) {
    chips.push({
      label: "Review pending insights",
      action: { type: "prefill", text: "Show me pending insights" },
    });
  }

  if (activeProject) {
    chips.push({
      label: `Continue ${activeProject.label}`,
      action: {
        type: "prefill",
        text: `Continue working on ${activeProject.label}`,
      },
    });
  }

  const stats = statsQuery.data;
  const isLoading = statsQuery.isLoading;

  function handleChipClick(action: WelcomeQuickAction) {
    if (action.type === "file") {
      if (action.label === "transcript") {
        transcriptInputRef.current?.click();
      } else {
        notesInputRef.current?.click();
      }
      return;
    }
    onQuickAction(action);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 py-6">
      <input
        ref={transcriptInputRef}
        type="file"
        className="hidden"
        accept={CAPTURE_TRANSCRIPT_ACCEPT_ATTR}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && onAttachFile) {
            onAttachFile(file, "transcript");
          }
          event.target.value = "";
        }}
      />
      <input
        ref={notesInputRef}
        type="file"
        className="hidden"
        accept={CAPTURE_NOTES_ACCEPT_ATTR}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && onAttachFile) {
            onAttachFile(file, "notes");
          }
          event.target.value = "";
        }}
      />
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{greeting}</h1>
        {showCreateProject ? (
          <CreateProjectCard
            tool={{ toolName: "create_project", input: {} }}
            messageId="welcome-create-project"
            onProjectCreated={onProjectCreated}
          />
        ) : null}
        <div className="flex flex-wrap gap-2.5">
          {chips.map((chip) => (
            <Button
              key={chip.label}
              type="button"
              variant="outline"
              className={CHAT_QUICK_ACTION_BUTTON_CLASS}
              onClick={() => handleChipClick(chip.action)}
            >
              {chip.label}
            </Button>
          ))}
        </div>
      </div>

      <Collapsible open={statsOpen} onOpenChange={setStatsOpen}>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="w-fit px-0 text-muted-foreground">
            {statsOpen ? "Hide workspace stats" : "View workspace stats"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <StatPill
              label="Hours saved"
              value={formatHoursSaved(stats?.potentialTimeSavedMinutes ?? 0)}
              isLoading={isLoading}
            />
            <StatPill
              label="Transcripts processed"
              value={(stats?.totalMeetings ?? 0).toLocaleString()}
              isLoading={isLoading}
            />
            <StatPill
              label="Themes extracted"
              value={(stats?.totalThemes ?? 0).toLocaleString()}
              isLoading={isLoading}
            />
            <StatPill
              label="Active engagements"
              value={(stats?.totalConsultations ?? 0).toLocaleString()}
              isLoading={isLoading}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
