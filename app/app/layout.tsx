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
  let hasUser = false;
  
  try {
    const { user, profile } = await getProfile();
    hasUser = !!user;
    
    // If user is not authenticated, redirect to login
    // This should be handled by middleware, but we add it here as a safety check
    if (!user) {
      redirect("/login");
    }
    
    plan = normalizePlan(profile?.plan);
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
      <AppShell plan={plan}>{children}</AppShell>
    </PlanProvider>
  );
}

