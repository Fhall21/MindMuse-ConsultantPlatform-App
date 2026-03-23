"use client";

import { PreferencesForm } from "./preferences-form";
import { SignalsList } from "./signals-list";
import { LearningSummary } from "./learning-summary";
import { useAIPreferences } from "@/hooks/use-ai-preferences";

export function AIPersonalisationPanel() {
  const { data: prefs } = useAIPreferences();
  const signalCount = prefs?.signalCount ?? 0;

  return (
    <div className="space-y-6">
      <PreferencesForm />
      <SignalsList />
      <LearningSummary signalCount={signalCount} />
    </div>
  );
}
