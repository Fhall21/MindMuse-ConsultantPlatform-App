import { openai } from "@ai-sdk/openai";
import { stepCountIs, streamText, type UIMessage } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import {
  CHAT_CONSECUTIVE_TOOL_ERROR_HINT_THRESHOLD,
  CHAT_MAX_TOOL_ROUNDTRIPS,
  MANUAL_NAV_HINT,
} from "@/lib/chat/constants";
import {
  buildProjectContextSummary,
  countActiveConsultations,
  createChatSession,
  getUnarchivedSessionForUser,
  inferConsultationForSession,
} from "@/lib/chat/context";
import {
  checkAutoIntakeSuppressed,
  countConsecutiveToolErrors,
  getLastReversibleAction,
  getPendingSessionItem,
  insertChatMessage,
  loadRecentChatMessages,
  summarizeOverflowMessages,
  toModelMessages,
} from "@/lib/chat/persist";
import { acquireSessionLock, releaseSessionLock } from "@/lib/chat/session-lock";
import {
  buildDynamicSystemPrompt,
  type ProactiveTriggerFlags,
  type SessionRuntimeContext,
} from "@/lib/chat/system-prompts";
import { loadOnboardingAccountState } from "@/lib/chat/onboarding-state";
import { sessionTurnIncludesCardTool } from "@/lib/chat/card-tools";
import { createChatTools } from "@/lib/chat/tools";

export const maxDuration = 60;

import { getChatModel } from "@/lib/chat/model";
const chatRequestSchema = z.object({
  id: z.string().optional(),
  messages: z.array(z.custom<UIMessage>()),
  sessionId: z.string().uuid().optional(),
});

function getLatestUserMessage(messages: UIMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "user") {
      continue;
    }

    const text = message.parts
      ?.filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();

    if (text) {
      return text;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON payload" }, { status: 422 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { detail: parsed.error.issues[0]?.message ?? "Invalid chat payload" },
      { status: 422 }
    );
  }

  let session =
    (await getUnarchivedSessionForUser(auth.id, parsed.data.sessionId)) ??
    (await createChatSession(auth.id));

  const consultationId = await inferConsultationForSession({
    userId: auth.id,
    sessionId: session.id,
    consultationId: session.consultationId,
  });

  if (consultationId && consultationId !== session.consultationId) {
    session = { ...session, consultationId };
  }

  const lockAcquired = await acquireSessionLock(session.id);
  if (!lockAcquired) {
    return NextResponse.json(
      { detail: "Chat session is busy. Wait for the current response to finish." },
      { status: 409 }
    );
  }

  try {
    const latestUserText = getLatestUserMessage(parsed.data.messages);
    if (latestUserText) {
      const recent = await loadRecentChatMessages(session.id, 1);
      const lastStored = recent[recent.length - 1];
      if (!lastStored || lastStored.role !== "user" || lastStored.content !== latestUserText) {
        await insertChatMessage({
          sessionId: session.id,
          role: "user",
          content: latestUserText,
        });
      }
    }

    void summarizeOverflowMessages(session.id).catch((error) => {
      console.error("[chat] background summarization failed", error);
    });

    const storedMessages = await loadRecentChatMessages(session.id);
    const isFirstTurn = storedMessages.length === 1;
    const isFirstTurnReturning =
      isFirstTurn && session.userMode === "returning" && !!session.consultationId;

    const [
      contextSummary,
      consecutiveToolErrors,
      activeConsultations,
      onboardingState,
      autoIntakeSuppressed,
      lastAction,
      pendingItem,
    ] = await Promise.all([
      buildProjectContextSummary(auth.id, session.consultationId),
      countConsecutiveToolErrors(session.id),
      countActiveConsultations(auth.id),
      loadOnboardingAccountState(auth.id),
      checkAutoIntakeSuppressed(session.id),
      getLastReversibleAction(session.id),
      isFirstTurnReturning && session.consultationId
        ? getPendingSessionItem(session.consultationId)
        : Promise.resolve(null),
    ]);

    const sessionContext: SessionRuntimeContext = {
      lastAction: lastAction
        ? {
            toolName: lastAction.toolName,
            createdAt: lastAction.createdAt,
            input: lastAction.input as Record<string, unknown> | null,
          }
        : null,
      pendingItem: pendingItem
        ? {
            toolName: pendingItem.toolName,
            input: pendingItem.input as Record<string, unknown> | null,
          }
        : null,
      isFirstTurnReturning,
    };

    const proactiveTriggers: ProactiveTriggerFlags = {};
    if (contextSummary) {
      if (contextSummary.meetingCount >= 2 && contextSummary.groupCount === 0) {
        proactiveTriggers.meetingsReadyToGroup = { count: contextSummary.meetingCount };
      }
      if (contextSummary.themeCount > 0 && !onboardingState.hasQuotes) {
        proactiveTriggers.themesNeedQuotes = { count: contextSummary.themeCount };
      }
      if (onboardingState.hasReport && contextSummary.recentMeetings[0]) {
        proactiveTriggers.reportReady = { meetingName: contextSummary.recentMeetings[0].title };
      }
    }

    const systemPrompt = buildDynamicSystemPrompt(onboardingState, contextSummary, {
      proactiveTriggers,
      autoIntakeSuppressed,
      sessionContext,
    });
    const tools = createChatTools({ userId: auth.id, sessionId: session.id });

    const result = streamText({
      model: openai(getChatModel()),
      system: systemPrompt,
      messages: toModelMessages(storedMessages),
      tools,
      stopWhen: stepCountIs(CHAT_MAX_TOOL_ROUNDTRIPS + 1),
      onFinish: async ({ text }) => {
        try {
          const messagesAfterTurn = await loadRecentChatMessages(session.id);
          const cardToolRendered = await sessionTurnIncludesCardTool(messagesAfterTurn);

          if (text.trim() && !cardToolRendered) {
            await insertChatMessage({
              sessionId: session.id,
              role: "assistant",
              content: text,
            });
          }
          void summarizeOverflowMessages(session.id).catch((error) => {
            console.error("[chat] post-turn summarization failed", error);
          });
        } catch (error) {
          console.error("[chat] failed to persist assistant message", error);
        } finally {
          await releaseSessionLock(session.id);
        }
      },
      onAbort: async () => {
        await releaseSessionLock(session.id);
      },
    });

    const responseHeaders: Record<string, string> = {
      "X-Chat-Session-Id": session.id,
    };

    if (
      !session.consultationId &&
      activeConsultations >= 2
    ) {
      responseHeaders["X-Chat-Needs-Consultation-Selection"] = "true";
    }

    if (consecutiveToolErrors >= CHAT_CONSECUTIVE_TOOL_ERROR_HINT_THRESHOLD) {
      responseHeaders["X-Chat-Manual-Nav-Hint"] = MANUAL_NAV_HINT;
    }

    return result.toUIMessageStreamResponse({
      headers: responseHeaders,
    });
  } catch (error) {
    await releaseSessionLock(session.id);
    console.error("[chat] POST /api/chat failed", error);
    return NextResponse.json({ detail: "Chat request failed" }, { status: 500 });
  }
}
