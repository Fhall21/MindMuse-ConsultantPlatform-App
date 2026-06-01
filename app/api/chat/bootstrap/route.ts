import { NextResponse } from "next/server";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import {
  countActiveConsultations,
  createChatSession,
  getUnarchivedSessionForUser,
} from "@/lib/chat/context";
import { loadRecentChatMessages, loadToolResultsForSession } from "@/lib/chat/persist";
import { dbMessagesToUiMessages } from "@/lib/chat/ui-messages";

export async function GET() {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) {
    return auth;
  }

  let session = await getUnarchivedSessionForUser(auth.id);
  if (!session) {
    session = await createChatSession(auth.id);
  }

  const [messages, activeConsultations, toolResults] = await Promise.all([
    loadRecentChatMessages(session.id),
    countActiveConsultations(auth.id),
    loadToolResultsForSession(session.id),
  ]);

  return NextResponse.json({
    sessionId: session.id,
    consultationId: session.consultationId,
    userMode: session.userMode,
    needsConsultationSelection:
      !session.consultationId && activeConsultations >= 2,
    messages: dbMessagesToUiMessages(messages, toolResults),
  });
}
