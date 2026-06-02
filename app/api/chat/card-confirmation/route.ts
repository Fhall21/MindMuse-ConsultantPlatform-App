import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import {
  CARD_CONFIRMATION_ACTIONS,
} from "@/lib/chat/card-confirmation-copy";
import { insertOwnedCardConfirmation } from "@/lib/chat/card-confirmations";

const requestSchema = z.object({
  sessionId: z.string().uuid(),
  toolResultId: z.string().uuid().optional(),
  action: z.enum(CARD_CONFIRMATION_ACTIONS),
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

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { detail: parsed.error.issues[0]?.message ?? "Invalid confirmation payload" },
      { status: 422 }
    );
  }

  const inserted = await insertOwnedCardConfirmation({
    userId: auth.id,
    sessionId: parsed.data.sessionId,
    toolResultId: parsed.data.toolResultId,
    action: parsed.data.action,
  });

  if (!inserted) {
    return NextResponse.json({ detail: "Chat session not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
