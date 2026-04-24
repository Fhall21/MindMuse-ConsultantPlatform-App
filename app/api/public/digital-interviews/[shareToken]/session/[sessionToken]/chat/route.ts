import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  appendDigitalInterviewMessage,
  appendDigitalInterviewExchange,
  completeDigitalInterviewSession,
  formatInterviewSessionTurn,
  getPublicDigitalInterviewSessionContext,
  type PublicDigitalInterviewSessionContext,
} from "@/lib/data/digital-interviews";
import { buildDigitalInterviewSystemPrompt } from "@/lib/digital-interview-prompt";
import {
  forwardJsonToAi,
  getAiServiceUrlOrResponse,
  parseJsonBodyOrResponse,
} from "@/lib/api/route-helpers";
import { jsonError } from "@/app/api/client/_helpers";

const chatRequestSchema = z.object({
  userMessage: z.string().trim().min(1).optional(),
  start: z.literal(true).optional(),
});

const completeInterviewTool = {
  type: "function",
  function: {
    name: "complete_interview",
    description: "Call when all topics covered to configured depth, or conversation exceeds 40 turns.",
    parameters: {
      type: "object",
      properties: {
        topicsCovered: {
          type: "array",
          items: { type: "string" },
          description: "List of topic names that were meaningfully covered.",
        },
        coverageNote: {
          type: "string",
          description: "One sentence on overall coverage quality.",
        },
      },
      required: ["topicsCovered"],
    },
  },
} as const;

type ChatContext = PublicDigitalInterviewSessionContext;
type AiInterviewPayload = {
  assistantMessage?: string;
  isComplete?: boolean;
  topicsCovered?: string[];
  coverageNote?: string | null;
};

function buildTopicsProgress(topics: string[], topicsCovered: string[]) {
  return topics.map((topic) => ({
    topic,
    covered: topicsCovered.includes(topic),
  }));
}

async function loadSessionContext(
  shareToken: string,
  sessionToken: string
): Promise<ChatContext | null> {
  return getPublicDigitalInterviewSessionContext(shareToken, sessionToken);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shareToken: string; sessionToken: string }> }
) {
  const body = await parseJsonBodyOrResponse(request);
  if (body instanceof NextResponse) {
    return body;
  }

  const parsedBody = chatRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError(parsedBody.error.issues[0]?.message ?? "Invalid digital interview payload", 422);
  }

  const isStartRequest = parsedBody.data.start === true;
  if (!isStartRequest && !parsedBody.data.userMessage) {
    return jsonError("Invalid digital interview payload", 422);
  }

  const { shareToken, sessionToken } = await params;
  const context = await loadSessionContext(shareToken, sessionToken);

  if (!context) {
    return jsonError("Digital interview session not found", 404);
  }

  if (context.session.status === "completed") {
    return jsonError("This interview has already been completed.", 409);
  }

  if (context.session.status !== "in_progress") {
    return jsonError("Digital interview session is not active", 409);
  }

  const aiServiceUrl = getAiServiceUrlOrResponse();
  if (aiServiceUrl instanceof NextResponse) {
    return aiServiceUrl;
  }

  const systemPrompt = await buildDigitalInterviewSystemPrompt(context);
  if (isStartRequest && context.session.conversation_history.length > 0) {
    const existingAssistant = [...context.session.conversation_history]
      .reverse()
      .find((turn) => turn.role === "assistant")?.content;

    return NextResponse.json({
      assistantMessage: existingAssistant ?? "Hello. Let’s begin.",
      isComplete: false,
      topicsProgress: buildTopicsProgress(context.flow.topics, []),
    });
  }

  const userTurn = isStartRequest
    ? null
    : await formatInterviewSessionTurn(parsedBody.data.userMessage ?? "", "user");
  const messages = [
    ...context.session.conversation_history,
    ...(userTurn ? [userTurn] : []),
    ...(isStartRequest
      ? [{
          role: "user" as const,
          content:
            "The interview is starting now. Greet the interviewee, explain briefly that this is a consultation interview for the consultant’s review, and ask the first single open question.",
        }]
      : []),
  ].map((turn) => ({ role: turn.role, content: turn.content }));

  let aiResponse: NextResponse;
  try {
    aiResponse = await forwardJsonToAi(aiServiceUrl, "/interview/chat", {
      systemPrompt,
      messages,
      tools: [completeInterviewTool],
    });
  } catch (error) {
    console.error("Digital interview AI service request failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return jsonError("The interview is experiencing a brief pause. Please try again.", 503);
  }

  if (!aiResponse.ok) {
    return aiResponse;
  }

  let aiPayload: AiInterviewPayload;
  try {
    aiPayload = (await aiResponse.json()) as AiInterviewPayload;
  } catch (error) {
    console.error("Digital interview AI service returned malformed JSON", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    aiPayload = {
      assistantMessage: "Could you tell me more?",
      isComplete: false,
      topicsCovered: [],
    };
  }

  const assistantMessage = aiPayload.assistantMessage ?? "Could you tell me more?";
  const isComplete = isStartRequest ? false : Boolean(aiPayload.isComplete);
  const topicsCovered = aiPayload.topicsCovered ?? [];
  const closingMessage = isComplete
    ? `Thank you, ${context.session.interviewee_name ?? "the interviewee"}. That's all I need for today. Your responses have been recorded and will be reviewed by the consultant. This conversation has now closed.`
    : assistantMessage;

  try {
    const persistedAssistantMessage = await formatInterviewSessionTurn(closingMessage, "assistant");
    const exchange = isStartRequest
      ? await appendDigitalInterviewMessage({
          shareToken,
          sessionToken,
          message: persistedAssistantMessage,
        })
      : await appendDigitalInterviewExchange({
          shareToken,
          sessionToken,
          userMessage: userTurn!,
          assistantMessage: persistedAssistantMessage,
        });

    if (!exchange) {
      return jsonError("The interview could not save that response. Please try again.", 503);
    }

    if (!isStartRequest && isComplete) {
      const completedSession = await completeDigitalInterviewSession({ shareToken, sessionToken });
      if (!completedSession) {
        return jsonError("The interview could not be completed. Please try again.", 503);
      }
    }
  } catch (error) {
    console.error("Failed to persist digital interview chat turn", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return jsonError("The interview could not save that response. Please try again.", 503);
  }

  return NextResponse.json({
    assistantMessage: closingMessage,
    isComplete,
    topicsProgress: buildTopicsProgress(context.flow.topics, topicsCovered),
  });
}
