import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Consultation, ConsultationRound } from "@/types/db";

export function useConsultations() {
  return useQuery({
    queryKey: ["consultations"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("consultations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Consultation[];
    },
  });
}

export function useConsultation(id: string) {
  return useQuery({
    queryKey: ["consultations", id],
    queryFn: async () => {
      const supabase = createClient();
      const { data: consultation, error: consultationError } = await supabase
        .from("consultations")
        .select("*")
        .eq("id", id)
        .single();

      if (consultationError) throw consultationError;

      const { data: themes, error: themesError } = await supabase
        .from("themes")
        .select("*")
        .eq("consultation_id", id)
        .order("created_at", { ascending: false });

      if (themesError) throw themesError;

      const { data: people, error: peopleError } = await supabase
        .from("consultation_people")
        .select("person_id")
        .eq("consultation_id", id);

      if (peopleError) throw peopleError;

      const { data: evidenceEmails, error: emailError } = await supabase
        .from("evidence_emails")
        .select("*")
        .eq("consultation_id", id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (emailError) throw emailError;

      return {
        consultation: consultation as Consultation,
        themes,
        people,
        latestEvidenceEmail: evidenceEmails?.[0],
      };
    },
    enabled: !!id,
  });
}

export function useConsultationRounds() {
  return useQuery({
    queryKey: ["consultation_rounds"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("consultation_rounds")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ConsultationRound[];
    },
  });
}
