/**
 * Trial helper functions
 * Computes trial status from profile data without requiring DB changes
 */

export interface TrialInfo {
  trialEndsAt: Date | null;
  isActive: boolean;
  daysLeft: number;
}

/**
 * Get trial end date from profile
 * If profile.trial_ends_at exists, use it
 * Otherwise derive from profile.created_at (or auth user created_at) + 14 days
 */
export function getTrialEndsAt(profile: any, userCreatedAt?: string | Date): Date | null {
  // If trial_ends_at exists in profile, use it
  if (profile?.trial_ends_at) {
    return new Date(profile.trial_ends_at);
  }

  // Otherwise derive from created_at + 14 days
  const createdAt = profile?.created_at || userCreatedAt;
  if (!createdAt) {
    return null;
  }

  const createdDate = new Date(createdAt);
  const trialEndDate = new Date(createdDate);
  trialEndDate.setDate(trialEndDate.getDate() + 14);
  
  return trialEndDate;
}

/**
 * Check if trial is currently active
 * Trial is active if trialEndsAt exists and is in the future
 */
export function isTrialActive(profile: any, userCreatedAt?: string | Date): boolean {
  const endsAt = getTrialEndsAt(profile, userCreatedAt);
  if (!endsAt) {
    return false;
  }
  
  return endsAt > new Date();
}

/**
 * Get days remaining in trial
 * Returns ceil((endsAt - now) / 86400000), clamped to minimum 0
 */
export function getDaysLeft(profile: any, userCreatedAt?: string | Date): number {
  const endsAt = getTrialEndsAt(profile, userCreatedAt);
  if (!endsAt) {
    return 0;
  }

  const now = new Date();
  const diffMs = endsAt.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffMs / 86400000);
  
  return Math.max(0, daysLeft);
}

/**
 * Get complete trial info
 */
export function getTrialInfo(profile: any, userCreatedAt?: string | Date): TrialInfo {
  const trialEndsAt = getTrialEndsAt(profile, userCreatedAt);
  const isActive = isTrialActive(profile, userCreatedAt);
  const daysLeft = getDaysLeft(profile, userCreatedAt);

  return {
    trialEndsAt,
    isActive,
    daysLeft,
  };
}

