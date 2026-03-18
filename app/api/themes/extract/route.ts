import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  forwardJsonToAi,
  getAiServiceUrlOrResponse,
  parseJsonBodyOrResponse,
  requireAuthenticatedApiUser,
} from "@/lib/api/route-helpers";

interface ThemeLearningSignal {
  label: string;
  decision_type: "accept" | "reject" | "user_added";
  rationale: string | null;
  weight: number;
}

function getSignalWeight(decisionType: ThemeLearningSignal["decision_type"]) {
  return decisionType === "user_added" ? 2 : 1;
}

async function loadLearningSignals() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError) {
    throw authError;
  }

  if (!auth.user) {
    return [] as ThemeLearningSignal[];
  }

  const { data, error } = await supabase
    .from("theme_decision_logs")
    .select("theme_label, decision_type, rationale, created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw error;
  }

  return (data ?? [])
    .filter(
      (row): row is {
        theme_label: string;
        decision_type: ThemeLearningSignal["decision_type"];
        rationale: string | null;
        created_at: string;
      } => Boolean(row.theme_label)
    )
    .map((row) => ({
      label: row.theme_label,
      decision_type: row.decision_type,
      rationale: row.rationale,
      weight: getSignalWeight(row.decision_type),
    }));
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedApiUser();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const aiServiceUrl = getAiServiceUrlOrResponse();
  if (aiServiceUrl instanceof NextResponse) {
    return aiServiceUrl;
  }

  const body = await parseJsonBodyOrResponse(request);
  if (body instanceof NextResponse) {
    return body;
  }

  let learningSignals: ThemeLearningSignal[] = [];

  try {
    learningSignals = await loadLearningSignals();
  } catch (err) {
    console.error("Failed to load theme learning signals", err);
  }

  return forwardJsonToAi(aiServiceUrl, "/themes/extract", {
    ...(body as Record<string, unknown>),
    learning_signals: learningSignals,
  });
}
