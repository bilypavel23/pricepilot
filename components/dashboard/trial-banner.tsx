"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

interface TrialBannerProps {
  plan: string | null | undefined;
  trialActive: boolean;
  trialDaysLeft: number;
}

export function TrialBanner({ plan, trialActive, trialDaysLeft }: TrialBannerProps) {
  // Only show banner for free_demo plans
  if (plan !== "free_demo") {
    return null;
  }

  if (!trialActive) {
    // Trial ended - show orange banner
    return (
      <Alert className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50">
        <Info className="h-4 w-4 text-amber-600 dark:text-amber-500" />
        <AlertTitle className="text-amber-900 dark:text-amber-100">
          Free trial ended
        </AlertTitle>
        <AlertDescription className="mt-2 flex items-center justify-between gap-4 text-amber-800 dark:text-amber-200">
          <span>Upgrade to continue using PricePilot with full access to all features.</span>
          <Link href="/app/pricing">
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600">
              Upgrade
            </Button>
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  // Active trial - show orange banner with time left
  const daysText = trialDaysLeft > 0
    ? `${trialDaysLeft} ${trialDaysLeft === 1 ? "day" : "days"}`
    : "less than 1 day";

  return (
    <Alert className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50">
      <Info className="h-4 w-4 text-amber-600 dark:text-amber-500" />
      <AlertTitle className="text-amber-900 dark:text-amber-100">
        You are currently using a free trial
      </AlertTitle>
      <AlertDescription className="mt-2 flex items-center justify-between gap-4 text-amber-800 dark:text-amber-200">
        <span>Time left: <strong>{daysText}</strong></span>
        <Link href="/app/pricing">
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600">
            Upgrade
          </Button>
        </Link>
      </AlertDescription>
    </Alert>
  );
}

