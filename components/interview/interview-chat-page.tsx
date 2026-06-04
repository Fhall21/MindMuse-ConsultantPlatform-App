"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
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

interface StartInterviewResponse {
  assistantMessage: string;
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
  const [isStarting, setIsStarting] = useState(conversationHistory.length === 0);
  const [isComplete, setIsComplete] = useState(false);
  const [topicsProgress, setTopicsProgress] = useState<TopicProgress[]>(
    topics.map((t) => ({ topic: t, covered: false }))
  );

  const bottomRef = useRef<HTMLDivElement>(null);
  const hasBootstrappedRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (messages.length > 0) {
      setIsStarting(false);
      return;
    }

    if (hasBootstrappedRef.current) {
      return;
    }

    hasBootstrappedRef.current = true;
    setIsStarting(true);

    async function startInterview() {
      try {
        const data = await fetchJson<StartInterviewResponse>(
          `/api/public/digital-interviews/${shareToken}/session/${sessionToken}/chat`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ start: true }),
          }
        );

        setMessages([{ role: "assistant", content: data.assistantMessage }]);
        setTopicsProgress(data.topicsProgress);
      } catch (err) {
        setMessages([
          {
            role: "assistant",
            content:
              err instanceof Error
                ? err.message
                : "The interview is getting ready. Please try again in a moment.",
          },
        ]);
      } finally {
        setIsStarting(false);
      }
    }

    void startInterview();
  }, [messages.length, sessionToken, shareToken]);

  const coveredCount = topicsProgress.filter((t) => t.covered).length;
  const progressLabel = useMemo(() => {
    if (topics.length === 0) {
      return null;
    }

    return `${coveredCount} of ${topics.length} topics covered`;
  }, [coveredCount, topics.length]);

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || isLoading || isStarting || isComplete) return;

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
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header — title + quiet meta, nothing more */}
      <header className="border-b border-border/40 bg-background px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-baseline justify-between gap-6">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground/60">Project interview</p>
            <h1 className="mt-0.5 truncate text-sm font-medium text-foreground">{flowTitle}</h1>
          </div>
          <div className="shrink-0 text-right">
            {intervieweeName && (
              <p className="text-xs text-muted-foreground/70">{intervieweeName}</p>
            )}
            {progressLabel && (
              <p className="text-xs text-muted-foreground/60">{progressLabel}</p>
            )}
          </div>
        </div>
      </header>

      {/* Conversation — the whole product */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-8">

          {/* Topics — quiet collapsible, not always visible */}
          {topics.length > 0 && (
            <details className="group mb-10">
              <summary className="flex cursor-pointer list-none select-none items-center gap-1.5 text-xs text-muted-foreground/50 transition-colors hover:text-muted-foreground">
                <svg
                  className="size-3 rotate-0 transition-transform duration-200 group-open:rotate-90"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 2l4 4-4 4" />
                </svg>
                <span>{topics.length} topics in this interview</span>
              </summary>
              <div className="mt-3 space-y-1 pl-5">
                {topics.map((topic) => {
                  const covered =
                    topicsProgress.find((item) => item.topic === topic)?.covered ?? false;
                  return (
                    <p
                      key={topic}
                      className={
                        covered
                          ? "text-xs leading-5 text-muted-foreground/30 line-through"
                          : "text-xs leading-5 text-muted-foreground/60"
                      }
                    >
                      {topic}
                    </p>
                  );
                })}
              </div>
            </details>
          )}

          {/* One-time context note */}
          <p className="mb-10 text-xs leading-5 text-muted-foreground/50">
            Your responses are recorded for this consultant&apos;s review only. Share what feels
            relevant in your own words — there are no right or wrong answers.
          </p>

          {/* Messages */}
          <div className="space-y-8">
            {messages.map((msg, i) =>
              msg.role === "assistant" ? (
                <div key={i} className="space-y-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/40">
                    Interviewer
                  </span>
                  <p className="max-w-[65ch] text-sm leading-7 text-foreground">{msg.content}</p>
                </div>
              ) : (
                <div key={i} className="pl-8">
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/40">
                      You
                    </span>
                    <div className="w-full bg-muted/50 px-4 py-3 text-sm leading-7 text-foreground">
                      {msg.content}
                    </div>
                  </div>
                </div>
              )
            )}

            {/* Typing indicator */}
            {(isStarting || isLoading) && (
              <div className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/30">
                  Interviewer
                </span>
                <div className="flex items-center gap-1 py-1">
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/25" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/25 [animation-delay:150ms]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/25 [animation-delay:300ms]" />
                </div>
              </div>
            )}
          </div>

          <div ref={bottomRef} />
        </div>
      </main>

      {/* Footer — input only */}
      <footer className="border-t border-border/40 bg-background px-6 pb-8 pt-5">
        <div className="mx-auto max-w-2xl">
          {isComplete ? (
            <div className="space-y-3">
              <Separator className="opacity-30" />
              <p className="text-sm leading-6 text-muted-foreground">
                Thank you{intervieweeName ? `, ${intervieweeName}` : ""}. Your responses have been
                recorded and will be reviewed by the consultant. You may now close this window.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Textarea
                placeholder={
                  isStarting
                    ? "The interviewer is opening the conversation…"
                    : "Share your thoughts…"
                }
                rows={3}
                maxLength={MAX_CHARS}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading || isStarting}
                className="resize-none rounded-none border-0 border-b border-border/50 bg-transparent px-0 text-sm shadow-none placeholder:text-muted-foreground/35 focus-visible:border-foreground/25 focus-visible:ring-0"
              />
              <div className="flex items-center justify-between">
                {input.length > NEAR_LIMIT ? (
                  <p className="text-xs text-muted-foreground">
                    {input.length}/{MAX_CHARS}
                  </p>
                ) : (
                  <span />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void sendMessage()}
                  disabled={isLoading || isStarting || !input.trim()}
                >
                  Send
                </Button>
              </div>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
