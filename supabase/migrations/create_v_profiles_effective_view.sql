-- ============================================================================
-- View: v_profiles_effective
-- ============================================================================
-- Provides profile data with computed effective_plan and trial metadata
-- effective_plan = 'pro' if plan='free_demo' AND trial_active=true, otherwise plan
-- Includes trial_started_at, trial_ends_at, trial_active, trial_days_left
-- ============================================================================

DROP VIEW IF EXISTS public.v_profiles_effective;

CREATE OR REPLACE VIEW public.v_profiles_effective AS
SELECT 
  p.*,
  -- Compute effective_plan: if free_demo with active trial, treat as 'pro'
  CASE 
    WHEN p.plan = 'free_demo' 
      AND p.trial_active = true 
      AND p.trial_ends_at IS NOT NULL 
      AND p.trial_ends_at > NOW()
    THEN 'pro'
    ELSE p.plan
  END AS effective_plan,
  -- Trial metadata
  p.trial_started_at,
  p.trial_ends_at,
  COALESCE(
    p.trial_active = true 
    AND p.trial_ends_at IS NOT NULL 
    AND p.trial_ends_at > NOW(),
    false
  ) AS trial_active,
  -- Calculate trial_days_left (ceiling of days remaining, minimum 0)
  CASE 
    WHEN p.trial_ends_at IS NOT NULL AND p.trial_ends_at > NOW() THEN
      GREATEST(0, CEIL(EXTRACT(EPOCH FROM (p.trial_ends_at - NOW())) / 86400.0)::INTEGER)
    ELSE NULL
  END AS trial_days_left
FROM public.profiles p;

-- Grant access to authenticated users
GRANT SELECT ON public.v_profiles_effective TO authenticated;

-- Add comment
COMMENT ON VIEW public.v_profiles_effective IS 'Profile view with effective plan computation: free_demo with active trial maps to pro. Includes trial metadata.';

