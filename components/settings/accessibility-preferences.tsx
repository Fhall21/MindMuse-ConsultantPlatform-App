"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth/client";

export const accessibilityStorageKey = (userId: string) =>
  `consultant-platform-accessibility:${userId}`;

export type AccessibilityPreferences = {
  textSize: "default" | "large";
  contrastMode: "default" | "high";
  focusMode: "default" | "strong";
  reduceMotion: boolean;
};

export const defaultAccessibilityPreferences: AccessibilityPreferences = {
  textSize: "default",
  contrastMode: "default",
  focusMode: "default",
  reduceMotion: false,
};

function parseStoredPreferences(rawValue: string | null): AccessibilityPreferences {
  if (!rawValue) {
    return defaultAccessibilityPreferences;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<AccessibilityPreferences>;

    return {
      textSize: parsed.textSize === "large" ? "large" : "default",
      contrastMode: parsed.contrastMode === "high" ? "high" : "default",
      focusMode: parsed.focusMode === "strong" ? "strong" : "default",
      reduceMotion: parsed.reduceMotion === true,
    };
  } catch {
    return defaultAccessibilityPreferences;
  }
}

export function loadAccessibilityPreferences(userId?: string | null) {
  if (typeof window === "undefined") {
    return defaultAccessibilityPreferences;
  }

  if (!userId) {
    return defaultAccessibilityPreferences;
  }

  return parseStoredPreferences(window.localStorage.getItem(accessibilityStorageKey(userId)));
}

export function persistAccessibilityPreferences(
  preferences: AccessibilityPreferences,
  userId?: string | null
) {
  if (typeof window === "undefined") {
    return;
  }

  if (!userId) {
    return;
  }

  window.localStorage.setItem(accessibilityStorageKey(userId), JSON.stringify(preferences));
}

export function applyAccessibilityPreferences(
  preferences: AccessibilityPreferences,
  element: HTMLElement = document.documentElement
) {
  element.dataset.accessibilityTextSize = preferences.textSize;
  element.dataset.accessibilityContrast = preferences.contrastMode;
  element.dataset.accessibilityFocus = preferences.focusMode;
  element.dataset.accessibilityMotion = preferences.reduceMotion ? "reduced" : "default";
}

export function AccessibilityPreferencesSync() {
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (isPending) {
      return;
    }

    applyAccessibilityPreferences(loadAccessibilityPreferences(session?.user.id ?? null));
  }, [isPending, session?.user.id]);

  return null;
}
