"use client";

import { createContext, useEffect, useMemo, useState } from "react";
import { fetchJson } from "@/hooks/api";
import type {
  DigitalInterviewResponseRecord,
  PublicDigitalInterviewFlow,
} from "@/lib/data/digital-interviews";

export interface InterviewSessionContextValue {
  flowId: string;
  flowTitle: string;
  framework: string;
  topics: string[];
  depthLevel: string;
  sessionToken: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  intervieweeName: string;
}

export interface InterviewOnboardingValues {
  name: string;
  workType: string;
  work_group: string;
  organisation?: string | null;
  email?: string | null;
}

export type InterviewSessionPhase =
  | "loading"
  | "invalid"
  | "closed"
  | "completed"
  | "onboarding"
  | "chat";

export interface UseInterviewSessionResult {
  phase: InterviewSessionPhase;
  flow: PublicDigitalInterviewFlow | null;
  session: DigitalInterviewResponseRecord | null;
  errorMessage: string | null;
  contextValue: InterviewSessionContextValue | null;
  submitDetails: (values: InterviewOnboardingValues) => Promise<void>;
}

export const InterviewSessionContext = createContext<InterviewSessionContextValue | null>(null);

function getStorageKey(shareToken: string) {
  return `di_session_${shareToken}`;
}

function readStoredSessionToken(shareToken: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(getStorageKey(shareToken));
  } catch {
    return null;
  }
}

function writeStoredSessionToken(shareToken: string, sessionToken: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(getStorageKey(shareToken), sessionToken);
  } catch {
    // Ignore storage failures in constrained browsers.
  }
}

function clearStoredSessionToken(shareToken: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(getStorageKey(shareToken));
  } catch {
    // Ignore storage failures in constrained browsers.
  }
}

function toContextValue(
  flow: PublicDigitalInterviewFlow,
  session: DigitalInterviewResponseRecord
): InterviewSessionContextValue {
  return {
    flowId: flow.id,
    flowTitle: flow.title,
    framework: flow.framework,
    topics: flow.topics,
    depthLevel: flow.depth_level,
    sessionToken: session.session_token,
    conversationHistory: session.conversation_history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    intervieweeName: session.interviewee_name ?? "",
  };
}

export function useInterviewSession(shareToken: string): UseInterviewSessionResult {
  const [phase, setPhase] = useState<InterviewSessionPhase>("loading");
  const [flow, setFlow] = useState<PublicDigitalInterviewFlow | null>(null);
  const [session, setSession] = useState<DigitalInterviewResponseRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadSession() {
      setPhase("loading");
      setErrorMessage(null);
      setFlow(null);
      setSession(null);

      const storedSessionToken = readStoredSessionToken(shareToken);

      async function openSession(sessionToken: string | null) {
        const response = await fetchJson<{ data: DigitalInterviewResponseRecord }>(
          `/api/public/digital-interviews/${shareToken}/session`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(sessionToken ? { sessionToken } : {}),
          }
        );

        return response.data;
      }

      try {
        const loadedFlowResponse = await fetchJson<{ data: PublicDigitalInterviewFlow }>(
          `/api/public/digital-interviews/${shareToken}`
        );
        const loadedFlow = loadedFlowResponse.data;

        if (!isActive) {
          return;
        }

        setFlow(loadedFlow);

        if (loadedFlow.status !== "active") {
          setPhase("closed");
          return;
        }

        let loadedSession: DigitalInterviewResponseRecord;

        try {
          loadedSession = await openSession(storedSessionToken);
        } catch (error) {
          const message = error instanceof Error ? error.message.toLowerCase() : "";
          const shouldRetryFreshSession =
            Boolean(storedSessionToken) &&
            (message.includes("invalid uuid") || message.includes("not found"));

          if (!shouldRetryFreshSession) {
            throw error;
          }

          clearStoredSessionToken(shareToken);
          loadedSession = await openSession(null);
        }

        if (!isActive) {
          return;
        }

        setSession(loadedSession);
        writeStoredSessionToken(shareToken, loadedSession.session_token);

        if (loadedSession.status === "completed") {
          setPhase("completed");
          return;
        }

        if (loadedSession.interviewee_name) {
          setPhase("chat");
          return;
        }

        setPhase("onboarding");
      } catch (error) {
        if (!isActive) {
          return;
        }

        const message = error instanceof Error ? error.message : "Failed to load interview";
        setErrorMessage(message);
        setPhase(message.toLowerCase().includes("not found") ? "invalid" : "invalid");
      }
    }

    void loadSession();

    return () => {
      isActive = false;
    };
  }, [shareToken]);

  const contextValue = useMemo(() => {
    if (!flow || !session || !session.interviewee_name) {
      return null;
    }

    return toContextValue(flow, session);
  }, [flow, session]);

  async function submitDetails(values: InterviewOnboardingValues) {
    const sessionToken = session?.session_token ?? readStoredSessionToken(shareToken);

    if (!sessionToken) {
      throw new Error("Interview session is not ready");
    }

    const updatedSessionResponse = await fetchJson<{ data: DigitalInterviewResponseRecord }>(
      `/api/public/digital-interviews/${shareToken}/session/${sessionToken}/details`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: values.name,
          work_type: values.workType,
          work_group: values.work_group,
          organisation: values.organisation ?? null,
          email: values.email ?? null,
        }),
      }
    );
    const updatedSession = updatedSessionResponse.data;

    setSession(updatedSession);
    writeStoredSessionToken(shareToken, updatedSession.session_token);
    setPhase(updatedSession.status === "completed" ? "completed" : "chat");
  }

  return {
    phase,
    flow,
    session,
    errorMessage,
    contextValue,
    submitDetails,
  };
}
