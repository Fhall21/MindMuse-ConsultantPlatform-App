import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { chatSessions } from "@/db/schema/chat";
import type { ChatUserMode } from "@/db/schema/chat";
import {
  insights,
  meetingGroups,
  meetings,
  quoteInsightLinks,
} from "@/db/schema";
import { countActiveConsultations } from "@/lib/chat/context";
import { deriveWelcomeVariant } from "@/lib/chat/onboarding-copy";
import { getDashboardStats } from "@/lib/data/domain-read";

export type OnboardingMilestone =
  | "consultation"
  | "meeting"
  | "insight_accept"
  | "quotes"
  | "grouping";

export type OnboardingPhase =
  | "needs_consultation"
  | "needs_meeting"
  | "needs_insights"
  | "needs_quotes"
  | "needs_grouping"
  | "onboarding_complete"
  | "returning";

export type WelcomeVariant = "brand_new" | "resume_onboarding" | "returning";

export interface OnboardingAccountState {
  hasConsultation: boolean;
  hasMeeting: boolean;
  hasInsight: boolean;
  hasConsultationTheme: boolean;
  hasQuotes: boolean;
  hasGrouping: boolean;
  hasCanvasConnection: boolean;
  hasReport: boolean;
  activeConsultations: number;
  phase: OnboardingPhase;
  userMode: ChatUserMode;
}

export function isFirstHalfOnboardingComplete(
  flags: Pick<
    OnboardingAccountState,
    "hasConsultation" | "hasMeeting" | "hasInsight" | "hasQuotes"
  >
): boolean {
  return (
    flags.hasConsultation &&
    flags.hasMeeting &&
    flags.hasInsight &&
    flags.hasQuotes
  );
}

export function deriveUserMode(
  flags: Pick<
    OnboardingAccountState,
    "hasConsultation" | "hasMeeting" | "hasInsight" | "hasQuotes"
  >
): ChatUserMode {
  return isFirstHalfOnboardingComplete(flags) ? "returning" : "onboarding";
}

export function derivePhase(
  flags: Pick<
    OnboardingAccountState,
    | "hasConsultation"
    | "hasMeeting"
    | "hasInsight"
    | "hasQuotes"
    | "hasGrouping"
    | "activeConsultations"
    | "userMode"
  >
): OnboardingPhase {
  if (flags.userMode === "returning") {
    return "returning";
  }

  if (!flags.hasConsultation) {
    return "needs_consultation";
  }
  if (!flags.hasMeeting) {
    return "needs_meeting";
  }
  if (!flags.hasInsight) {
    return "needs_insights";
  }
  if (!flags.hasQuotes) {
    return "needs_quotes";
  }
  if (!flags.hasGrouping && flags.activeConsultations >= 2) {
    return "needs_grouping";
  }

  return "onboarding_complete";
}

async function userHasLinkedQuotes(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(quoteInsightLinks)
    .innerJoin(insights, eq(quoteInsightLinks.insightId, insights.id))
    .innerJoin(meetings, eq(insights.meetingId, meetings.id))
    .where(eq(meetings.userId, userId));

  return (row?.count ?? 0) > 0;
}

async function userHasMeetingGroups(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(meetingGroups)
    .where(eq(meetingGroups.userId, userId));

  return (row?.count ?? 0) > 0;
}

export async function loadOnboardingAccountState(
  userId: string
): Promise<OnboardingAccountState> {
  const [stats, activeConsultations, hasQuotes, hasGrouping] = await Promise.all([
    getDashboardStats(userId),
    countActiveConsultations(userId),
    userHasLinkedQuotes(userId),
    userHasMeetingGroups(userId),
  ]);

  const flags = {
    hasConsultation: stats.totalConsultations > 0,
    hasMeeting: stats.totalMeetings > 0,
    hasInsight: stats.totalInsights > 0,
    hasConsultationTheme: stats.totalThemes > 0,
    hasQuotes,
    hasGrouping,
    hasCanvasConnection: stats.totalCanvasConnections > 0,
    hasReport: stats.totalReports > 0,
    activeConsultations,
  };

  const userMode = deriveUserMode(flags);
  const phase = derivePhase({ ...flags, userMode });

  return {
    ...flags,
    phase,
    userMode,
  };
}

export async function syncUserModeFromAccountState(
  sessionId: string,
  userId: string
): Promise<ChatUserMode> {
  const state = await loadOnboardingAccountState(userId);

  await db
    .update(chatSessions)
    .set({
      userMode: state.userMode,
      updatedAt: new Date(),
    })
    .where(
      and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId))
    );

  return state.userMode;
}

export async function recordOnboardingMilestone(
  userId: string,
  sessionId: string,
  _milestone: OnboardingMilestone
): Promise<OnboardingAccountState> {
  await syncUserModeFromAccountState(sessionId, userId);
  return loadOnboardingAccountState(userId);
}

export function buildOnboardingBootstrapFields(state: OnboardingAccountState) {
  return {
    userMode: state.userMode,
    onboardingState: state,
    welcomeVariant: deriveWelcomeVariant(state),
  };
}
