"use client";

import type { UIMessage } from "ai";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatSessionList } from "@/components/chat/chat-session-list";
import { ChatThread } from "@/components/chat/ChatThread";
import { WelcomeState, type WelcomeQuickAction } from "@/components/chat/WelcomeState";
import type { ChatSessionSummary } from "@/hooks/use-chat-sessions";
import type { WelcomeVariant } from "@/lib/chat/onboarding-copy";
import type { OnboardingPhase } from "@/lib/chat/onboarding-state";
import type { Consultation } from "@/types/db";

interface ChatShellProps {
  displayName: string;
  welcomeVariant: WelcomeVariant;
  onboardingPhase: OnboardingPhase;
  activeProject: Consultation | null;
  messages: UIMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onQuickAction: (action: WelcomeQuickAction) => void;
  onAttachFile?: (file: File, kind: "transcript" | "notes") => void;
  isBusy: boolean;
  isThinking: boolean;
  isUnavailable: boolean;
  sessionId: string | null;
  needsConsultationSelection: boolean;
  showCreateProject: boolean;
  showCreateProjectInWelcome: boolean;
  showRetry: boolean;
  onRetry?: () => void;
  onConsultationSelected?: (consultationId: string) => void;
  onProjectCreated?: (consultationId: string) => void;
  showSessionList?: boolean;
  priorSessions?: ChatSessionSummary[];
  sessionsLoading?: boolean;
  sessionsError?: boolean;
  onSelectSession?: (sessionId: string) => void;
}

export function ChatShell({
  displayName,
  welcomeVariant,
  onboardingPhase,
  activeProject,
  messages,
  input,
  onInputChange,
  onSend,
  onQuickAction,
  onAttachFile,
  isBusy,
  isThinking,
  isUnavailable,
  sessionId,
  needsConsultationSelection,
  showCreateProject,
  showCreateProjectInWelcome,
  showRetry,
  onRetry,
  onConsultationSelected,
  onProjectCreated,
  showSessionList = false,
  priorSessions = [],
  sessionsLoading = false,
  sessionsError = false,
  onSelectSession,
}: ChatShellProps) {
  const showWelcome = messages.length === 0 && !isThinking;

  if (isUnavailable) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <p className="max-w-md text-sm text-muted-foreground">
            The assistant is temporarily unavailable. Use the sidebar to navigate.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {showWelcome ? (
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pb-6 sm:px-0">
            <WelcomeState
              displayName={displayName}
              welcomeVariant={welcomeVariant}
              onboardingPhase={onboardingPhase}
              activeProject={activeProject}
              showCreateProject={showCreateProjectInWelcome}
              onQuickAction={onQuickAction}
              onAttachFile={onAttachFile}
              onProjectCreated={onProjectCreated}
            />
            {showSessionList && onSelectSession ? (
              <ChatSessionList
                sessions={priorSessions}
                activeSessionId={sessionId}
                isLoading={sessionsLoading}
                error={sessionsError}
                onSelectSession={onSelectSession}
              />
            ) : null}
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-2xl flex-col">
            {showSessionList && onSelectSession ? (
              <div className="px-4 sm:px-0">
                <ChatSessionList
                  sessions={priorSessions}
                  activeSessionId={sessionId}
                  isLoading={sessionsLoading}
                  error={sessionsError}
                  onSelectSession={onSelectSession}
                />
              </div>
            ) : null}
            <ChatThread
              messages={messages}
              isThinking={isThinking}
              sessionId={sessionId}
              needsConsultationSelection={needsConsultationSelection}
              showCreateProject={showCreateProject}
              onRetry={showRetry ? onRetry : undefined}
              onConsultationSelected={onConsultationSelected}
              onProjectCreated={onProjectCreated}
            />
          </div>
        )}
      </div>
      <ChatInput
        value={input}
        onChange={onInputChange}
        onSubmit={onSend}
        disabled={isBusy}
        onAttachFile={onAttachFile}
      />
    </div>
  );
}
