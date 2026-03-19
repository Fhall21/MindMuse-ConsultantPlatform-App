type RuntimeDiagnostics = {
  nodeEnv: string | undefined;
  appSiteUrl: string | null;
  aiServiceUrl: string | null;
  allowedOriginsCount: number;
  database: {
    mode: "discrete-env" | "database-url" | "unset";
    host: string | null;
    port: string | null;
    name: string | null;
    user: string | null;
    urlHost: string | null;
  };
};

let runtimeDiagnosticsLogged = false;

function redactHttpUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    parsed.username = "";
    parsed.password = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "<invalid-url>";
  }
}

function summarizeDatabaseConfig(): RuntimeDiagnostics["database"] {
  const host = process.env.DATABASE_HOST ?? null;
  const port = process.env.DATABASE_PORT ?? null;
  const name = process.env.DATABASE_NAME ?? null;
  const user = process.env.DATABASE_USER ?? null;
  const directUrl = process.env.DATABASE_URL;

  if (host || name || user || process.env.DATABASE_PASSWORD) {
    return {
      mode: "discrete-env",
      host,
      port,
      name,
      user,
      urlHost: null,
    };
  }

  if (directUrl) {
    try {
      const parsed = new URL(directUrl);
      return {
        mode: "database-url",
        host: null,
        port: parsed.port || null,
        name: parsed.pathname.replace(/^\//, "") || null,
        user: parsed.username || null,
        urlHost: parsed.hostname,
      };
    } catch {
      return {
        mode: "database-url",
        host: null,
        port: null,
        name: null,
        user: null,
        urlHost: "<invalid-url>",
      };
    }
  }

  return {
    mode: "unset",
    host: null,
    port: null,
    name: null,
    user: null,
    urlHost: null,
  };
}

export function getRuntimeDiagnostics(): RuntimeDiagnostics {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
    : [];

  return {
    nodeEnv: process.env.NODE_ENV,
    appSiteUrl: redactHttpUrl(process.env.APP_SITE_URL),
    aiServiceUrl: redactHttpUrl(process.env.AI_SERVICE_URL),
    allowedOriginsCount: allowedOrigins.length,
    database: summarizeDatabaseConfig(),
  };
}

export function logRuntimeDiagnostics(trigger: string): void {
  if (runtimeDiagnosticsLogged || process.env.NODE_ENV === "test") {
    return;
  }

  runtimeDiagnosticsLogged = true;
  console.info("[boot] runtime diagnostics", {
    trigger,
    pid: process.pid,
    ...getRuntimeDiagnostics(),
  });
}