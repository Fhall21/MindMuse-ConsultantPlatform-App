"use client";

import type { RefObject } from "react";
import type { UIMessage } from "ai";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatThread } from "@/components/chat/ChatThread";
import type { ChatAnalysisNotification } from "@/components/chat/chat-analysis-notifications";
import type { SuggestedResponseOption } from "@/lib/chat/suggested-responses";

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
  consultationInputBlocked?: boolean;
  hideInput?: boolean;
  showCreateProject: boolean;
  showRetry: boolean;
  onRetry?: () => void;
  onConsultationSelected?: (consultationId: string) => void;
  onProjectCreated?: (consultationId: string) => void;
  onCardUpdated?: () => void;
  onSubmitText?: (text: string) => boolean | Promise<boolean>;
  analysisNotifications?: ChatAnalysisNotification[];
  onDismissAnalysisNotification?: (id: string) => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  suggestedResponses?: SuggestedResponseOption[] | null;
  onSelectSuggestion?: (prefill: string) => void;
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
  consultationInputBlocked = false,
  hideInput = false,
  showCreateProject,
  showRetry,
  onRetry,
  onConsultationSelected,
  onProjectCreated,
  onCardUpdated,
  onSubmitText,
  analysisNotifications = [],
  onDismissAnalysisNotification,
  textareaRef,
  suggestedResponses = null,
  onSelectSuggestion,
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
            onSubmitText={onSubmitText}
          />
        </div>
      </div>
      {hideInput ? null : (
        <ChatInput
          value={input}
          onChange={onInputChange}
          onSubmit={onSend}
          disabled={isBusy}
          blockedReason={
            consultationInputBlocked
              ? "Choose a project above before you send a message."
              : null
          }
          onAttachFile={onAttachFile}
          textareaRef={textareaRef}
          suggestedResponses={suggestedResponses}
          onSelectSuggestion={onSelectSuggestion}
        />
      )}
    </div>
  );
}
