import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedApiUser } from "@/lib/api/route-helpers";
import {
  countActiveConsultations,
  createChatSession,
  getUnarchivedSessionForUser,
} from "@/lib/chat/context";
import {
  buildOnboardingBootstrapFields,
  loadOnboardingAccountState,
  syncUserModeFromAccountState,
} from "@/lib/chat/onboarding-state";
import { loadRecentChatMessages, loadToolResultsForSession } from "@/lib/chat/persist";
import { dbMessagesToUiMessages } from "@/lib/chat/ui-messages";

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  const createNew = request.nextUrl.searchParams.get("new") === "true";

  let session;
  if (createNew) {
    session = await createChatSession(auth.id);
  } else if (sessionId) {
    session = await getUnarchivedSessionForUser(auth.id, sessionId);
    if (!session) {
      return NextResponse.json({ detail: "Chat session not found" }, { status: 404 });
    }
  } else {
    session = (await getUnarchivedSessionForUser(auth.id)) ?? (await createChatSession(auth.id));
  }

  const [messages, activeConsultations, toolResults] = await Promise.all([
    loadRecentChatMessages(session.id),
    countActiveConsultations(auth.id),
    loadToolResultsForSession(session.id),
  ]);

  await syncUserModeFromAccountState(session.id, auth.id);
  const freshState = await loadOnboardingAccountState(auth.id);
  const bootstrapFields = buildOnboardingBootstrapFields(freshState);

  return NextResponse.json({
    sessionId: session.id,
    consultationId: session.consultationId,
    userMode: bootstrapFields.userMode,
    needsConsultationSelection:
      !session.consultationId && activeConsultations >= 2,
    onboardingState: bootstrapFields.onboardingState,
    welcomeVariant: bootstrapFields.welcomeVariant,
    messages: dbMessagesToUiMessages(messages, toolResults),
  });
}
