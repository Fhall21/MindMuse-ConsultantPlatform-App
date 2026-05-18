/**
 * Simple env-driven feature flag system. v1 rollout shape: comma-separated user
 * IDs in an env var, or "*" to enable for everyone. The intent is to ship the
 * feature behind a switch so we can enable it per-user during the first week
 * without requiring schema work for a user_features table. When we need
 * per-user persistence later, swap this module's body for a DB lookup —
 * the call sites (`isResearchExtractionEnabledForUser`) stay the same.
 */

function isUserInAllowlist(userId: string, raw: string | undefined): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (trimmed === "*" || trimmed.toLowerCase() === "true") return true;
  const allowed = new Set(
    trimmed
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  return allowed.has(userId);
}

export function isResearchExtractionEnabledForUser(userId: string): boolean {
  return isUserInAllowlist(userId, process.env.RESEARCH_EXTRACTION_ENABLED);
}

export interface ClientFeatureFlags {
  researchExtractionEnabled: boolean;
}

export function getClientFeatureFlagsForUser(userId: string): ClientFeatureFlags {
  return {
    researchExtractionEnabled: isResearchExtractionEnabledForUser(userId),
  };
}
