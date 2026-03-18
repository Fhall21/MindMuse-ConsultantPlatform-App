import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  const aiServiceUrl = process.env.AI_SERVICE_URL;
  if (!aiServiceUrl) {
    return NextResponse.json({ detail: "AI_SERVICE_URL is not configured" }, { status: 503 });
  }

  const body = await request.json();
  let learningSignals: ThemeLearningSignal[] = [];

  try {
    learningSignals = await loadLearningSignals();
  } catch (err) {
    console.error("Failed to load theme learning signals", err);
  }

  let response: Response;
  try {
    response = await fetch(`${aiServiceUrl}/themes/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        learning_signals: learningSignals,
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach AI service";
    return NextResponse.json({ detail: message }, { status: 502 });
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    return NextResponse.json({ detail: text }, { status: response.ok ? 502 : response.status });
  }

  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json(data, { status: response.status });
  }

  return NextResponse.json(data);
}
