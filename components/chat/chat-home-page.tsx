"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CardConfirmProvider } from "@/components/chat/card-confirm-context";
import { ChatShell } from "@/components/chat/ChatShell";
import type { WelcomeQuickAction } from "@/components/chat/WelcomeState";
import {
  FILE_ATTACH_STARTED_COPY,
  type WelcomeVariant,
} from "@/lib/chat/onboarding-copy";
import type { OnboardingAccountState } from "@/lib/chat/onboarding-state";
import { fetchJson } from "@/hooks/api";
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
  const sessionIdRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const consultationsQuery = useConsultations();

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

  useEffect(() => {
    let cancelled = false;

    async function loadBootstrap() {
      try {
        const data = await fetchJson<ChatBootstrap>("/api/chat/bootstrap");
        if (cancelled) {
          return;
        }
        setSessionId(data.sessionId);
        setConsultationId(data.consultationId);
        setNeedsConsultationSelection(data.needsConsultationSelection);
        setOnboardingState(data.onboardingState);
        setWelcomeVariant(data.welcomeVariant);
        setMessages(data.messages);
        setBootstrapError(false);
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

    void loadBootstrap();
    return () => {
      cancelled = true;
    };
  }, [setMessages]);

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
    [consultationId, isBusy, onboardingState?.phase, sendUserText]
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
      />
    </CardConfirmProvider>
  );
}
