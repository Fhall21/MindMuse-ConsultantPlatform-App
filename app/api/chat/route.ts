import { openai } from "@ai-sdk/openai";
import { stepCountIs, streamText } from "ai";
import type { ChatMessageMetadata } from "@/db/schema/chat";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import {
  CHAT_CONSECUTIVE_TOOL_ERROR_HINT_THRESHOLD,
  CHAT_MAX_CLIENT_MESSAGES,
  CHAT_MAX_MESSAGE_PARTS,
  CHAT_MAX_TOOL_ROUNDTRIPS,
  CHAT_MAX_USER_MESSAGE_CHARS,
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
import { isAskChoiceUserReply } from "@/lib/chat/tools/ask-choice";
import { createChatTools } from "@/lib/chat/tools";
import { TurnCardGate } from "@/lib/chat/turn-card-gate";
import { composeCanvasState } from "@/lib/data/canvas-state";
import { sanitizeAssistantOutput } from "@/lib/chat/assistant-output";
import {
  buildChatMessageMetadata,
  shouldDisplaySuggestedResponses,
} from "@/lib/chat/suggested-responses";
import {
  extractGenerativeSuggestedRepliesFromSteps,
  turnIncludesCardToolFromSteps,
} from "@/lib/chat/tools/emit-suggested-replies";
import { getCurrentMeetingContextForSession } from "@/lib/chat/current-meeting-context";

export const maxDuration = 60;

const CANVAS_KEYWORDS = ["connect", "link", "rename", "frame", "node", "canvas", "group"];

function hasCanvasKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return CANVAS_KEYWORDS.some((kw) => lower.includes(kw));
}

import { getChatModel } from "@/lib/chat/model";
const clientMessageSchema = z
  .object({
    role: z.enum(["user", "assistant", "system"]),
    parts: z.array(z.unknown()).max(CHAT_MAX_MESSAGE_PARTS).optional(),
  })
  .passthrough();

const chatRequestSchema = z.object({
  id: z.string().optional(),
  messages: z.array(clientMessageSchema).max(CHAT_MAX_CLIENT_MESSAGES),
  sessionId: z.string().uuid().optional(),
});

function getLatestUserMessage(messages: z.infer<typeof clientMessageSchema>[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "user") {
      continue;
    }

    const text = message.parts
      ?.filter(
        (part): part is { type: "text"; text: string } =>
          part !== null &&
          typeof part === "object" &&
          "type" in part &&
          part.type === "text" &&
          "text" in part &&
          typeof part.text === "string"
      )
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

    if (latestUserText && latestUserText.length > CHAT_MAX_USER_MESSAGE_CHARS) {
      await releaseSessionLock(session.id);
      return NextResponse.json(
        { detail: "Message is too long. Upload the transcript as a file instead." },
        { status: 422 }
      );
    }

    const [
      contextSummary,
      consecutiveToolErrors,
      activeConsultations,
      onboardingState,
      autoIntakeSuppressed,
      lastAction,
      currentMeeting,
    ] = await Promise.all([
      buildProjectContextSummary(auth.id, session.consultationId),
      countConsecutiveToolErrors(session.id),
      countActiveConsultations(auth.id),
      loadOnboardingAccountState(auth.id),
      checkAutoIntakeSuppressed(session.id),
      getLastReversibleAction(session.id),
      getCurrentMeetingContextForSession({
        userId: auth.id,
        sessionId: session.id,
        consultationId: session.consultationId,
      }),
    ]);
    const promptContextSummary = contextSummary
      ? { ...contextSummary, currentMeeting }
      : contextSummary;

    if (
      latestUserText &&
      !session.consultationId &&
      activeConsultations >= 2 &&
      !isAskChoiceUserReply(latestUserText)
    ) {
      await releaseSessionLock(session.id);
      return NextResponse.json(
        {
          detail:
            "Choose a consultation project above before sending a message.",
        },
        { status: 422 }
      );
    }

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

    const sessionContext: SessionRuntimeContext = {
      lastAction: lastAction
        ? {
            toolName: lastAction.toolName,
            createdAt: lastAction.createdAt,
            input: lastAction.input as Record<string, unknown> | null,
          }
        : null,
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

    let canvasContext: string | undefined;
    if (latestUserText && session.consultationId && hasCanvasKeyword(latestUserText)) {
      try {
        const state = await composeCanvasState(session.consultationId, auth.id);
        const top50 = state.nodes.slice(0, 50);
        if (top50.length > 0) {
          const lines = top50.map(
            (n) =>
              `- ${n.id}: "${n.label}" (type: ${n.type}${n.subgroup ? `, subgroup: ${n.subgroup}` : ""})`
          );
          canvasContext = lines.join("\n");
        }
      } catch {
        // non-fatal — omit canvas context
      }
    }

    const systemPrompt = buildDynamicSystemPrompt(onboardingState, promptContextSummary, {
      proactiveTriggers,
      autoIntakeSuppressed,
      sessionContext,
      canvasContext,
    });
    const tools = createChatTools({
      userId: auth.id,
      sessionId: session.id,
      turnCardGate: new TurnCardGate(),
      latestUserMessage: latestUserText,
      lastMeetingId: currentMeeting?.meeting_id ?? contextSummary?.lastMeetingId ?? null,
    });

    const result = streamText({
      model: openai(getChatModel()),
      system: systemPrompt,
      messages: toModelMessages(storedMessages),
      tools,
      stopWhen: stepCountIs(CHAT_MAX_TOOL_ROUNDTRIPS + 1),
      onFinish: async (event) => {
        try {
          const messagesAfterTurn = await loadRecentChatMessages(session.id);
          const cardToolRendered =
            turnIncludesCardToolFromSteps(event.steps) ||
            (await sessionTurnIncludesCardTool(messagesAfterTurn));
          const choiceFollowUp =
            latestUserText !== null && isAskChoiceUserReply(latestUserText);

          if (event.text.trim() && (!cardToolRendered || choiceFollowUp)) {
            const assistantContent = sanitizeAssistantOutput(event.text);
            let metadata: ChatMessageMetadata | null = null;

            if (!cardToolRendered) {
              const generative = extractGenerativeSuggestedRepliesFromSteps(event.steps);
              if (generative && shouldDisplaySuggestedResponses(generative)) {
                metadata = buildChatMessageMetadata(generative);
              }
            }

            await insertChatMessage({
              sessionId: session.id,
              role: "assistant",
              content: assistantContent,
              metadata,
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
