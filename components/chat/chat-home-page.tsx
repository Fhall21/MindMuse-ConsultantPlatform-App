"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CardConfirmProvider } from "@/components/chat/card-confirm-context";
import { ChatPageHeader } from "@/components/chat/chat-page-header";
import { ChatShell } from "@/components/chat/ChatShell";
import type { WelcomeQuickAction } from "@/components/chat/WelcomeState";
import {
  FILE_ATTACH_STARTED_COPY,
  type WelcomeVariant,
} from "@/lib/chat/onboarding-copy";
import type { OnboardingAccountState } from "@/lib/chat/onboarding-state";
import { fetchJson } from "@/hooks/api";
import { useChatSessions, useCreateChatSession } from "@/hooks/use-chat-sessions";
import { useConsultations } from "@/hooks/use-consultations";
import { captureFileForChatIntake } from "@/lib/capture/chat-file-intake";
import { mergeBootstrapWithStreamingAssistant } from "@/lib/chat/merge-bootstrap-messages";

interface ChatBootstrap {
  sessionId: string;
  consultationId: string | null;
  userMode: "onboarding" | "returning";
  needsConsultationSelection: boolean;
  onboardingState: OnboardingAccountState;
  welcomeVariant: WelcomeVariant;
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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [consultationId, setConsultationId] = useState<string | null>(null);
  const [needsConsultationSelection, setNeedsConsultationSelection] = useState(false);
  const [onboardingState, setOnboardingState] = useState<OnboardingAccountState | null>(null);
  const [welcomeVariant, setWelcomeVariant] = useState<WelcomeVariant>("brand_new");
  const [bootstrapError, setBootstrapError] = useState(false);
  const [bootstrapReady, setBootstrapReady] = useState(false);
  const [isCapturingFile, setIsCapturingFile] = useState(false);
  const [isSwitchingSession, setIsSwitchingSession] = useState(false);
  const [createProjectCardPinned, setCreateProjectCardPinned] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const consultationsQuery = useConsultations();
  const sessionsQuery = useChatSessions();
  const createSessionMutation = useCreateChatSession();

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
        await loadBootstrap();
        if (!cancelled) {
          setBootstrapError(false);
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

  const showSessionList = useMemo(
    () => listableSessions.some((session) => session.id !== sessionId),
    [listableSessions, sessionId]
  );
  const showNewChat = listableSessions.length >= 1;

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
      } catch (switchError) {
        console.error(switchError);
        toast.error("Could not open that conversation.");
      } finally {
        setIsSwitchingSession(false);
      }
    },
    [clearError, isSwitchingSession, loadBootstrap, sessionId]
  );

  const handleNewChat = useCallback(async () => {
    if (createSessionMutation.isPending || isSwitchingSession) {
      return;
    }

    setIsSwitchingSession(true);
    clearError();
    setInput("");
    setCreateProjectCardPinned(false);
    try {
      const created = await createSessionMutation.mutateAsync(
        consultationId ? { consultationId } : undefined
      );
      await loadBootstrap({ sessionId: created.sessionId });
    } catch (createError) {
      console.error(createError);
      toast.error("Could not start a new conversation.");
    } finally {
      setIsSwitchingSession(false);
    }
  }, [
    clearError,
    consultationId,
    createSessionMutation,
    isSwitchingSession,
    loadBootstrap,
  ]);

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
      if (text.trim()) {
        return text;
      }
    }
    return "";
  }, [messages]);

  const isThinking =
    status === "submitted" || (status === "streaming" && !lastAssistantText.trim());

  const sendUserText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isBusy) {
        return;
      }

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
    },
    [clearError, isBusy, sendMessage]
  );

  const handleSend = useCallback(() => {
    void sendUserText(input);
  }, [input, sendUserText]);

  const handleQuickAction = useCallback(
    (action: WelcomeQuickAction) => {
      if (action.type === "prefill") {
        setInput(action.text);
      }
    },
    []
  );

  const handleAttachFile = useCallback(
    async (file: File, kind: "transcript" | "notes") => {
      if (isBusy) {
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
    [clearError, consultationId, isBusy, loadBootstrap, onboardingState?.phase]
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
      <div className="-mx-4 -my-5 flex h-[calc(100dvh-3rem)] max-h-[calc(100dvh-3rem)] flex-col overflow-hidden sm:-mx-6">
        <div className="shrink-0 px-4 pt-1 sm:px-6">
          <ChatPageHeader
            activeProject={activeProject}
            showNewChat={showNewChat}
            onNewChat={() => {
              void handleNewChat();
            }}
            isCreatingSession={createSessionMutation.isPending || isSwitchingSession}
          />
        </div>
        <ChatShell
          displayName={displayName}
          welcomeVariant={welcomeVariant}
          onboardingPhase={onboardingState?.phase ?? "needs_consultation"}
          activeProject={activeProject}
          messages={messages}
          input={input}
          onInputChange={setInput}
          onSend={handleSend}
          onQuickAction={handleQuickAction}
          onAttachFile={handleAttachFile}
          isBusy={isBusy}
          isThinking={isThinking}
          isUnavailable={bootstrapError}
          sessionId={sessionId}
          needsConsultationSelection={needsConsultationSelection}
          showCreateProject={showCreateProject}
          showCreateProjectInWelcome={showCreateProject}
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
          showSessionList={showSessionList}
          priorSessions={listableSessions}
          sessionsLoading={sessionsQuery.isLoading}
          sessionsError={Boolean(sessionsQuery.error)}
          onSelectSession={(nextSessionId) => {
            void handleSelectSession(nextSessionId);
          }}
        />
      </div>
    </CardConfirmProvider>
  );
}
