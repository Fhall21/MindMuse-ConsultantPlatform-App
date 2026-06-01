import { createHmac, timingSafeEqual } from "node:crypto";
import { getBetterAuthSecret } from "@/lib/env";
import { CHAT_SERVICE_TOKEN_TTL_MS } from "./constants";

function signPayload(payload: string): string {
  return createHmac("sha256", getBetterAuthSecret()).update(payload).digest("base64url");
}

export function createChatServiceToken(params: { userId: string; sessionId: string }): string {
  const exp = Date.now() + CHAT_SERVICE_TOKEN_TTL_MS;
  const payload = `${params.userId}:${params.sessionId}:${exp}`;
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${signPayload(payload)}`;
}

export function verifyChatServiceToken(
  token: string
): { userId: string; sessionId: string } | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  let payload: string;
  try {
    payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expected = signPayload(payload);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  const [userId, sessionId, expRaw] = payload.split(":");
  const exp = Number(expRaw);
  if (!userId || !sessionId || !Number.isFinite(exp) || Date.now() > exp) {
    return null;
  }

  return { userId, sessionId };
}
