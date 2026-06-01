import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import {
  buildUploadAckUserMessage,
  intakeToolNameForKind,
} from "@/lib/capture/chat-file-intake";
import { getUnarchivedSessionForUser } from "@/lib/chat/context";
import { insertChatMessage } from "@/lib/chat/persist";
import { executeMeetingIntakeTool, type MeetingIntakeToolName } from "@/lib/chat/tools";

const intakeRequestSchema = z.object({
  sessionId: z.string().uuid(),
  intakeKind: z.enum(["transcript", "audio", "notes"]),
  fileName: z.string().min(1),
  text: z.string().min(1),
  projectId: z.string().uuid().optional().nullable(),
});

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

  const parsed = intakeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { detail: parsed.error.issues[0]?.message ?? "Invalid intake payload" },
      { status: 422 }
    );
  }

  const session = await getUnarchivedSessionForUser(auth.id, parsed.data.sessionId);
  if (!session) {
    return NextResponse.json({ detail: "Chat session not found" }, { status: 404 });
  }

  const intakeKind = parsed.data.intakeKind;
  const toolName = intakeToolNameForKind(intakeKind) as MeetingIntakeToolName;
  const projectId = parsed.data.projectId ?? session.consultationId ?? undefined;
  const userContent = buildUploadAckUserMessage({
    intakeKind,
    fileName: parsed.data.fileName,
  });

  await insertChatMessage({
    sessionId: session.id,
    role: "user",
    content: userContent,
  });

  const toolInput = {
    text: parsed.data.text,
    ...(projectId ? { project_id: projectId } : {}),
  };

  const result = await executeMeetingIntakeTool({
    context: { userId: auth.id, sessionId: session.id },
    toolName,
    input: toolInput,
    text: parsed.data.text,
    projectId,
    intakeKind,
  });

  if (!result.ok) {
    return NextResponse.json({ detail: result.error }, { status: 502 });
  }

  return NextResponse.json({
    sessionId: session.id,
    toolName,
    toolResultId: result.toolResultId,
    status: "pending",
  });
}
