import { AppShell } from "@/components/layout/app-shell";
import { getProfile } from "@/lib/getProfile";
import { PlanProvider } from "@/components/providers/plan-provider";
import { Plan, normalizePlan } from "@/lib/planLimits";
import { redirect } from "next/navigation";

// Force dynamic rendering because we use cookies()
export const dynamic = 'force-dynamic';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let plan: Plan = "free_demo";
  let canUseAIChat = false;
  let isDemo = false; // True only for profile.is_demo === true accounts
  let hasUser = false;
  
  try {
    const { user, profile, entitlements } = await getProfile();
    hasUser = !!user;
    
    // If user is not authenticated, redirect to login
    // This should be handled by middleware, but we add it here as a safety check
    if (!user) {
      redirect("/login");
    }
    
    // Use entitlements for effective plan and AI chat access
    if (entitlements) {
      plan = normalizePlan(entitlements.effectivePlan);
      canUseAIChat = entitlements.canUseAIChat;
    } else {
      // Fallback if entitlements not available
      const effectivePlan = profile?.effective_plan ?? profile?.plan;
      plan = normalizePlan(effectivePlan);
    }

    // Check if user is a demo/test account (profile.is_demo === true)
    // This is different from free_demo plan users on trial
    isDemo = profile?.is_demo === true;
  } catch (error) {
    console.error("Error loading profile in AppLayout:", error);
    // If there's an error and we can't verify user, redirect to login
    if (!hasUser) {
      redirect("/login");
    }
    // Use default plan if there's an error but user exists
    plan = "free_demo";
  }

  return (
    <PlanProvider plan={plan}>
      <AppShell plan={plan} canUseAIChat={canUseAIChat} isDemo={isDemo}>{children}</AppShell>
    </PlanProvider>
  );
}

