import { and, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@/db/client";
import {
  consultationOutputArtifacts,
  consultations,
  evidenceEmails,
  insights,
  meetings,
  quotes,
  themes,
} from "@/db/schema";
import { requireOwnedConsultation } from "@/lib/data/ownership";
import { dispatchToolToFastApi } from "./tool-dispatch";
import { CHAT_TOOL_ENDPOINTS } from "./tool-allowlist";
import type {
  EmailDraftReviewOutput,
  ReportDraftReviewOutput,
  ResearchQuestion,
  ResearchQuestionReviewOutput,
  ResearchThemeLinkProposal,
} from "./tools/async-actions";

async function loadConsultationMeetings(userId: string, consultationId: string) {
  return db
    .select({
      id: meetings.id,
      title: meetings.title,
      transcriptRaw: meetings.transcriptRaw,
      notes: meetings.notes,
      meetingDate: meetings.meetingDate,
    })
    .from(meetings)
    .where(
      and(
        eq(meetings.userId, userId),
        eq(meetings.consultationId, consultationId),
        eq(meetings.isArchived, false)
      )
    )
    .orderBy(desc(meetings.updatedAt));
}

async function loadAcceptedInsightLabels(
  userId: string,
  consultationId: string,
  themeIds?: string[]
) {
  const meetingRows = await loadConsultationMeetings(userId, consultationId);
  const meetingIds = meetingRows.map((row) => row.id);
  if (meetingIds.length === 0) {
    return [] as Array<{ id: string; label: string; description: string | null }>;
  }

  const conditions = [
    inArray(insights.meetingId, meetingIds),
    eq(insights.accepted, true),
    eq(insights.rejected, false),
  ];
  if (themeIds?.length) {
    conditions.push(inArray(insights.id, themeIds));
  }

  return db
    .select({
      id: insights.id,
      label: insights.label,
      description: insights.description,
    })
    .from(insights)
    .where(and(...conditions));
}

export async function executeGenerateResearchQuestions(params: {
  userId: string;
  sessionId: string;
  consultationId: string;
  themeIds?: string[];
}): Promise<
  | { ok: true; output: ResearchQuestionReviewOutput }
  | { ok: false; error: string }
> {
  await requireOwnedConsultation(params.consultationId, params.userId);
  const themesForPrompt = await loadAcceptedInsightLabels(
    params.userId,
    params.consultationId,
    params.themeIds
  );

  if (themesForPrompt.length === 0) {
    return { ok: false, error: "Accept themes before generating research questions." };
  }

  const result = await dispatchToolToFastApi({
    userId: params.userId,
    sessionId: params.sessionId,
    endpoint: CHAT_TOOL_ENDPOINTS.generate_research_questions,
    body: {
      consultation_id: params.consultationId,
      themes: themesForPrompt.map((theme) => ({
        id: theme.id,
        label: theme.label,
        description: theme.description,
      })),
    },
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const questionsRaw =
    result.data && typeof result.data === "object" && "questions" in result.data
      ? (result.data as { questions?: unknown }).questions
      : result.data;

  const questions: ResearchQuestion[] = [];
  if (Array.isArray(questionsRaw)) {
    for (const item of questionsRaw) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const question = typeof record.question === "string" ? record.question.trim() : "";
      if (!question) continue;
      questions.push({
        id: typeof record.id === "string" ? record.id : randomUUID(),
        question,
        rationale:
          typeof record.rationale === "string" ? record.rationale : "Follow-up research angle.",
        linked_theme_id:
          typeof record.linked_theme_id === "string" ? record.linked_theme_id : undefined,
      });
    }
  }

  if (questions.length === 0) {
    questions.push(
      ...themesForPrompt.slice(0, 3).map((theme) => ({
        id: randomUUID(),
        question: `What evidence supports the theme "${theme.label}" across other consultations?`,
        rationale: "Cross-consultation validation for an accepted theme.",
        linked_theme_id: theme.id,
      }))
    );
  }

  return {
    ok: true,
    output: {
      consultation_id: params.consultationId,
      questions,
      dismissed_question_ids: [],
    },
  };
}

export async function executeDraftEvidenceEmail(params: {
  userId: string;
  sessionId: string;
  consultationId: string;
  meetingIds?: string[];
}): Promise<
  | { ok: true; output: EmailDraftReviewOutput }
  | { ok: false; error: string }
> {
  await requireOwnedConsultation(params.consultationId, params.userId);
  const meetingRows = await loadConsultationMeetings(params.userId, params.consultationId);
  if (meetingRows.length === 0) {
    return { ok: false, error: "Save a meeting before drafting an evidence email." };
  }

  const selectedMeeting =
    meetingRows.find((row) => params.meetingIds?.includes(row.id)) ?? meetingRows[0];
  const transcript =
    selectedMeeting.transcriptRaw?.trim() || selectedMeeting.notes?.trim() || "";
  if (!transcript) {
    return { ok: false, error: "Selected meeting has no transcript content." };
  }

  const acceptedThemes = await loadAcceptedInsightLabels(
    params.userId,
    params.consultationId
  );

  const result = await dispatchToolToFastApi({
    userId: params.userId,
    sessionId: params.sessionId,
    endpoint: CHAT_TOOL_ENDPOINTS.draft_evidence_email,
    body: {
      consultation_title: selectedMeeting.title,
      consultation_date: selectedMeeting.meetingDate?.toISOString() ?? null,
      people: [],
      themes: acceptedThemes.map((theme) => theme.label),
      transcript,
    },
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const payload =
    result.data && typeof result.data === "object"
      ? (result.data as Record<string, unknown>)
      : {};
  const subject =
    typeof payload.subject === "string" ? payload.subject : `Follow-up: ${selectedMeeting.title}`;
  const body =
    typeof payload.body === "string"
      ? payload.body
      : "Draft email could not be generated. Edit before saving.";

  const quoteRows = await db
    .select({
      id: quotes.id,
      text: quotes.text,
      speaker: quotes.speaker,
    })
    .from(quotes)
    .innerJoin(meetings, eq(quotes.meetingId, meetings.id))
    .where(and(eq(meetings.id, selectedMeeting.id), eq(meetings.userId, params.userId)))
    .limit(5);

  return {
    ok: true,
    output: {
      consultation_id: params.consultationId,
      meeting_id: selectedMeeting.id,
      draft_id: randomUUID(),
      subject,
      body,
      supporting_quotes: quoteRows.map((row) => ({
        id: row.id,
        text: row.text,
        speaker: row.speaker,
      })),
      linked_themes: acceptedThemes.map((theme) => ({
        id: theme.id,
        label: theme.label,
      })),
    },
  };
}

export async function executeGenerateReport(params: {
  userId: string;
  sessionId: string;
  consultationId: string;
}): Promise<
  | { ok: true; output: ReportDraftReviewOutput }
  | { ok: false; error: string }
> {
  await requireOwnedConsultation(params.consultationId, params.userId);

  const [consultation] = await db
    .select({ label: consultations.label })
    .from(consultations)
    .where(
      and(
        eq(consultations.id, params.consultationId),
        eq(consultations.userId, params.userId)
      )
    )
    .limit(1);

  const acceptedThemes = await loadAcceptedInsightLabels(
    params.userId,
    params.consultationId
  );

  const result = await dispatchToolToFastApi({
    userId: params.userId,
    sessionId: params.sessionId,
    endpoint: CHAT_TOOL_ENDPOINTS.generate_report,
    body: {
      round_label: consultation?.label ?? "Consultation report",
      accepted_round_themes: acceptedThemes.map((theme) => ({
        label: theme.label,
        description: theme.description,
      })),
      supporting_consultation_themes: [],
    },
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const payload =
    result.data && typeof result.data === "object"
      ? (result.data as Record<string, unknown>)
      : {};
  const title =
    typeof payload.title === "string" ? payload.title : "Consultation report draft";
  const body =
    typeof payload.content === "string"
      ? payload.content
      : typeof payload.body === "string"
        ? payload.body
        : "Report draft generated. Review before saving.";

  return {
    ok: true,
    output: {
      consultation_id: params.consultationId,
      draft_id: randomUUID(),
      title,
      body,
      generated_at: new Date().toISOString(),
    },
  };
}

export async function executeLinkResearchToThemes(params: {
  userId: string;
  consultationId: string;
  researchId: string;
}): Promise<
  | { ok: true; output: ResearchThemeLinkProposal }
  | { ok: false; error: string }
> {
  await requireOwnedConsultation(params.consultationId, params.userId);

  const [insight] = await db
    .select({
      id: insights.id,
      label: insights.label,
      description: insights.description,
    })
    .from(insights)
    .where(eq(insights.id, params.researchId))
    .limit(1);

  if (!insight) {
    return { ok: false, error: "Research insight not found." };
  }

  const groupRows = await db
    .select({ id: themes.id, label: themes.label, description: themes.description })
    .from(themes)
    .where(
      and(
        eq(themes.userId, params.userId),
        eq(themes.consultationId, params.consultationId),
        inArray(themes.status, ["draft", "accepted"])
      )
    );

  const researchHaystack = `${insight.label} ${insight.description ?? ""}`.toLowerCase();
  const links = groupRows
    .map((group) => {
      const haystack = `${group.label} ${group.description ?? ""}`.toLowerCase();
      const overlap = researchHaystack
        .split(/\s+/)
        .filter((token) => token.length > 3 && haystack.includes(token)).length;
      const relevance = Math.min(1, overlap / 4);
      return {
        theme_group_id: group.id,
        theme_group_label: group.label,
        relevance_score: relevance > 0 ? relevance : 0.35,
      };
    })
    .sort((left, right) => right.relevance_score - left.relevance_score)
    .slice(0, 3);

  return {
    ok: true,
    output: {
      research_id: params.researchId,
      consultation_id: params.consultationId,
      links,
      confirmed_theme_group_ids: links[0] ? [links[0].theme_group_id] : [],
    },
  };
}

export async function saveEmailDraftFromChat(params: {
  userId: string;
  meetingId: string;
  subject: string;
  body: string;
}): Promise<{ id: string }> {
  const [meeting] = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(and(eq(meetings.id, params.meetingId), eq(meetings.userId, params.userId)))
    .limit(1);

  if (!meeting) {
    throw new Error("Meeting not found.");
  }

  const [created] = await db
    .insert(evidenceEmails)
    .values({
      meetingId: params.meetingId,
      subject: params.subject,
      bodyDraft: params.body,
      status: "draft",
      generatedAt: new Date(),
    })
    .returning({ id: evidenceEmails.id });

  return { id: created.id };
}

export async function saveReportDraftFromChat(params: {
  userId: string;
  consultationId: string;
  title: string;
  body: string;
}): Promise<{ id: string }> {
  await requireOwnedConsultation(params.consultationId, params.userId);

  const [created] = await db
    .insert(consultationOutputArtifacts)
    .values({
      consultationId: params.consultationId,
      userId: params.userId,
      artifactType: "report",
      title: params.title,
      content: params.body,
      createdBy: params.userId,
    })
    .returning({ id: consultationOutputArtifacts.id });

  return { id: created.id };
}

export async function saveResearchThemeLinks(params: {
  userId: string;
  consultationId: string;
  researchId: string;
  themeGroupIds: string[];
}): Promise<Array<{ research_id: string; theme_group_id: string; relevance_score: number }>> {
  await requireOwnedConsultation(params.consultationId, params.userId);

  const validGroups = await db
    .select({ id: themes.id })
    .from(themes)
    .where(
      and(
        eq(themes.userId, params.userId),
        eq(themes.consultationId, params.consultationId),
        inArray(themes.id, params.themeGroupIds)
      )
    );

  return validGroups.map((group, index) => ({
    research_id: params.researchId,
    theme_group_id: group.id,
    relevance_score: Math.max(0.5, 1 - index * 0.1),
  }));
}
