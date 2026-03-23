import posthog from "posthog-js";

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
  api_host: "/ingest",
  ui_host: "https://eu.posthog.com",
  defaults: "2026-01-30",
  capture_exceptions: true,
  debug: process.env.NODE_ENV === "development",
  session_recording: {
    recordCrossOriginIframes: false,
    maskAllInputs: true,
    maskInputOptions: {
      // Mask password-like fields
      password: true,
      email: true,
    },
    // Capture all sessions in development, sample in production
    sampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,
  },
});
