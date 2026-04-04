// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  accessibilityStorageKey,
  defaultAccessibilityPreferences,
  loadAccessibilityPreferences,
  persistAccessibilityPreferences,
} from "@/components/settings/accessibility-preferences";

const storage = new Map<string, string>();

Object.defineProperty(window, "localStorage", {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
  },
  configurable: true,
});

describe("accessibility-preferences", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("stores preferences under a user-scoped key", () => {
    persistAccessibilityPreferences(
      {
        textSize: "large",
        contrastMode: "high",
        focusMode: "strong",
        reduceMotion: true,
      },
      "user-a"
    );

    expect(loadAccessibilityPreferences("user-a")).toEqual({
      textSize: "large",
      contrastMode: "high",
      focusMode: "strong",
      reduceMotion: true,
    });
    expect(loadAccessibilityPreferences("user-b")).toEqual(defaultAccessibilityPreferences);
    expect(window.localStorage.getItem(accessibilityStorageKey("user-a"))).not.toBeNull();
    expect(window.localStorage.getItem(accessibilityStorageKey("user-b"))).toBeNull();
  });

  it("returns defaults when no user is available", () => {
    persistAccessibilityPreferences(
      {
        textSize: "large",
        contrastMode: "high",
        focusMode: "strong",
        reduceMotion: true,
      },
      "user-a"
    );

    expect(loadAccessibilityPreferences(null)).toEqual(defaultAccessibilityPreferences);
  });
});