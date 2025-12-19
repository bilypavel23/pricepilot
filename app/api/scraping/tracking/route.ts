/**
 * API Route: /api/scraping/tracking
 * 
 * Triggers a price tracking job for the authenticated user's store.
 * This endpoint is called by cron jobs or can be triggered manually.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateStore } from "@/lib/store";
import {
  runTrackingJob,
  canRunTracking,
  createTrackingJob,
  updateTrackingJobStatus,
  getOrCreateScrapeBudget,
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

    // Get user's plan
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();

    const plan = profile?.plan ?? "STARTER";

    // Get user's store
    const store = await getOrCreateStore();

    // Check if tracking can run
    const canRun = await canRunTracking(user.id, store.id, plan);
    if (!canRun.allowed) {
      return NextResponse.json(
        {
          ok: false,
          skipped: true,
          reason: canRun.reason,
          nextAllowedAt: canRun.nextAllowedAt?.toISOString(),
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
            monthlyUsed: budget.monthlyUsed,
            monthlyLimit: budget.monthlyLimit,
          },
        },
        { status: 200 }
      );
    }

    // Create job record
    const jobId = await createTrackingJob(user.id, store.id);
    if (!jobId) {
      return NextResponse.json(
        { error: "Failed to create tracking job" },
        { status: 500 }
      );
    }

    // Update job status to in_progress
    await updateTrackingJobStatus(jobId, "in_progress");

    // Run the tracking job
    const result = await runTrackingJob(user.id, store.id, plan);

    // Update job status
    await updateTrackingJobStatus(
      jobId,
      result.budgetExhausted ? "deferred" : "completed",
      result
    );

    return NextResponse.json({
      ok: true,
      jobId,
      linksProcessed: result.linksProcessed,
      linksDeferred: result.linksDeferred,
      priceChanges: result.priceChanges,
      errors: result.errors,
      budgetExhausted: result.budgetExhausted,
    });
  } catch (error: any) {
    console.error("Tracking job error:", error);
    return NextResponse.json(
      { error: error.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

/**
 * GET: Get tracking job status and budget info
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

    // Get budget status
    const budget = await getOrCreateScrapeBudget(user.id);

    // Get last job
    const { data: lastJob } = await supabase
      .from("scrape_jobs")
      .select("*")
      .eq("user_id", user.id)
      .eq("store_id", store.id)
      .eq("job_type", "tracking")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Get pending jobs count
    const { count: pendingCount } = await supabase
      .from("scrape_jobs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("store_id", store.id)
      .eq("status", "pending");

    return NextResponse.json({
      budget: {
        dailyUsed: budget.dailyUsed,
        dailyLimit: budget.dailyLimit,
        dailyRemaining: budget.dailyRemaining,
        monthlyUsed: budget.monthlyUsed,
        monthlyLimit: budget.monthlyLimit,
        monthlyRemaining: budget.monthlyRemaining,
        canScrape: budget.canScrape,
      },
      lastJob: lastJob
        ? {
            id: lastJob.id,
            status: lastJob.status,
            itemsProcessed: lastJob.items_processed,
            startedAt: lastJob.started_at,
            completedAt: lastJob.completed_at,
            error: lastJob.error_message,
          }
        : null,
      pendingJobs: pendingCount || 0,
    });
  } catch (error: any) {
    console.error("Get tracking status error:", error);
    return NextResponse.json(
      { error: error.message || "Unexpected error" },
      { status: 500 }
    );
  }
}


