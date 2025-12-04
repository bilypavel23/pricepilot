import { AppShell } from "@/components/layout/app-shell";
import { getProfile } from "@/lib/getProfile";
import { PlanProvider } from "@/components/providers/plan-provider";
import { Plan, normalizePlan } from "@/lib/planLimits";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await getProfile();
  const plan: Plan = normalizePlan(profile?.plan);

  return (
    <PlanProvider plan={plan}>
      <AppShell plan={plan}>{children}</AppShell>
    </PlanProvider>
  );
}

