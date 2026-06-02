"use client";

import { createElement, useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveChatCard } from "@/components/chat/cards/index";
import { CreateProjectCard } from "@/components/chat/cards/CreateProjectCard";
import { ProjectSelectionCard } from "@/components/chat/cards/ProjectSelectionCard";
import {
  ChatAnalysisNotifications,
  type ChatAnalysisNotification,
} from "@/components/chat/chat-analysis-notifications";
import {
  isHiddenThreadToolName,
  shouldHideSupersededThemePicker,
} from "@/lib/chat/card-tools";
import { collapseDuplicateProse } from "@/lib/chat/dedupe-prose";
import { stripLeakedToolSyntax } from "@/lib/chat/assistant-output";
import type { ChatToolMessageMeta } from "@/lib/chat/ui-messages";

interface ChatThreadProps {
  messages: UIMessage[];
  isThinking: boolean;
  sessionId: string | null;
  needsConsultationSelection: boolean;
  showCreateProject: boolean;
  analysisNotifications?: ChatAnalysisNotification[];
  onDismissAnalysisNotification?: (id: string) => void;
  onRetry?: () => void;
  onConsultationSelected?: (consultationId: string) => void;
  onProjectCreated?: (consultationId: string) => void;
  onCardUpdated?: () => void;
  onSubmitText?: (text: string) => void | Promise<void>;
}

function getTextFromMessage(message: UIMessage): string {
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
  return collapseDuplicateProse(stripLeakedToolSyntax(text));
}

function getToolMeta(message: UIMessage): ChatToolMessageMeta | null {
  const metadata = message.metadata as { chatTool?: ChatToolMessageMeta } | undefined;
  return metadata?.chatTool ?? null;
}

function ThinkingIndicator() {
  return (
    <div className="flex justify-start py-2" aria-live="polite" role="status">
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        <span>MindMuse is thinking…</span>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  sessionId,
  onCardUpdated,
  onSubmitText,
}: {
  message: UIMessage;
  sessionId: string | null;
  onCardUpdated?: () => void;
  onSubmitText?: (text: string) => void | Promise<void>;
}) {
  const toolMeta = getToolMeta(message);
  if (toolMeta) {
    if (isHiddenThreadToolName(toolMeta.toolName)) {
      return null;
    }
    return (
      <div className="py-2">
        {createElement(resolveChatCard(toolMeta.toolName), {
          tool: toolMeta,
          messageId: message.id,
          sessionId,
          onUpdated: onCardUpdated,
          onSubmitText,
        })}
      </div>
    );
  }

  const text = getTextFromMessage(message);
  if (!text) {
    return null;
  }

  const isUser = message.role === "user";

  return (
    <div className={`flex py-2 ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "border bg-card text-card-foreground"
        }`}
      >
        <p className="whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}

export function ChatThread({
  messages,
  isThinking,
  sessionId,
  needsConsultationSelection,
  showCreateProject,
  analysisNotifications = [],
  onDismissAnalysisNotification,
  onRetry,
  onConsultationSelected,
  onProjectCreated,
  onCardUpdated,
  onSubmitText,
}: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const renderMessages = messages.map((message) => {
    const tool = getToolMeta(message);
    return {
      role: message.role,
      toolName: tool?.toolName,
      status: tool?.status,
    };
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isThinking]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-1 px-4 py-4 pb-36 sm:px-6">
      {showCreateProject ? (
        <div className="py-2">
          <CreateProjectCard
            tool={{ toolName: "create_project", input: {} }}
            messageId="inline-create-project"
            onProjectCreated={onProjectCreated}
          />
        </div>
      ) : null}

      {needsConsultationSelection && sessionId ? (
        <div className="py-2">
          <ProjectSelectionCard
            tool={{ toolName: "select_project", input: {} }}
            messageId="inline-project-selection"
            sessionId={sessionId}
            onConsultationSelected={onConsultationSelected}
          />
        </div>
      ) : null}

      {messages.map((message, index) => (
        shouldHideSupersededThemePicker(renderMessages, index) ? null : (
        <MessageBubble
          key={message.id}
          message={message}
          sessionId={sessionId}
          onCardUpdated={onCardUpdated}
          onSubmitText={onSubmitText}
        />
        )
      ))}

      <ChatAnalysisNotifications
        notifications={analysisNotifications}
        onDismiss={onDismissAnalysisNotification}
      />

      {isThinking ? <ThinkingIndicator /> : null}

      {onRetry ? (
        <div className="py-2">
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Something went wrong — want to try again?
          </Button>
        </div>
      ) : null}

      <div ref={bottomRef} />
    </div>
  );
}
