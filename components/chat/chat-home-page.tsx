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
import {
  buildChatIntakeUserMessage,
  captureFileForChatIntake,
} from "@/lib/capture/chat-file-intake";

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
    async (options?: { sessionId?: string | null; createNew?: boolean }) => {
      const data = await fetchJson<ChatBootstrap>(
        buildBootstrapUrl(options?.sessionId, options?.createNew)
      );
      applyBootstrap(data);
      return data;
    },
    [applyBootstrap]
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

  const showCreateProject =
    bootstrapReady &&
    !bootstrapError &&
    onboardingState?.phase === "needs_consultation" &&
    !consultationId;

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
        const message = buildChatIntakeUserMessage({
          intakeKind,
          fileName: file.name,
          text,
          projectId: consultationId,
        }).trim();
        if (!message) {
          return;
        }

        clearError();
        setInput("");
        await sendMessage(
          { text: message },
          {
            body: {
              sessionId: sessionIdRef.current ?? undefined,
            },
          }
        );
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
    [clearError, consultationId, isBusy, onboardingState?.phase, sendMessage]
  );

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
            setConsultationId(nextConsultationId);
          }}
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
