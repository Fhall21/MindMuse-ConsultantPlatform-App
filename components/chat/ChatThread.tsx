"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveChatCard } from "@/components/chat/cards/index";
import { CreateProjectCard } from "@/components/chat/cards/CreateProjectCard";
import { ProjectSelectionCard } from "@/components/chat/cards/ProjectSelectionCard";
import { isHiddenThreadToolName } from "@/lib/chat/card-tools";
import type { ChatToolMessageMeta } from "@/lib/chat/ui-messages";

interface ChatThreadProps {
  messages: UIMessage[];
  isThinking: boolean;
  sessionId: string | null;
  needsConsultationSelection: boolean;
  showCreateProject: boolean;
  onRetry?: () => void;
  onConsultationSelected?: (consultationId: string) => void;
  onProjectCreated?: (consultationId: string) => void;
  onCardUpdated?: () => void;
}

function getTextFromMessage(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function getToolMeta(message: UIMessage): ChatToolMessageMeta | null {
  const metadata = message.metadata as { chatTool?: ChatToolMessageMeta } | undefined;
  return metadata?.chatTool ?? null;
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-2" aria-live="polite" aria-label="Assistant is thinking">
      <span className="size-2 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:0ms]" />
      <span className="size-2 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:150ms]" />
      <span className="size-2 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:300ms]" />
    </div>
  );
}

function MessageBubble({
  message,
  sessionId,
  onCardUpdated,
}: {
  message: UIMessage;
  sessionId: string | null;
  onCardUpdated?: () => void;
}) {
  const toolMeta = getToolMeta(message);
  if (toolMeta) {
    if (isHiddenThreadToolName(toolMeta.toolName)) {
      return null;
    }
    const Card = resolveChatCard(toolMeta.toolName);
    return (
      <div className="py-2">
        <Card
          tool={toolMeta}
          messageId={message.id}
          sessionId={sessionId}
          onUpdated={onCardUpdated}
        />
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
  onRetry,
  onConsultationSelected,
  onProjectCreated,
  onCardUpdated,
}: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isThinking]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-1 px-4 py-4 sm:px-6">
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

      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          sessionId={sessionId}
          onCardUpdated={onCardUpdated}
        />
      ))}

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
