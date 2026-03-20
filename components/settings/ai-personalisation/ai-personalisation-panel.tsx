"use client";

import { PreferencesForm } from "./preferences-form";
import { SignalsList } from "./signals-list";
import { useAIPreferences } from "@/hooks/use-ai-preferences";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function InsightsSummaryPlaceholder({ signalCount }: { signalCount: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI-generated insights</CardTitle>
        <CardDescription>
          Analysis of your personalisation patterns and suggestions for improvement.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-dashed p-6 text-center">
          {signalCount > 0 ? (
            <p className="text-sm text-muted-foreground">
              AI-powered analysis of your {signalCount} decisions will be
              available in a future update. The more you accept and reject
              insights, the smarter your personalisation becomes.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Start reviewing consultations to build your personalisation
              profile. The AI will analyse your patterns once you have enough
              data.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AIPersonalisationPanel() {
  const { data: prefs } = useAIPreferences();
  const signalCount = prefs?.signalCount ?? 0;

  return (
    <div className="space-y-6">
      <PreferencesForm />
      <SignalsList />
      <InsightsSummaryPlaceholder signalCount={signalCount} />
    </div>
  );
}
