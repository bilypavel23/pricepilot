/**
 * API Route: /api/scraping/matching
 * 
 * Triggers product matching for a competitor store.
 * Supports quick-start mode for immediate results.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateStore } from "@/lib/store";
import {
  runQuickStartMatching,
  canAddCompetitorStore,
  incrementCompetitorStoresAdded,
  getRateLimitStatus,
  getOrCreateScrapeBudget,
  createQuickStartMatchingJob,
  updateMatchingJobStatus,
} from "@/lib/scraping";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { competitorId, quickStart = true } = body;

    if (!competitorId) {
      return NextResponse.json(
        { error: "competitorId is required" },
        { status: 400 }
      );
    }

    // Get user's store
    const store = await getOrCreateStore();

    // Get competitor info
    const { data: competitor, error: compError } = await supabase
      .from("competitors")
      .select("id, url, store_id")
      .eq("id", competitorId)
      .eq("store_id", store.id)
      .single();

    if (compError || !competitor) {
      return NextResponse.json(
        { error: "Competitor not found" },
        { status: 404 }
      );
    }

    // Check rate limits
    const rateLimit = await getRateLimitStatus(user.id);
    if (!rateLimit.canRunHeavyMatching) {
      return NextResponse.json(
        {
          ok: false,
          skipped: true,
          reason: "Heavy matching limit reached for today. Try again tomorrow.",
          rateLimit: {
            heavyMatchingCount: rateLimit.heavyMatchingCount,
            maxPerDay: 1,
          },
        },
        { status: 200 }
      );
    }

    // Check budget
    const budget = await getOrCreateScrapeBudget(user.id);
    if (!budget.canScrape) {
      return NextResponse.json(
        {
          ok: false,
          skipped: true,
          reason: "Budget exceeded",
          budget: {
            dailyUsed: budget.dailyUsed,
            dailyLimit: budget.dailyLimit,
          },
        },
        { status: 200 }
      );
    }

    // Create job record
    const jobId = await createQuickStartMatchingJob(user.id, store.id, competitorId);

    if (quickStart) {
      // Run quick-start matching immediately
      if (jobId) {
        await updateMatchingJobStatus(jobId, "in_progress");
      }

      const result = await runQuickStartMatching(
        user.id,
        store.id,
        competitorId,
        competitor.url
      );

      if (jobId) {
        await updateMatchingJobStatus(
          jobId,
          result.budgetExhausted ? "deferred" : "completed",
          result
        );
      }

      return NextResponse.json({
        ok: true,
        jobId,
        productsMatched: result.productsMatched,
        productsDeferred: result.productsDeferred,
        budgetExhausted: result.budgetExhausted,
        isQuickStart: true,
        message: result.productsDeferred > 0
          ? "Quick-start completed. Remaining products queued for batch processing."
          : "Quick-start matching completed.",
      });
    }

    // Queue for batch processing only
    return NextResponse.json({
      ok: true,
      jobId,
      message: "Matching job queued for batch processing.",
    });
  } catch (error: any) {
    console.error("Matching job error:", error);
    return NextResponse.json(
      { error: error.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

/**
 * GET: Get matching status and rate limits
 */
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

    const store = await getOrCreateStore();

    // Get rate limit status
    const rateLimit = await getRateLimitStatus(user.id);

    // Get budget status
    const budget = await getOrCreateScrapeBudget(user.id);

    // Get pending matching jobs
    const { data: pendingJobs } = await supabase
      .from("scrape_jobs")
      .select("id, competitor_id, job_type, batch_number, scheduled_for, status")
      .eq("user_id", user.id)
      .eq("store_id", store.id)
      .in("job_type", ["matching", "quick_start_matching"])
      .in("status", ["pending", "in_progress"])
      .order("scheduled_for", { ascending: true });

    return NextResponse.json({
      rateLimit: {
        canRunHeavyMatching: rateLimit.canRunHeavyMatching,
        heavyMatchingCount: rateLimit.heavyMatchingCount,
        canAddCompetitorStore: rateLimit.canAddCompetitorStore,
        competitorStoresAdded: rateLimit.competitorStoresAdded,
        canAddUrls: rateLimit.canAddUrls,
        urlsAdded: rateLimit.urlsAdded,
      },
      budget: {
        dailyRemaining: budget.dailyRemaining,
        monthlyRemaining: budget.monthlyRemaining,
        canScrape: budget.canScrape,
      },
      pendingJobs: pendingJobs || [],
    });
  } catch (error: any) {
    console.error("Get matching status error:", error);
    return NextResponse.json(
      { error: error.message || "Unexpected error" },
      { status: 500 }
    );
  }
}



