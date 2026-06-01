import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import { createChatSession, listChatSessionsForUser } from "@/lib/chat/context";

export async function GET() {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const sessions = await listChatSessionsForUser(auth.id);
  return NextResponse.json({ sessions });
}

const createSchema = z.object({
  consultationId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch {
    return NextResponse.json({ detail: "Invalid JSON payload" }, { status: 422 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { detail: parsed.error.issues[0]?.message ?? "Invalid session payload" },
      { status: 422 }
    );
  }

  const session = await createChatSession(auth.id, parsed.data.consultationId ?? null);
  return NextResponse.json({ sessionId: session.id });
}
