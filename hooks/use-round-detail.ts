import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  RoundDetail,
  RoundConsultationSummary,
  SourceTheme,
  RoundThemeGroup,
  RoundDecisionHistoryEntry,
  RoundOutput,
} from "@/types/round-detail";

/**
 * Fetches the full round detail payload by assembling data from existing tables.
 *
 * This hook builds the RoundDetail contract from:
 * - consultation_rounds (round metadata)
 * - consultations (linked consultations)
 * - themes (source themes per consultation)
 * - evidence_emails (email summary per consultation)
 * - theme_decision_logs (decision history)
 *
 * Theme groups, AI drafts, and outputs are managed client-side until
 * Agent 1 provides the round_theme_groups schema.
 */
export function useRoundDetail(roundId: string) {
  return useQuery({
    queryKey: ["round-detail", roundId],
    queryFn: async (): Promise<RoundDetail> => {
      const supabase = createClient();

      // 1. Fetch round metadata
      const { data: round, error: roundError } = await supabase
        .from("consultation_rounds")
        .select("*")
        .eq("id", roundId)
        .single();

      if (roundError) throw roundError;

      // 2. Fetch linked consultations
      const { data: consultations, error: consultationsError } = await supabase
        .from("consultations")
        .select("id, title, status, round_id, created_at")
        .eq("round_id", roundId)
        .order("created_at", { ascending: true });

      if (consultationsError) throw consultationsError;

      const consultationIds = (consultations ?? []).map((c) => c.id);

      // 3. Fetch themes for all linked consultations
      let themes: Array<{
        id: string;
        consultation_id: string;
        label: string;
        description: string | null;
        accepted: boolean;
        is_user_added: boolean;
        weight: number;
        created_at: string;
      }> = [];

      if (consultationIds.length > 0) {
        const { data: themesData, error: themesError } = await supabase
          .from("themes")
          .select("*")
          .in("consultation_id", consultationIds)
          .order("created_at", { ascending: true });

        if (themesError) throw themesError;
        themes = themesData ?? [];
      }

      // 4. Fetch evidence email status per consultation
      let emailMap: Record<string, { subject: string | null; status: string }> = {};

      if (consultationIds.length > 0) {
        const { data: emails, error: emailsError } = await supabase
          .from("evidence_emails")
          .select("consultation_id, subject, status")
          .in("consultation_id", consultationIds)
          .order("created_at", { ascending: false });

        if (emailsError) throw emailsError;

        // Take the latest email per consultation
        for (const email of emails ?? []) {
          if (!emailMap[email.consultation_id]) {
            emailMap[email.consultation_id] = {
              subject: email.subject,
              status: email.status,
            };
          }
        }
      }

      // 5. Fetch decision history
      let decisionHistory: RoundDecisionHistoryEntry[] = [];

      if (consultationIds.length > 0) {
        const { data: decisions, error: decisionsError } = await supabase
          .from("theme_decision_logs")
          .select("*")
          .eq("round_id", roundId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (!decisionsError && decisions) {
          decisionHistory = decisions.map((d) => ({
            id: d.id,
            targetType: "source_theme" as const,
            targetId: d.theme_id,
            targetLabel: themes.find((t) => t.id === d.theme_id)?.label ?? "Unknown theme",
            decisionType: d.decision_type === "accept"
              ? "accept" as const
              : d.decision_type === "reject"
                ? "management_reject" as const
                : "discard" as const,
            rationale: d.rationale,
            actor: d.user_id,
            timestamp: d.created_at,
          }));
        }
      }

      // 6. Build consultation summaries
      const consultationThemeCounts: Record<string, number> = {};
      for (const theme of themes) {
        consultationThemeCounts[theme.consultation_id] =
          (consultationThemeCounts[theme.consultation_id] ?? 0) + 1;
      }

      const consultationSummaries: RoundConsultationSummary[] = (consultations ?? []).map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        evidenceEmailSubject: emailMap[c.id]?.subject ?? null,
        evidenceEmailStatus: emailMap[c.id]?.status ?? null,
        themeCount: consultationThemeCounts[c.id] ?? 0,
      }));

      // 7. Build source themes
      const sourceThemes: SourceTheme[] = themes.map((t) => {
        const consultation = (consultations ?? []).find((c) => c.id === t.consultation_id);
        return {
          id: t.id,
          sourceConsultationId: t.consultation_id,
          sourceConsultationTitle: consultation?.title ?? "Untitled",
          sourceThemeId: t.id,
          label: t.label,
          description: t.description,
          editableLabel: t.label,
          editableDescription: t.description,
          accepted: t.accepted,
          lockedFromSource: t.accepted,
          isGrouped: false,
          isUserAdded: t.is_user_added,
          groupId: null,
        };
      });

      // 8. Assemble payload
      return {
        round: {
          id: round.id,
          label: round.label,
          description: round.description,
          linkedConsultationCount: consultationSummaries.length,
          createdAt: round.created_at,
        },
        consultations: consultationSummaries,
        sourceThemes,
        themeGroups: [] as RoundThemeGroup[],
        decisionHistory,
        outputs: [] as RoundOutput[],
      };
    },
    enabled: !!roundId,
  });
}
