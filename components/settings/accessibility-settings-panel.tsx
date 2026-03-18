"use client";

import { useEffect, useEffectEvent, useState } from "react";
import {
  applyAccessibilityPreferences,
  defaultAccessibilityPreferences,
  loadAccessibilityPreferences,
  persistAccessibilityPreferences,
  type AccessibilityPreferences,
} from "@/components/settings/accessibility-preferences";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function PreferenceButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      onClick={onClick}
      aria-pressed={active}
    >
      {label}
    </Button>
  );
}

function summarizePreferences(preferences: AccessibilityPreferences) {
  return [
    preferences.textSize === "large" ? "Larger text enabled" : "Default text size",
    preferences.focusMode === "strong" ? "Stronger focus rings enabled" : "Default focus rings",
    preferences.reduceMotion ? "Reduced motion enabled" : "Standard motion settings",
  ];
}

export function AccessibilitySettingsPanel() {
  const [preferences, setPreferences] = useState(defaultAccessibilityPreferences);
  const [hasLoadedStoredPreferences, setHasLoadedStoredPreferences] = useState(false);

  const syncStoredPreferences = useEffectEvent((nextPreferences: AccessibilityPreferences) => {
    setHasLoadedStoredPreferences(true);
    setPreferences(nextPreferences);
  });

  useEffect(() => {
    syncStoredPreferences(loadAccessibilityPreferences());
  }, []);

  useEffect(() => {
    if (!hasLoadedStoredPreferences) {
      return;
    }

    applyAccessibilityPreferences(preferences);
    persistAccessibilityPreferences(preferences);
  }, [hasLoadedStoredPreferences, preferences]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Accessibility Features</CardTitle>
          <CardDescription>
            Tune the interface for clearer reading, stronger focus states, and less motion.
            Changes apply immediately across the app on this device.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
            <div className="space-y-5">
              <div className="rounded-xl border p-4">
                <div className="space-y-2">
                  <p className="font-medium">Text size</p>
                  <p className="text-sm text-muted-foreground">
                    Increase the default reading size to make long forms and consultation data
                    easier to scan.
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <PreferenceButton
                    active={preferences.textSize === "default"}
                    label="Default text"
                    onClick={() =>
                      setPreferences((current) => ({ ...current, textSize: "default" }))
                    }
                  />
                  <PreferenceButton
                    active={preferences.textSize === "large"}
                    label="Larger text"
                    onClick={() =>
                      setPreferences((current) => ({ ...current, textSize: "large" }))
                    }
                  />
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="space-y-2">
                  <p className="font-medium">Focus visibility</p>
                  <p className="text-sm text-muted-foreground">
                    Strengthen keyboard focus indicators so active controls stand out more clearly.
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <PreferenceButton
                    active={preferences.focusMode === "default"}
                    label="Default focus"
                    onClick={() =>
                      setPreferences((current) => ({ ...current, focusMode: "default" }))
                    }
                  />
                  <PreferenceButton
                    active={preferences.focusMode === "strong"}
                    label="Stronger focus"
                    onClick={() =>
                      setPreferences((current) => ({ ...current, focusMode: "strong" }))
                    }
                  />
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="space-y-2">
                  <p className="font-medium">Motion preferences</p>
                  <p className="text-sm text-muted-foreground">
                    Reduce transitions and animations to keep navigation calmer and easier to
                    follow.
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <PreferenceButton
                    active={!preferences.reduceMotion}
                    label="Standard motion"
                    onClick={() =>
                      setPreferences((current) => ({ ...current, reduceMotion: false }))
                    }
                  />
                  <PreferenceButton
                    active={preferences.reduceMotion}
                    label="Reduce motion"
                    onClick={() =>
                      setPreferences((current) => ({ ...current, reduceMotion: true }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
              <div>
                <p className="font-medium">Current profile</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hasLoadedStoredPreferences
                    ? "These preferences are stored locally and reused when you return."
                    : "Loading your accessibility preferences..."}
                </p>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                {summarizePreferences(preferences).map((summary) => (
                  <p key={summary}>{summary}</p>
                ))}
              </div>

              <div className="rounded-lg border border-dashed bg-background/80 p-4">
                <p className="font-medium">Next improvements</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  High-contrast themes and more reading-density controls can slot into this section
                  later without changing the overall settings structure.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => setPreferences(defaultAccessibilityPreferences)}
              >
                Reset to defaults
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
