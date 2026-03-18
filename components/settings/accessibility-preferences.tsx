"use client";

import { useEffect } from "react";

export const ACCESSIBILITY_STORAGE_KEY = "consultant-platform-accessibility";

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

export function loadAccessibilityPreferences() {
  if (typeof window === "undefined") {
    return defaultAccessibilityPreferences;
  }

  return parseStoredPreferences(window.localStorage.getItem(ACCESSIBILITY_STORAGE_KEY));
}

export function persistAccessibilityPreferences(preferences: AccessibilityPreferences) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(preferences));
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
  useEffect(() => {
    applyAccessibilityPreferences(loadAccessibilityPreferences());
  }, []);

  return null;
}
