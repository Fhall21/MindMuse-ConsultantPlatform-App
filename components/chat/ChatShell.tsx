"use client";

import type { UIMessage } from "ai";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatThread } from "@/components/chat/ChatThread";
import type { ChatAnalysisNotification } from "@/components/chat/chat-analysis-notifications";

interface ChatShellProps {
  messages: UIMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onAttachFile?: (file: File, kind: "transcript" | "notes") => void;
  isBusy: boolean;
  isThinking: boolean;
  isUnavailable: boolean;
  sessionId: string | null;
  needsConsultationSelection: boolean;
  showCreateProject: boolean;
  showRetry: boolean;
  onRetry?: () => void;
  onConsultationSelected?: (consultationId: string) => void;
  onProjectCreated?: (consultationId: string) => void;
  onCardUpdated?: () => void;
  analysisNotifications?: ChatAnalysisNotification[];
  onDismissAnalysisNotification?: (id: string) => void;
}

export function ChatShell({
  messages,
  input,
  onInputChange,
  onSend,
  onAttachFile,
  isBusy,
  isThinking,
  isUnavailable,
  sessionId,
  needsConsultationSelection,
  showCreateProject,
  showRetry,
  onRetry,
  onConsultationSelected,
  onProjectCreated,
  onCardUpdated,
  analysisNotifications = [],
  onDismissAnalysisNotification,
}: ChatShellProps) {
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
        <div className="mx-auto flex w-full max-w-2xl flex-col">
          <ChatThread
            messages={messages}
            isThinking={isThinking}
            sessionId={sessionId}
            needsConsultationSelection={needsConsultationSelection}
            showCreateProject={showCreateProject}
            analysisNotifications={analysisNotifications}
            onDismissAnalysisNotification={onDismissAnalysisNotification}
            onRetry={showRetry ? onRetry : undefined}
            onConsultationSelected={onConsultationSelected}
            onProjectCreated={onProjectCreated}
            onCardUpdated={onCardUpdated}
          />
        </div>
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
