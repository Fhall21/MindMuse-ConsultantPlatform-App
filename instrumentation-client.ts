import posthog from "posthog-js";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

function isLocalhost(hostname: string | undefined) {
  return hostname ? LOCAL_HOSTNAMES.has(hostname) : false;
}

function shouldEnablePostHog() {
  if (typeof window === "undefined") {
    return false;
  }

  return !isLocalhost(window.location.hostname);
}

const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (posthogToken && shouldEnablePostHog()) {
  posthog.init(posthogToken, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "/ingest",
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || "https://eu.posthog.com",
    defaults: "2026-01-30",
    capture_exceptions: true,
    debug: false,
    session_recording: {
      recordCrossOriginIframes: false,
      maskAllInputs: true,
      maskInputOptions: {
        // Mask password-like fields
        password: true,
        email: true,
      },
      // Capture all sessions in production, sample in non-local environments.
      sampleRate: 0.1,
    },
  });
}
