/** Legacy dashboard at `/dashboard/legacy` when `FEATURE_LEGACY_DASHBOARD=true`. */
export function isLegacyDashboardEnabled(): boolean {
  return process.env.FEATURE_LEGACY_DASHBOARD === "true";
}
