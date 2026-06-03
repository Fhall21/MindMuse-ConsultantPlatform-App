"use client";

import { useRef, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatSessionList } from "@/components/chat/chat-session-list";
import { CreateProjectCard } from "@/components/chat/cards/CreateProjectCard";
import { ProjectSelectionCard } from "@/components/chat/cards/ProjectSelectionCard";
import type { ChatSessionSummary } from "@/hooks/use-chat-sessions";
import type { WelcomeVariant } from "@/lib/chat/onboarding-copy";
import { getWelcomeGreeting } from "@/lib/chat/onboarding-copy";
import {
  CAPTURE_NOTES_ACCEPT_ATTR,
  CAPTURE_TRANSCRIPT_ACCEPT_ATTR,
} from "@/lib/capture/constants";
import { CHAT_QUICK_ACTION_BUTTON_CLASS } from "@/lib/chat/constants";
import type { ResumeSuggestion } from "@/lib/chat/resume-suggestion";

interface ChatHomeViewProps {
  displayName: string;
  welcomeVariant: WelcomeVariant;
  resumeSuggestion?: ResumeSuggestion | null;
  sessions: ChatSessionSummary[];
  sessionsLoading?: boolean;
  sessionsError?: boolean;
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onAttachFile?: (file: File, kind: "transcript" | "notes") => void;
  isBusy: boolean;
  showCreateProject?: boolean;
  onProjectCreated?: (consultationId: string) => void;
  needsConsultationSelection?: boolean;
  consultationInputBlocked?: boolean;
  sessionId?: string | null;
  onConsultationSelected?: (consultationId: string) => void;
}

const EXAMPLE_PROMPTS = [
  "Extract themes from my most recent meeting transcript.",
  "Draft an evidence summary email from my last meeting.",
  "Help create common themes across the meetings of my project.",
  "Walk me through my pending insights and next steps",
];

export function ChatHomeView({
  displayName,
  welcomeVariant,
  resumeSuggestion,
  sessions,
  sessionsLoading = false,
  sessionsError = false,
  activeSessionId,
  onSelectSession,
  input,
  onInputChange,
  onSend,
  onAttachFile,
  isBusy,
  showCreateProject = false,
  onProjectCreated,
  needsConsultationSelection = false,
  consultationInputBlocked = false,
  sessionId = null,
  onConsultationSelected,
}: ChatHomeViewProps) {
  const inputDisabled = isBusy || consultationInputBlocked;
  const inputPlaceholder = consultationInputBlocked
    ? "Choose a consultation project above before you send a message."
    : "Describe what you need, or pick a starting point below…";
  const transcriptInputRef = useRef<HTMLInputElement>(null);
  const notesInputRef = useRef<HTMLInputElement>(null);

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!input.trim() || inputDisabled) return;
      onSend();
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!input.trim() || inputDisabled) return;
    onSend();
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-0">
      {onAttachFile ? (
        <>
          <input
            ref={transcriptInputRef}
            type="file"
            className="hidden"
            accept={CAPTURE_TRANSCRIPT_ACCEPT_ATTR}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onAttachFile(file, "transcript");
              e.target.value = "";
            }}
          />
          <input
            ref={notesInputRef}
            type="file"
            className="hidden"
            accept={CAPTURE_NOTES_ACCEPT_ATTR}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onAttachFile(file, "notes");
              e.target.value = "";
            }}
          />
        </>
      ) : null}

      {/* Hero heading */}
      <div className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight">
          {getWelcomeGreeting(welcomeVariant, displayName)}
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          Upload material, extract themes, and draft evidence — in one
          conversation.
        </p>
      </div>

      {/* CreateProjectCard — part of the hero when onboarding */}
      {showCreateProject ? (
        <div className="mb-8">
          <CreateProjectCard
            tool={{ toolName: "create_project", input: {} }}
            messageId="home-create-project"
            onProjectCreated={onProjectCreated}
          />
        </div>
      ) : null}

      {needsConsultationSelection && sessionId ? (
        <div className="mb-8">
          <ProjectSelectionCard
            tool={{ toolName: "select_project", input: {} }}
            messageId="home-project-selection"
            sessionId={sessionId}
            onConsultationSelected={onConsultationSelected}
          />
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-3">
        {resumeSuggestion ? (
          <button
            type="button"
            onClick={() => onInputChange(resumeSuggestion.prefill)}
            className="rounded-full border border-border/60 bg-muted/50 px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
          >
            {resumeSuggestion.label}
          </button>
        ) : null}
        <Textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={inputPlaceholder}
          disabled={inputDisabled}
          rows={4}
          className="min-h-[140px] resize-none text-base"
          autoFocus
        />

        {/* Example prompts — shown when textarea is empty */}
        {!input.trim() && !inputDisabled ? (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {EXAMPLE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onInputChange(prompt)}
                className="rounded-md border border-border/60 bg-background px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          {onAttachFile ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={inputDisabled}
                className={CHAT_QUICK_ACTION_BUTTON_CLASS}
                onClick={() => transcriptInputRef.current?.click()}
              >
                Attach transcript
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={inputDisabled}
                className={CHAT_QUICK_ACTION_BUTTON_CLASS}
                onClick={() => notesInputRef.current?.click()}
              >
                Attach notes
              </Button>
            </div>
          ) : (
            <div />
          )}
          <Button
            type="submit"
            disabled={inputDisabled || !input.trim()}
            className="min-h-11 shrink-0"
          >
            Send
          </Button>
        </div>
      </form>

      {/* Previous conversations */}
      {sessions.length > 0 || sessionsLoading ? (
        <div className="mt-12 border-t border-border/50 pt-8">
          <ChatSessionList
            sessions={sessions}
            activeSessionId={activeSessionId}
            isLoading={sessionsLoading}
            error={sessionsError}
            onSelectSession={onSelectSession}
          />
        </div>
      ) : null}
    </div>
  );
}
