/** Task 07 will replace stub with flag sync + userMode transition. */
export type OnboardingMilestone =
  | "consultation"
  | "meeting"
  | "insight_accept"
  | "quotes"
  | "grouping";

export interface OnboardingAccountState {
  userMode: "onboarding" | "returning";
}

/**
 * Record a onboarding milestone and optionally sync session user_mode.
 * Stub: no-op until Task 07 lands full onboarding-state module.
 */
export async function recordOnboardingMilestone(
  _userId: string,
  _sessionId: string,
  _milestone: OnboardingMilestone
): Promise<OnboardingAccountState> {
  return { userMode: "onboarding" };
}
