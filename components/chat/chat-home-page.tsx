"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CardConfirmProvider } from "@/components/chat/card-confirm-context";
import { stripLeakedToolSyntax } from "@/lib/chat/assistant-output";
import { ChatPageHeader } from "@/components/chat/chat-page-header";
import { NotificationBell } from "@/components/chat/notification-bell";
import { ChatShell } from "@/components/chat/ChatShell";
import { ChatHomeView } from "@/components/chat/ChatHomeView";
import {
  FILE_ATTACH_STARTED_COPY,
  type WelcomeVariant,
} from "@/lib/chat/onboarding-copy";
import type { OnboardingAccountState } from "@/lib/chat/onboarding-state";
import { fetchJson } from "@/hooks/api";
import { useChatSessions } from "@/hooks/use-chat-sessions";
import { useConsultations } from "@/hooks/use-consultations";
import { captureFileForChatIntake } from "@/lib/capture/chat-file-intake";
import { mergeBootstrapWithStreamingAssistant } from "@/lib/chat/merge-bootstrap-messages";
import type { CrossAnalysisResults } from "@/lib/chat/analysis-db";
import type { ChatAnalysisNotification } from "@/components/chat/chat-analysis-notifications";
import type { ResumeSuggestion } from "@/lib/chat/resume-suggestion";

interface ChatBootstrap {
  sessionId: string;
  consultationId: string | null;
  userMode: "onboarding" | "returning";
  needsConsultationSelection: boolean;
  onboardingState: OnboardingAccountState;
  welcomeVariant: WelcomeVariant;
  resumeSuggestion: ResumeSuggestion | null;
  messages: UIMessage[];
}

interface ChatHomePageProps {
  displayName: string;
}

function buildBootstrapUrl(sessionId?: string | null, createNew = false) {
  const params = new URLSearchParams();
  if (createNew) {
    params.set("new", "true");
  } else if (sessionId) {
    params.set("sessionId", sessionId);
  }
  const query = params.toString();
  return query ? `/api/chat/bootstrap?${query}` : "/api/chat/bootstrap";
}

export function ChatHomePage({ displayName }: ChatHomePageProps) {
  const [input, setInput] = useState("");
  const [view, setView] = useState<"home" | "chat">("home");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [consultationId, setConsultationId] = useState<string | null>(null);
  const [needsConsultationSelection, setNeedsConsultationSelection] = useState(false);
  const [onboardingState, setOnboardingState] = useState<OnboardingAccountState | null>(null);
  const [welcomeVariant, setWelcomeVariant] = useState<WelcomeVariant>("brand_new");
  const [resumeSuggestion, setResumeSuggestion] = useState<ResumeSuggestion | null>(null);
  const [bootstrapError, setBootstrapError] = useState(false);
  const [bootstrapReady, setBootstrapReady] = useState(false);
  const [isCapturingFile, setIsCapturingFile] = useState(false);
  const [isSwitchingSession, setIsSwitchingSession] = useState(false);
  const [createProjectCardPinned, setCreateProjectCardPinned] = useState(false);
  const [analysisNotifications, setAnalysisNotifications] = useState<ChatAnalysisNotification[]>(
    []
  );
  const seenAnalysisTaskIdsRef = useRef<Set<string>>(new Set());
  const sessionIdRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const consultationsQuery = useConsultations();
  const sessionsQuery = useChatSessions();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        credentials: "include",
        fetch: async (input, init) => {
          const response = await fetch(input, init);
          const nextSessionId = response.headers.get("X-Chat-Session-Id");
          if (nextSessionId) {
            setSessionId(nextSessionId);
          }
          const needsSelection = response.headers.get("X-Chat-Needs-Consultation-Selection");
          setNeedsConsultationSelection(needsSelection === "true");
          return response;
        },
      }),
    []
  );

  const { messages, sendMessage, status, error, setMessages, regenerate, clearError } =
    useChat({
      transport,
      messages: [],
    });

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const applyBootstrap = useCallback(
    (data: ChatBootstrap) => {
      setSessionId(data.sessionId);
      setConsultationId(data.consultationId);
      setNeedsConsultationSelection(data.needsConsultationSelection);
      setOnboardingState(data.onboardingState);
      setWelcomeVariant(data.welcomeVariant);
      setResumeSuggestion(data.resumeSuggestion);
      setMessages(data.messages);
      setBootstrapError(false);
    },
    [setMessages]
  );

  const loadBootstrap = useCallback(
    async (options?: {
      sessionId?: string | null;
      createNew?: boolean;
      mergeStreaming?: boolean;
    }) => {
      const data = await fetchJson<ChatBootstrap>(
        buildBootstrapUrl(options?.sessionId, options?.createNew)
      );
      if (options?.mergeStreaming) {
        setSessionId(data.sessionId);
        setConsultationId(data.consultationId);
        setNeedsConsultationSelection(data.needsConsultationSelection);
        setOnboardingState(data.onboardingState);
        setWelcomeVariant(data.welcomeVariant);
        setResumeSuggestion(data.resumeSuggestion);
        setMessages((current) =>
          mergeBootstrapWithStreamingAssistant(current, data.messages)
        );
        setBootstrapError(false);
      } else {
        applyBootstrap(data);
      }
      return data;
    },
    [applyBootstrap, setMessages]
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrapInitialSession() {
      try {
        const data = await loadBootstrap();
        if (!cancelled) {
          setBootstrapError(false);
          if (data.messages.length > 0) {
            setView("chat");
          }
        }
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) {
          setBootstrapError(true);
        }
      } finally {
        if (!cancelled) {
          setBootstrapReady(true);
        }
      }
    }

    void bootstrapInitialSession();
    return () => {
      cancelled = true;
    };
  }, [loadBootstrap]);

  const listableSessions = useMemo(
    () => (sessionsQuery.data ?? []).filter((session) => session.messageCount > 0),
    [sessionsQuery.data]
  );

  const handleSelectSession = useCallback(
    async (nextSessionId: string) => {
      if (!nextSessionId || nextSessionId === sessionId || isSwitchingSession) {
        return;
      }

      setIsSwitchingSession(true);
      clearError();
      setInput("");
      setCreateProjectCardPinned(false);
      try {
        await loadBootstrap({ sessionId: nextSessionId });
        setView("chat");
      } catch (switchError) {
        console.error(switchError);
        toast.error("Could not open that conversation.");
      } finally {
        setIsSwitchingSession(false);
      }
    },
    [clearError, isSwitchingSession, loadBootstrap, sessionId]
  );

  const handleBackToHome = useCallback(async () => {
    if (isSwitchingSession) {
      return;
    }

    setView("home");
    setIsSwitchingSession(true);
    clearError();
    setInput("");
    setCreateProjectCardPinned(false);
    try {
      await loadBootstrap({ createNew: true });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSwitchingSession(false);
    }
  }, [clearError, isSwitchingSession, loadBootstrap]);

  useEffect(() => {
    if (status === "ready" && messages.length > 0) {
      queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
    }
  }, [messages.length, queryClient, status]);

  const wasStreamingRef = useRef(false);
  useEffect(() => {
    if (status === "submitted" || status === "streaming") {
      wasStreamingRef.current = true;
      return;
    }

    if (status !== "ready" || !wasStreamingRef.current) {
      return;
    }

    wasStreamingRef.current = false;
    const activeSessionId = sessionIdRef.current;
    if (!activeSessionId) {
      return;
    }

    void loadBootstrap({ sessionId: activeSessionId, mergeStreaming: true }).catch(
      (reloadError) => {
        console.error(reloadError);
      }
    );
  }, [loadBootstrap, status]);

  const showCreateProject =
    bootstrapReady &&
    !bootstrapError &&
    (createProjectCardPinned ||
      (onboardingState?.phase === "needs_consultation" && !consultationId));

  const activeProject = useMemo(() => {
    const consultations = consultationsQuery.data ?? [];
    if (consultationId) {
      return consultations.find((item) => item.id === consultationId) ?? null;
    }
    if (consultations.length === 1) {
      return consultations[0];
    }
    return null;
  }, [consultationId, consultationsQuery.data]);

  const consultationInputBlocked =
    needsConsultationSelection &&
    !consultationId &&
    (consultationsQuery.data?.length ?? 0) >= 2;

  const isBusy =
    !bootstrapReady ||
    isCapturingFile ||
    isSwitchingSession ||
    status === "submitted" ||
    status === "streaming";
  const lastAssistantText = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role !== "assistant") {
        continue;
      }
      const text = message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("");
      const visibleText = stripLeakedToolSyntax(text);
      if (visibleText.trim()) {
        return visibleText;
      }
    }
    return "";
  }, [messages]);

  const isThinking =
    status === "submitted" || (status === "streaming" && !lastAssistantText.trim());

  const sessionPreview = useMemo(() => {
    if (activeProject?.label) return activeProject.label;
    const firstUserMsg = messages.find((m) => m.role === "user");
    if (!firstUserMsg) return null;
    const text = firstUserMsg.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("")
      .trim();
    return text.length > 50 ? text.slice(0, 50) + "…" : text || null;
  }, [activeProject, messages]);

  const sendUserText = useCallback(
    async (text: string): Promise<boolean> => {
      const trimmed = text.trim();
      if (!trimmed) {
        return false;
      }
      if (isBusy) {
        toast.info("Wait for MindMuse to finish responding, then try again.");
        return false;
      }
      if (consultationInputBlocked) {
        toast.info("Choose a consultation project before you send a message.");
        return false;
      }

      setView("chat");
      clearError();
      setInput("");
      await sendMessage(
        { text: trimmed },
        {
          body: {
            sessionId: sessionIdRef.current ?? undefined,
          },
        }
      );
      return true;
    },
    [clearError, consultationInputBlocked, isBusy, sendMessage]
  );

  const handleSend = useCallback(() => {
    void sendUserText(input);
  }, [input, sendUserText]);

  const handleAttachFile = useCallback(
    async (file: File, kind: "transcript" | "notes") => {
      if (isBusy || consultationInputBlocked) {
        if (consultationInputBlocked) {
          toast.info("Choose a consultation project before you attach a file.");
        }
        return;
      }

      if (onboardingState?.phase === "needs_consultation") {
        toast.info(FILE_ATTACH_STARTED_COPY);
      }

      setIsCapturingFile(true);
      try {
        const { intakeKind, text } = await captureFileForChatIntake(file, kind);
        const activeSessionId = sessionIdRef.current;
        if (!activeSessionId) {
          throw new Error("Chat session is not ready yet. Refresh and try again.");
        }

        clearError();
        setInput("");

        const response = await fetch("/api/chat/intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            sessionId: activeSessionId,
            intakeKind,
            fileName: file.name,
            text,
            projectId: consultationId,
          }),
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { detail?: string } | null;
          throw new Error(data?.detail ?? "Could not process that file.");
        }

        const payload = (await response.json()) as { sessionId?: string };
        await loadBootstrap({ sessionId: payload.sessionId ?? activeSessionId });
        setView("chat");
      } catch (captureError) {
        console.error(captureError);
        toast.error(
          captureError instanceof Error
            ? captureError.message
            : "Could not process that file. Try again or paste the text manually."
        );
      } finally {
        setIsCapturingFile(false);
      }
    },
    [
      clearError,
      consultationId,
      consultationInputBlocked,
      isBusy,
      loadBootstrap,
      onboardingState?.phase,
    ]
  );

  const handleCardUpdated = useCallback(() => {
    const activeSessionId = sessionIdRef.current;
    if (!activeSessionId) {
      return;
    }
    void loadBootstrap({ sessionId: activeSessionId }).catch((reloadError) => {
      console.error(reloadError);
    });
  }, [loadBootstrap]);

  useEffect(() => {
    if (!consultationId) {
      return;
    }

    let interval: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      try {
        const data = await fetchJson<{
          status: string;
          task_id: string;
          results?: CrossAnalysisResults;
        }>(`/api/analysis/status/${consultationId}`);

        if (
          data.status === "complete" &&
          data.results &&
          data.task_id &&
          !seenAnalysisTaskIdsRef.current.has(data.task_id)
        ) {
          seenAnalysisTaskIdsRef.current.add(data.task_id);
          setAnalysisNotifications((current) => [
            ...current,
            {
              id: data.task_id,
              consultationId,
              results: data.results!,
            },
          ]);
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
        }
      } catch (pollError) {
        console.warn("[chat-home] analysis poll failed", pollError);
      }
    };

    void poll();
    interval = setInterval(() => {
      void poll();
    }, 30_000);

    const onVisibilityChange = () => {
      void poll();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [consultationId]);

  const handleDismissAnalysisNotification = useCallback((id: string) => {
    setAnalysisNotifications((current) => current.filter((item) => item.id !== id));
  }, []);

  const handleConsultationSelected = useCallback(
    (nextConsultationId: string) => {
      setConsultationId(nextConsultationId);
      setNeedsConsultationSelection(false);
      queryClient.invalidateQueries({ queryKey: ["consultations"] });
    },
    [queryClient]
  );

  return (
    <CardConfirmProvider>
      <div
        className={
          view === "chat"
            ? "-mx-4 -my-5 flex h-[calc(100dvh-3rem)] max-h-[calc(100dvh-3rem)] flex-col overflow-hidden sm:-mx-6"
            : "-mx-4 -my-5 sm:-mx-6"
        }
      >
        <div className="shrink-0 px-4 pt-4 sm:px-6">
          <ChatPageHeader
            view={view}
            sessionPreview={sessionPreview}
            onBackToHome={() => {
              void handleBackToHome();
            }}
            rightSlot={<NotificationBell />}
          />
        </div>
        {view === "home" ? (
          <div className="px-4 sm:px-6">
            <ChatHomeView
              displayName={displayName}
              input={input}
              onInputChange={setInput}
              onSend={handleSend}
              onAttachFile={handleAttachFile}
              isBusy={isBusy}
              consultationInputBlocked={consultationInputBlocked}
              needsConsultationSelection={needsConsultationSelection}
              sessionId={sessionId}
              onConsultationSelected={handleConsultationSelected}
              sessions={listableSessions}
              sessionsLoading={sessionsQuery.isLoading}
              sessionsError={Boolean(sessionsQuery.error)}
              onSelectSession={(nextSessionId) => {
                void handleSelectSession(nextSessionId);
              }}
              activeSessionId={sessionId}
              welcomeVariant={welcomeVariant}
              resumeSuggestion={resumeSuggestion}
              showCreateProject={showCreateProject}
              onProjectCreated={(nextConsultationId) => {
                setCreateProjectCardPinned(false);
                setConsultationId(nextConsultationId);
              }}
            />
          </div>
        ) : (
          <ChatShell
            messages={messages}
            input={input}
            onInputChange={setInput}
            onSend={handleSend}
            onAttachFile={handleAttachFile}
            isBusy={isBusy}
            isThinking={isThinking}
            isUnavailable={bootstrapError}
            sessionId={sessionId}
            needsConsultationSelection={needsConsultationSelection}
            consultationInputBlocked={consultationInputBlocked}
            showCreateProject={showCreateProject}
            showRetry={Boolean(error)}
            onRetry={() => {
              clearError();
              void regenerate();
            }}
            onConsultationSelected={handleConsultationSelected}
            onProjectCreated={(nextConsultationId) => {
              setCreateProjectCardPinned(false);
              setConsultationId(nextConsultationId);
            }}
            onCardUpdated={handleCardUpdated}
            onSubmitText={sendUserText}
            analysisNotifications={analysisNotifications}
            onDismissAnalysisNotification={handleDismissAnalysisNotification}
          />
        )}
      </div>
    </CardConfirmProvider>
  );
}
