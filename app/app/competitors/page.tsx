import { getProfile } from "@/lib/getProfile";
import { getMatchCountForCompetitor, getActiveStore } from "@/lib/competitors";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, ExternalLink, CheckCircle2, AlertCircle, Loader2, Info } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CompetitorsClient } from "@/components/competitors/competitors-client";
import { DeleteCompetitorButton } from "@/components/competitors/delete-competitor-button";
import { getCompetitorLimit } from "@/lib/planLimits";
import { getDiscoveryQuota } from "@/lib/discovery-quota";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getOrCreateStoreSyncSettings,
  computeNextSyncDate,
  formatNextSyncDistance,
  formatTimeHM,
  type StoreSyncSettings,
} from "@/lib/competitors/syncSettings";
import { getUrlCompetitorProductsCount } from "@/lib/competitors/url-count";

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays === 0) {
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `Today, ${hours}:${minutes}`;
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return d.toLocaleDateString();
  }
}

/**
 * Get plan display name (Starter/Pro/Scale) from plan string
 */
function getPlanDisplayName(plan: string | null | undefined): string {
  if (!plan) return "Starter";
  
  const normalized = plan.toLowerCase().trim();
  
  if (normalized === "starter" || normalized === "basic" || normalized === "free_demo" || normalized === "demo" || normalized === "free") {
    return "Starter";
  }
  if (normalized === "pro" || normalized === "professional") {
    return "Pro";
  }
  if (normalized === "scale" || normalized === "ultra" || normalized === "enterprise") {
    return "Scale";
  }
  
  // Try uppercase match
  const upper = plan.toUpperCase();
  if (upper === "STARTER") {
    return "Starter";
  }
  if (upper === "PRO") {
    return "Pro";
  }
  if (upper === "SCALE" || upper === "ULTRA") {
    return "Scale";
  }
  
  // Default fallback
  return "Starter";
}

export default async function CompetitorsPage() {
  const { user, profile } = await getProfile();

  if (!user) {
    redirect("/login");
  }

  const isDemo = profile?.plan === "free_demo";

  // Get userId and active store
  const userId = user.id;
  const store = await getActiveStore(userId);

  // Ensure store.id exists before proceeding
  if (!store?.id) {
    // Render loading state if store is not loaded yet
    return (
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10 lg:py-12">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading store...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Create Supabase client for server-side queries
  const supabase = await createClient();

  // Get plan and competitor limit
  const plan = (profile?.plan as string) ?? "STARTER";
  const limit = getCompetitorLimit(plan);

  // Load tracked competitors (counts toward limit)
  // Note: error_message column doesn't exist, so we don't select it
  const { data: trackedCompetitorsData, error: trackedError } = await supabase
    .from("competitors")
    .select("id, name, url, created_at, source, is_tracked, domain, status")
    .eq("store_id", store.id)
    .eq("is_tracked", true)
    .order("created_at", { ascending: true });

  // Ensure trackedCompetitors is ALWAYS an array, even if Supabase returns null or error
  const trackedCompetitors = Array.isArray(trackedCompetitorsData) ? trackedCompetitorsData : [];

  if (trackedError) {
    // Structured error logging for tracked competitors
    const errorStatus = (trackedError as any)?.status ?? null;
    const errorDetails = {
      context: "CompetitorsPage: loading tracked competitors",
      message: trackedError?.message || "Unknown error",
      code: trackedError?.code || "NO_CODE",
      details: trackedError?.details || null,
      hint: trackedError?.hint || null,
      status: errorStatus,
      raw: trackedError,
    };
    console.error("[CompetitorsPage]", JSON.stringify(errorDetails, null, 2));
    // Continue with empty array - page should still render
  }

  // Count URL-added competitor products (URLs) - doesn't count toward limit
  // Only call if store.id exists (already checked above, but double-check for safety)
  let urlCount = 0;
  if (store.id) {
    const urlCountResult = await getUrlCompetitorProductsCount(supabase, store.id);
    urlCount = urlCountResult.count;
    // Log error if present, but don't break the page
    if (urlCountResult.error) {
      console.error("[CompetitorsPage] URL count error:", urlCountResult.error);
    }
  }

  // Only count tracked competitors toward limit
  const used = (trackedCompetitors ?? []).length;

  // Get discovery quota (safely handle missing quota)
  let discoveryQuota = null;
  if (store?.id) {
    try {
      discoveryQuota = await getDiscoveryQuota(store.id, profile?.plan);
    } catch (error: any) {
      // Structured error logging for discovery quota
      const errorStatus = (error as any)?.status ?? null;
      const errorDetails = {
        context: "CompetitorsPage: loading discovery quota",
        message: error?.message || "Unknown error",
        code: error?.code || "NO_CODE",
        details: error?.details || null,
        hint: error?.hint || null,
        status: errorStatus,
        raw: error,
      };
      console.error("[CompetitorsPage]", JSON.stringify(errorDetails, null, 2));
      // Continue without quota display - page should still work
    }
  }

  // Get match counts and candidate counts for tracked competitors
  // Safe guard: ensure we have an array before calling Promise.all
  const trackedWithMatches = (trackedCompetitors ?? []).length > 0
    ? await Promise.all(
        (trackedCompetitors ?? []).map(async (competitor) => {
          try {
            const matchCount = await getMatchCountForCompetitor(store.id, competitor.id);
            
            // Get candidate count ONLY when confirmedCount === 0
            // After confirmation, candidates may still exist in DB, but UI must hide them
            let candidateCount = 0;
            if (matchCount === 0) {
              try {
                const { data: candidateData, error: candidateError } = await supabase.rpc(
                  "count_candidates_for_competitor_store",
                  {
                    p_competitor_id: competitor.id,
                    p_store_id: store.id,
                  }
                );
                
                if (candidateError) {
                  const errorStatus = (candidateError as any)?.status ?? null;
                  console.error(
                    `[CompetitorsPage] Error getting candidate count for competitor ${competitor.id}:`,
                    {
                      message: candidateError?.message || "Unknown error",
                      code: candidateError?.code || "NO_CODE",
                      details: candidateError?.details || null,
                      hint: candidateError?.hint || null,
                      status: errorStatus,
                    }
                  );
                } else {
                  candidateCount = candidateData ?? 0;
                }
              } catch (candidateErr: any) {
                console.error(
                  `[CompetitorsPage] Unexpected error getting candidate count for competitor ${competitor.id}:`,
                  candidateErr
                );
              }
            }
            
            return {
              ...competitor,
              matchCount: matchCount ?? 0,
              candidateCount: candidateCount ?? 0,
            };
          } catch (error: any) {
            // Log error but continue with 0 match count
            console.error(
              `[CompetitorsPage] Error getting match count for competitor ${competitor.id}:`,
              error
            );
            return {
              ...competitor,
              matchCount: 0,
              candidateCount: 0,
            };
          }
        })
      )
    : []; // Return empty array if no competitors

  // SYNC SETTINGS + NEXT SYNC + SYNC STATUS
  const now = new Date();
  let settings;
  let nextSyncDate: Date | null = null;
  let nextSyncText = "not scheduled";
  let nextSyncTimeLabel: string | null = null;
  
  // Load sync status from store_sync_settings
  let syncStatus: {
    last_competitor_sync_at: string | null;
    last_competitor_sync_status: string | null;
    last_competitor_sync_updated_count: number | null;
  } | null = null;
  
  try {
    settings = await getOrCreateStoreSyncSettings(store.id, user.id);
    nextSyncDate = computeNextSyncDate(settings, now);
    nextSyncText = formatNextSyncDistance(nextSyncDate, now);
    nextSyncTimeLabel = nextSyncDate ? formatTimeHM(nextSyncDate) : null;
    
    // Load sync status data
    const { data: syncSettingsData } = await supabase
      .from("store_sync_settings")
      .select("last_competitor_sync_at, last_competitor_sync_status, last_competitor_sync_updated_count")
      .eq("store_id", store.id)
      .maybeSingle();
    
    if (syncSettingsData) {
      syncStatus = {
        last_competitor_sync_at: syncSettingsData.last_competitor_sync_at || null,
        last_competitor_sync_status: syncSettingsData.last_competitor_sync_status || null,
        last_competitor_sync_updated_count: syncSettingsData.last_competitor_sync_updated_count || null,
      };
    }
  } catch (error) {
    console.warn("Failed to load sync settings, using defaults:", error);
    // Use defaults if sync settings fail to load
    const fallbackSettings: StoreSyncSettings = {
      store_id: store.id,
      timezone: "Europe/Prague",
      daily_sync_times: ["06:00"],
      sync_enabled: true,
    };
    settings = fallbackSettings;
    nextSyncDate = computeNextSyncDate(settings, now);
    nextSyncText = formatNextSyncDistance(nextSyncDate, now);
    nextSyncTimeLabel = nextSyncDate ? formatTimeHM(nextSyncDate) : null;
  }

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-8 py-10 lg:py-12 space-y-10">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Competitors</h1>
            <p className="text-sm text-muted-foreground mt-1">Track competitor prices and market positioning</p>
          </div>
          <CompetitorsClient isDemo={isDemo} storeId={store.id} used={used} limit={limit} />
        </div>
      </div>

      {/* Amazon Warning */}
      <div className="p-4 border border-yellow-400 bg-yellow-50 text-yellow-800 rounded-md text-sm mb-4 dark:bg-yellow-950/20 dark:border-yellow-600 dark:text-yellow-300">
        <strong>⚠️ Note about large marketplaces</strong>
        <p className="mt-1">
          Tracking prices from large marketplaces (Amazon, Walmart, etc.) may be unreliable due to advanced anti-scraping protections.
          For best results, we recommend adding competitor stores running on Shopify, WooCommerce, Shoptet, Magento, or custom storefronts.
        </p>
      </div>

      {/* Discovery Quota */}
      {discoveryQuota && (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">Competitor discovery</h3>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Info about competitor discovery quota"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="right"
                        align="start"
                        className="min-w-[480px] max-w-[560px] text-sm leading-relaxed whitespace-normal px-5 py-3"
                      >
                        <p>
                          You can scan up to {discoveryQuota.limit_amount.toLocaleString()} competitor products per month. Only scanned products count toward the limit. This applies only to &apos;Add competitor store&apos;. Adding competitors via product URLs is free.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-xs text-muted-foreground">
                  {discoveryQuota.limit_amount.toLocaleString()} products / month
                </p>
                <div className="mt-2">
                  <p className="text-sm font-semibold">
                    Discovery remaining: {discoveryQuota.remaining.toLocaleString()} / {discoveryQuota.limit_amount.toLocaleString()} this month
                  </p>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 mt-2">
                    <div
                      className={cn(
                        "h-2 rounded-full transition-all",
                        discoveryQuota.remaining < 1000
                          ? "bg-yellow-500"
                          : discoveryQuota.remaining < 500
                          ? "bg-red-500"
                          : "bg-blue-500"
                      )}
                      style={{
                        width: `${Math.max(0, Math.min(100, (discoveryQuota.remaining / discoveryQuota.limit_amount) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync Status Section */}
      <Card className="rounded-2xl bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Sync Status</h3>
              <div className="space-y-1.5 text-xs">
                {/* Tracked stores */}
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Tracked stores:</span>
                  <span className="font-medium">{trackedWithMatches.length}</span>
                </div>
                
                {/* Last sync */}
                {syncStatus?.last_competitor_sync_at ? (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Last sync:</span>
                    <span className="font-medium">
                      {(() => {
                        try {
                          const date = new Date(syncStatus.last_competitor_sync_at);
                          const now = new Date();
                          const diffMs = now.getTime() - date.getTime();
                          const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                          const diffDays = Math.floor(diffHours / 24);
                          
                          if (diffDays === 0) {
                            if (diffHours === 0) {
                              const diffMins = Math.floor(diffMs / (1000 * 60));
                              return diffMins < 1 ? "Just now" : `${diffMins} minutes ago`;
                            }
                            return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
                          } else if (diffDays === 1) {
                            return "Yesterday";
                          } else if (diffDays < 7) {
                            return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
                          } else {
                            return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          }
                        } catch {
                          return "Invalid date";
                        }
                      })()}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Last sync:</span>
                    <span className="font-medium">Never</span>
                  </div>
                )}
                
                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Status:</span>
                  {(() => {
                    // Determine status and color based on logic (same as competitor-sync-card.tsx)
                    let statusText: string;
                    let statusColor: string;
                    
                    if (!syncStatus?.last_competitor_sync_at || syncStatus.last_competitor_sync_at === null) {
                      statusText = "Never";
                      statusColor = "bg-gray-500 hover:bg-gray-600 text-white dark:bg-gray-600 dark:hover:bg-gray-700";
                    } else if (
                      syncStatus.last_competitor_sync_status === "ok" ||
                      (syncStatus.last_competitor_sync_updated_count !== null && syncStatus.last_competitor_sync_updated_count > 0)
                    ) {
                      statusText = "OK";
                      statusColor = "bg-green-500 hover:bg-green-600 text-white dark:bg-green-600 dark:hover:bg-green-700";
                    } else if (syncStatus.last_competitor_sync_status === "partial") {
                      statusText = "Partial";
                      statusColor = "bg-yellow-500 hover:bg-yellow-600 text-white dark:bg-yellow-600 dark:hover:bg-yellow-700";
                    } else if (syncStatus.last_competitor_sync_status === "error") {
                      statusText = "Failed";
                      statusColor = "bg-red-500 hover:bg-red-600 text-white dark:bg-red-600 dark:hover:bg-red-700";
                    } else if (
                      syncStatus.last_competitor_sync_updated_count !== null &&
                      syncStatus.last_competitor_sync_updated_count >= 0
                    ) {
                      statusText = "OK";
                      statusColor = "bg-green-500 hover:bg-green-600 text-white dark:bg-green-600 dark:hover:bg-green-700";
                    } else {
                      statusText = "Unknown";
                      statusColor = "bg-gray-500 hover:bg-gray-600 text-white dark:bg-gray-600 dark:hover:bg-gray-700";
                    }
                    
                    return (
                      <Badge 
                        variant="outline"
                        className={cn("text-[10px] px-2 py-0 border-0", statusColor)}
                      >
                        {statusText}
                      </Badge>
                    );
                  })()}
                </div>
                
                {/* Updated prices */}
                {(() => {
                  const updatedCount = syncStatus?.last_competitor_sync_updated_count;
                  return updatedCount != null && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Updated prices:</span>
                      <span className="font-medium">{updatedCount}</span>
                    </div>
                  );
                })()}
                
                {/* Next sync - keep existing format */}
                {nextSyncDate && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Next sync:</span>
                    <span className="font-medium">
                      {nextSyncText}
                      {nextSyncTimeLabel && ` (at ${nextSyncTimeLabel})`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Competitor Stores */}
      <Card>
        <CardHeader>
          <CardTitle>Competitor Stores</CardTitle>
          <CardDescription>Manage your tracked competitor stores and review matches.</CardDescription>
        </CardHeader>
        <CardContent>
          {trackedWithMatches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No tracked competitor stores added yet. Click "Add competitor store" to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trackedWithMatches.map((competitor) => {
                const firstLetter = competitor.name.charAt(0).toUpperCase();
                const lastSync = formatDate(competitor.created_at);

                return (
                  <div
                    key={competitor.id}
                    className="flex items-center justify-between gap-4 rounded-2xl bg-white dark:bg-card border border-slate-100 dark:border-border shadow-[0_18px_45px_rgba(15,23,42,0.06)] px-5 py-4 hover:-translate-y-[1px] hover:shadow-[0_22px_55px_rgba(15,23,42,0.10)] transition-all duration-150"
                  >
                    {/* Left: Avatar + Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-semibold text-lg">{firstLetter}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-foreground truncate">{competitor.name}</p>
                          {(competitor.status === "pending" || competitor.status === "processing") && (
                            <Badge variant="default" className="text-[10px] px-2 py-0.5">
                              {competitor.status === "processing" ? "Processing" : "Pending"}
                            </Badge>
                          )}
                          {competitor.status === "paused" && (
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                              Paused
                            </Badge>
                          )}
                          {(competitor.status === "error" || competitor.status === "failed") && (
                            <Badge variant="destructive" className="text-[10px] px-2 py-0.5">
                              <AlertCircle className="h-3 w-3 mr-1 inline" />
                              Error
                            </Badge>
                          )}
                          {competitor.status === "active" && (
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-green-500 text-green-600 dark:text-green-400">
                              <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                              Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{competitor.url}</p>
                        <div className="flex flex-col gap-1 mt-2">
                          {competitor.matchCount > 0 ? (
                            // TRACKING MODE: Show tracking products count, hide candidates
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>
                                Tracking products:{" "}
                                <Badge variant="outline" className="ml-1 text-xs font-medium">
                                  {competitor.matchCount}
                                </Badge>
                              </span>
                            </div>
                          ) : (
                            // REVIEW MODE: Show confirmed matches (0) and candidates
                            <>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>
                                  Confirmed matches:{" "}
                                  <Badge variant="outline" className="ml-1 text-xs font-medium">
                                    {competitor.matchCount}
                                  </Badge>
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>
                                  Candidates:{" "}
                                  <Badge variant="outline" className="ml-1 text-xs font-medium">
                                    {competitor.candidateCount ?? 0}
                                  </Badge>
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Candidates are shown in Review Matches until you confirm.
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {(competitor.status === "pending" || competitor.status === "processing" || competitor.status === "active") && (
                        <Link
                          href={`/app/competitors/${competitor.id}/matches`}
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 text-xs"
                        >
                          <ExternalLink className="mr-2 h-3 w-3" />
                          {competitor.matchCount > 0 
                            ? "Products" 
                            : (competitor.status === "pending" || competitor.status === "processing") 
                              ? "Review Matches" 
                              : "Matches"}
                        </Link>
                      )}
                      {(competitor.status === "pending" || competitor.status === "processing") && (
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                          <Loader2 className="h-3 w-3 mr-1 inline animate-spin" />
                          Processing...
                        </Badge>
                      )}
                      <DeleteCompetitorButton
                        competitorId={competitor.id}
                        competitorName={competitor.name}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Added by URL - Virtual Card */}
      {urlCount > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                  <Globe className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Added by URL</p>
                  <p className="text-sm text-muted-foreground">
                    Competitors added via product URLs (doesn&apos;t count toward store limit)
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {urlCount} URL{urlCount === 1 ? "" : "s"} added
                  </p>
                </div>
              </div>
              <Link
                href="/app/competitors/added-by-url"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Details
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
