"use client";

import { ClarificationQuestionItem } from "@/components/chat/clarification-question-item";
import { CARD_DISMISSED_COPY } from "@/lib/chat/onboarding-copy";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import { readClarificationQuestions, type ChatCardProps } from "./types";

export function ClarificationQuestionCard({ tool }: ChatCardProps) {
  const questions = readClarificationQuestions(tool.output);
  const status = tool.status ?? "pending";

  if (questions.length === 0) {
    return null;
  }

  if (status === "dismissed") {
    return (
      <ChatToolCardShell
        dismissed
        title="Clarification dismissed"
        description={CARD_DISMISSED_COPY}
      />
    );
  }

  return (
    <ChatToolCardShell
      maxWidth="2xl"
      title="Clarification needed"
      description="These notes look ambiguous. Answer in the chat before continuing."
    >
      {questions.map((item) => (
        <ClarificationQuestionItem
          key={item.id}
          field={item.field}
          question={item.question}
        />
      ))}
    </ChatToolCardShell>
  );
}
