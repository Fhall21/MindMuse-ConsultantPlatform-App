"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { fetchJson } from "@/hooks/api";
import { InterviewSessionContext } from "@/hooks/use-interview-session";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface TopicProgress {
  topic: string;
  covered: boolean;
}

interface ChatResponse {
  assistantMessage: string;
  isComplete: boolean;
  topicsProgress: TopicProgress[];
}

const MAX_CHARS = 2000;
const NEAR_LIMIT = 1800;

export function InterviewChatPage({ shareToken }: { shareToken: string }) {
  const ctx = useContext(InterviewSessionContext);
  if (!ctx) throw new Error("InterviewChatPage must be inside InterviewSessionContext.Provider");

  const { flowTitle, topics, sessionToken, conversationHistory, intervieweeName } = ctx;

  const [messages, setMessages] = useState<Message[]>(conversationHistory);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [topicsProgress, setTopicsProgress] = useState<TopicProgress[]>(
    topics.map((t) => ({ topic: t, covered: false }))
  );

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const coveredCount = topicsProgress.filter((t) => t.covered).length;
  const hasResponded = messages.some((m) => m.role === "assistant");

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || isLoading || isComplete) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setIsLoading(true);

    try {
      const data = await fetchJson<ChatResponse>(
        `/api/public/digital-interviews/${shareToken}/session/${sessionToken}/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userMessage: trimmed }),
        }
      );

      setMessages((prev) => [...prev, { role: "assistant", content: data.assistantMessage }]);
      setTopicsProgress(data.topicsProgress);
      if (data.isComplete) setIsComplete(true);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            err instanceof Error ? err.message : "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm font-medium text-foreground">{flowTitle}</p>
          {hasResponded && (
            <p className="text-xs text-muted-foreground">
              {coveredCount} of {topics.length} topics covered
            </p>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((msg, i) =>
            msg.role === "assistant" ? (
              <div key={i} className="pr-12 text-sm leading-relaxed text-foreground">
                {msg.content}
              </div>
            ) : (
              <div key={i} className="flex justify-end pl-12">
                <div className="rounded-sm bg-muted px-3 py-2 text-sm leading-relaxed text-foreground">
                  {msg.content}
                </div>
              </div>
            )
          )}

          {isLoading && (
            <div className="pr-12 text-sm text-muted-foreground">
              <span className="inline-flex gap-0.5">
                <span className="animate-bounce">•</span>
                <span className="animate-bounce [animation-delay:150ms]">•</span>
                <span className="animate-bounce [animation-delay:300ms]">•</span>
              </span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="sticky bottom-0 border-t border-border bg-background px-4 py-4">
        <div className="mx-auto max-w-2xl">
          {isComplete ? (
            <div className="space-y-4">
              <Separator />
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-foreground">
                  Thank you{intervieweeName ? `, ${intervieweeName}` : ""}.
                </p>
                <p className="text-sm text-muted-foreground">
                  Your responses have been recorded. The consultant will review your input as part
                  of their consultation work.
                </p>
                <p className="text-sm text-muted-foreground">You may now close this window.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Textarea
                  placeholder="Share your thoughts..."
                  rows={3}
                  maxLength={MAX_CHARS}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  className="resize-none"
                />
                {input.length > NEAR_LIMIT && (
                  <p className="mt-1 text-right text-xs text-muted-foreground">
                    {input.length}/{MAX_CHARS}
                  </p>
                )}
              </div>
              <Button onClick={() => void sendMessage()} disabled={isLoading || !input.trim()}>
                Send
              </Button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
