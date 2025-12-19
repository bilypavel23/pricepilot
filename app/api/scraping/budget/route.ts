/**
 * API Route: /api/scraping/budget
 * 
 * Get scraping budget status for the authenticated user.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getOrCreateScrapeBudget,
  MAX_DAILY_REQUESTS_PER_USER,
  MAX_MONTHLY_REQUESTS_PER_USER,
  SCRAPE_COST_PER_1000_REQ_USD,
  MAX_SCRAPE_BUDGET_USD_PER_USER_MONTH,
} from "@/lib/scraping";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const budget = await getOrCreateScrapeBudget(user.id);

    // Calculate estimated cost
    const estimatedDailyCost = (budget.dailyUsed / 1000) * SCRAPE_COST_PER_1000_REQ_USD;
    const estimatedMonthlyCost = (budget.monthlyUsed / 1000) * SCRAPE_COST_PER_1000_REQ_USD;

    return NextResponse.json({
      daily: {
        used: budget.dailyUsed,
        limit: budget.dailyLimit,
        remaining: budget.dailyRemaining,
        percentUsed: Math.round((budget.dailyUsed / budget.dailyLimit) * 100),
      },
      monthly: {
        used: budget.monthlyUsed,
        limit: budget.monthlyLimit,
        remaining: budget.monthlyRemaining,
        percentUsed: Math.round((budget.monthlyUsed / budget.monthlyLimit) * 100),
      },
      canScrape: budget.canScrape,
      estimatedCost: {
        dailyUsd: estimatedDailyCost.toFixed(2),
        monthlyUsd: estimatedMonthlyCost.toFixed(2),
        budgetUsd: MAX_SCRAPE_BUDGET_USD_PER_USER_MONTH.toFixed(2),
      },
      config: {
        maxDailyRequests: MAX_DAILY_REQUESTS_PER_USER,
        maxMonthlyRequests: MAX_MONTHLY_REQUESTS_PER_USER,
        costPer1000Requests: SCRAPE_COST_PER_1000_REQ_USD,
        monthlyBudgetUsd: MAX_SCRAPE_BUDGET_USD_PER_USER_MONTH,
      },
    });
  } catch (error: any) {
    console.error("Get budget error:", error);
    return NextResponse.json(
      { error: error.message || "Unexpected error" },
      { status: 500 }
    );
  }
}


