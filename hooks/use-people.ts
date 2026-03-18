import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Person } from "@/types/db";

export function usePeople() {
  return useQuery({
    queryKey: ["people"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("people")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Person[];
    },
  });
}

export function useConsultationPeople(consultationId: string) {
  return useQuery({
    queryKey: ["consultation_people", consultationId],
    queryFn: async () => {
      const supabase = createClient();
      const { data: links, error: linksError } = await supabase
        .from("consultation_people")
        .select("person_id")
        .eq("consultation_id", consultationId);

      if (linksError) throw linksError;

      if (!links || links.length === 0) {
        return [];
      }

      const personIds = links.map((link) => link.person_id);

      const { data: people, error: peopleError } = await supabase
        .from("people")
        .select("*")
        .in("id", personIds);

      if (peopleError) throw peopleError;

      return people as Person[];
    },
    enabled: !!consultationId,
  });
}
