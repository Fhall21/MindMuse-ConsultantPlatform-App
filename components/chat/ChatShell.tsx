"use client";

import type { UIMessage } from "ai";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatThread } from "@/components/chat/ChatThread";
import { WelcomeState, type WelcomeQuickAction } from "@/components/chat/WelcomeState";
import type { Consultation } from "@/types/db";

interface ChatShellProps {
  displayName: string;
  isFirstTime: boolean;
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
}

export function ChatShell({
  displayName,
  isFirstTime,
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
}: ChatShellProps) {
  const showWelcome = messages.length === 0 && !isThinking;

  if (isUnavailable) {
    return (
      <div className="flex h-[calc(100dvh-3rem)] max-h-[calc(100dvh-3rem)] flex-col overflow-hidden">
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <p className="max-w-md text-sm text-muted-foreground">
            The assistant is temporarily unavailable. Use the sidebar to navigate.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-4 -my-5 flex h-[calc(100dvh-3rem)] max-h-[calc(100dvh-3rem)] flex-col overflow-hidden sm:-mx-6">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {showWelcome ? (
          <WelcomeState
            displayName={displayName}
            isFirstTime={isFirstTime}
            activeProject={activeProject}
            showCreateProject={showCreateProjectInWelcome}
            onQuickAction={onQuickAction}
            onAttachFile={onAttachFile}
            onProjectCreated={onProjectCreated}
          />
        ) : (
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
