import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Theme } from "@/types/db";

export function useThemes(consultationId: string) {
  return useQuery({
    queryKey: ["themes", consultationId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("themes")
        .select("*")
        .eq("consultation_id", consultationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Theme[];
    },
    enabled: !!consultationId,
  });
}
