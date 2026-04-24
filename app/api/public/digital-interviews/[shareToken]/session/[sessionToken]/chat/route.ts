import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  appendDigitalInterviewMessage,
  completeDigitalInterviewSession,
  formatInterviewSessionTurn,
  getPublicDigitalInterviewSessionContext,
  type PublicDigitalInterviewSessionContext,
} from "@/lib/data/digital-interviews";
import {
  forwardJsonToAi,
  getAiServiceUrlOrResponse,
  parseJsonBodyOrResponse,
} from "@/lib/api/route-helpers";
import { jsonError } from "@/app/api/client/_helpers";

const chatRequestSchema = z.object({
  userMessage: z.string().trim().min(1),
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

function buildSystemPrompt(context: ChatContext) {
  const intervieweeName = context.session.interviewee_name ?? "the interviewee";
  const intervieweeRole = context.session.interviewee_role ?? "their role";
  const intervieweeWorkGroup = context.session.interviewee_work_group ?? "their team";
  const intervieweeOrganisation = context.session.interviewee_organisation ?? "their organisation";

  const frameworkGuide =
    context.flow.framework === "appreciative_inquiry"
      ? [
          "Interview approach - Appreciative Inquiry:",
          "Focus on strengths, successes, and what the interviewee values. Ask about peak experiences ('Tell me about a time when...'), core values ('What made that meaningful?'), and future aspirations ('What would an ideal version look like?'). Avoid deficit framing. Never ask 'what's wrong' - always ask 'what's working and what would make it even better.'",
        ].join("\n")
      : context.flow.framework === "psychological_safety"
        ? [
            "Interview approach - Psychological Safety:",
            "Explore how comfortable the interviewee feels speaking up, taking interpersonal risks, and being themselves at work. Use indirect questions rather than direct ones ('Do you feel safe?' will produce socially desirable answers). Ask about specific behaviours and situations: 'Tell me about a time when you held back a concern' or 'What would make it easier to raise a difficult topic with your team?' Be especially attentive to non-answers and deflections - they often signal important things.",
          ].join("\n")
        : [
            "Interview approach - Custom framework:",
            context.flow.custom_framework_prompt || "Use the provided custom framework guidance.",
            "Apply this approach throughout the interview. Maintain a warm, qualitative interview style - ask open-ended questions and follow up on what the interviewee shares.",
          ].join("\n");

  const depthGuide =
    context.flow.depth_level === "surface"
      ? "Ask 1-2 follow-up questions per topic before moving on. This is a light-touch overview."
      : context.flow.depth_level === "moderate"
        ? "Ask 3-4 follow-up questions per topic, probing for specific examples and elaboration."
        : "Ask 5+ follow-up questions per topic, seeking underlying causes, systemic patterns, and lived experience. Take your time on each topic.";

  return [
    "You are a qualitative interviewer conducting a psychosocial consultation on behalf of a consultant.",
    "",
    `Your role: conduct a warm, professional qualitative interview with ${intervieweeName}, who works as ${intervieweeRole} at ${intervieweeOrganisation} (team: ${intervieweeWorkGroup}).`,
    "",
    frameworkGuide,
    "",
    "Topics to explore (cover all of them, in any natural order that the conversation allows):",
    ...context.flow.topics.map((topic, index) => `${index + 1}. ${topic}`),
    "",
    `Depth guide: ${depthGuide}`,
    "",
    "Important rules:",
    `- Use ${intervieweeName}'s name naturally but not excessively.`,
    "- Do NOT announce topic transitions (\"Now let's talk about...\"). Move between topics naturally.",
    "- Ask one question at a time. Never ask two questions in the same message.",
    "- If a response is very short (under 10 words), gently probe: \"Could you tell me a bit more about that?\"",
    "- If the interviewee seems distressed or reluctant, acknowledge it: \"I hear that. We can move on if you prefer.\"",
    "- Never share other interviewees' responses or make comparisons.",
    "- Do NOT comment on organisational politics or take sides.",
    "- When you have covered all topics to the configured depth, call the complete_interview tool.",
    "- Hard limit: if the conversation exceeds 40 turns, call complete_interview regardless of coverage.",
    "",
    "Begin by introducing yourself briefly and asking an opening question related to the first topic.",
  ].join("\n");
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

  const systemPrompt = buildSystemPrompt(context);
  const messages = [
    ...context.session.conversation_history,
    formatInterviewSessionTurn(parsedBody.data.userMessage, "user"),
  ].map((turn) => ({ role: turn.role, content: turn.content }));

  const aiResponse = await forwardJsonToAi(aiServiceUrl, "/interview/chat", {
    systemPrompt,
    messages,
    tools: [completeInterviewTool],
  });

  if (!aiResponse.ok) {
    return aiResponse;
  }

  const aiPayload = (await aiResponse.json()) as {
    assistantMessage?: string;
    isComplete?: boolean;
    topicsCovered?: string[];
    coverageNote?: string | null;
  };

  const assistantMessage = aiPayload.assistantMessage ?? "Could you tell me more?";
  const isComplete = Boolean(aiPayload.isComplete);
  const topicsCovered = aiPayload.topicsCovered ?? [];
  const closingMessage = isComplete
    ? `Thank you, ${context.session.interviewee_name ?? "the interviewee"}. That's all I need for today. Your responses have been recorded and will be reviewed by the consultant. This conversation has now closed.`
    : assistantMessage;

  try {
    const userTurn = await appendDigitalInterviewMessage({
      shareToken,
      sessionToken,
      message: formatInterviewSessionTurn(parsedBody.data.userMessage, "user"),
    });

    if (!userTurn) {
      return jsonError("Failed to persist digital interview message");
    }

    const assistantTurn = await appendDigitalInterviewMessage({
      shareToken,
      sessionToken,
      message: formatInterviewSessionTurn(closingMessage, "assistant"),
    });

    if (!assistantTurn) {
      return jsonError("Failed to persist digital interview response");
    }

    if (isComplete) {
      const completedSession = await completeDigitalInterviewSession({ shareToken, sessionToken });
      if (!completedSession) {
        return jsonError("Failed to complete digital interview session");
      }
    }
  } catch (error) {
    console.error("Failed to persist digital interview chat turn", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to persist digital interview chat turn"
    );
  }

  return NextResponse.json({
    assistantMessage: closingMessage,
    isComplete,
    topicsProgress: context.flow.topics.map((topic) => ({
      topic,
      covered: topicsCovered.includes(topic),
    })),
  });
}