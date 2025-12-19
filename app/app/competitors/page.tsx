import { getProfile } from "@/lib/getProfile";
import { getMatchCountForCompetitor } from "@/lib/competitors";
import { getOrCreateStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, ExternalLink, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CompetitorsClient } from "@/components/competitors/competitors-client";
import { DeleteCompetitorButton } from "@/components/competitors/delete-competitor-button";
import { getCompetitorLimit } from "@/lib/planLimits";
import {
  getOrCreateStoreSyncSettings,
  computeNextSyncDate,
  formatNextSyncDistance,
  formatTimeHM,
} from "@/lib/competitors/syncSettings";

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

export default async function CompetitorsPage() {
  const { user, profile } = await getProfile();

  if (!user) {
    redirect("/login");
  }

  const isDemo = profile?.plan === "free_demo";

  // Get or create store (automatically creates one if none exists)
  const store = await getOrCreateStore();

  // Create Supabase client for server-side queries
  const supabase = await createClient();

  // Get plan and competitor limit
  const plan = (profile?.plan as string) ?? "STARTER";
  const limit = getCompetitorLimit(plan);

  // Load tracked competitors (counts toward limit)
  const { data: trackedCompetitors = [], error: trackedError } = await supabase
    .from("competitors")
    .select("id, name, url, created_at, source, is_tracked, domain")
    .eq("store_id", store.id)
    .eq("is_tracked", true)
    .order("created_at", { ascending: true });

  // Count URL-added competitor products (URLs) - doesn't count toward limit
  // Step 1: Get competitor IDs where is_tracked=false
  const { data: urlCompetitors, error: urlCompetitorsError } = await supabase
    .from("competitors")
    .select("id")
    .eq("store_id", store.id)
    .eq("is_tracked", false);

  let urlCount = 0;
  if (urlCompetitorsError) {
    console.error("Error loading URL competitors:", urlCompetitorsError);
  } else if (urlCompetitors && urlCompetitors.length > 0) {
    // Step 2: Count competitor_products for these competitors
    const competitorIds = urlCompetitors.map((c) => c.id);
    const { count: urlProductsCount, error: urlProductsError } = await supabase
      .from("competitor_products")
      .select("*", { count: "exact", head: true })
      .in("competitor_id", competitorIds);

    if (urlProductsError) {
      console.error("Error counting URL competitor products:", urlProductsError);
    } else {
      urlCount = urlProductsCount || 0;
    }
  }

  // Only count tracked competitors toward limit
  const used = trackedCompetitors?.length ?? 0;

  if (trackedError) {
    console.error("Error loading tracked competitors:", trackedError);
  }

  // Get match counts for tracked competitors
  const trackedWithMatches = await Promise.all(
    trackedCompetitors.map(async (competitor) => {
      const matchCount = await getMatchCountForCompetitor(competitor.id);
      return {
        ...competitor,
        matchCount,
      };
    })
  );

  // LAST SYNC – max(last_sync_at) from tracked competitors only
  const { data: lastSyncRow } = await supabase
    .from("competitors")
    .select("last_sync_at")
    .eq("store_id", store.id)
    .eq("is_tracked", true)
    .order("last_sync_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastSyncAt = lastSyncRow?.last_sync_at
    ? new Date(lastSyncRow.last_sync_at as string)
    : null;

  // SYNC SETTINGS + NEXT SYNC
  const now = new Date();
  let settings;
  let nextSyncDate: Date | null = null;
  let nextSyncText = "not scheduled";
  let nextSyncTimeLabel: string | null = null;
  
  try {
    settings = await getOrCreateStoreSyncSettings(store.id, user.id);
    nextSyncDate = computeNextSyncDate(settings, now);
    nextSyncText = formatNextSyncDistance(nextSyncDate, now);
    nextSyncTimeLabel = nextSyncDate ? formatTimeHM(nextSyncDate) : null;
  } catch (error) {
    console.warn("Failed to load sync settings, using defaults:", error);
    // Use defaults if sync settings fail to load
    settings = {
      store_id: store.id,
      timezone: "Europe/Prague",
      daily_sync_times: ["06:00"],
    };
    nextSyncDate = computeNextSyncDate(settings, now);
    nextSyncText = formatNextSyncDistance(nextSyncDate, now);
    nextSyncTimeLabel = nextSyncDate ? formatTimeHM(nextSyncDate) : null;
  }

  // Format "Today, 12:34" for Last sync
  let lastSyncLabel = "Never";
  if (lastSyncAt) {
    const isToday = lastSyncAt.toDateString() === now.toDateString();
    const hh = String(lastSyncAt.getHours()).padStart(2, "0");
    const mm = String(lastSyncAt.getMinutes()).padStart(2, "0");
    lastSyncLabel = isToday
      ? `Today, ${hh}:${mm}`
      : `${lastSyncAt.toLocaleDateString()} ${hh}:${mm}`;
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

      {/* Global Sync Box */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-medium">Sync competitor prices</h3>
              <p className="text-xs text-muted-foreground">
                Sync runs automatically based on your plan.
              </p>
              <Link
                href="/app/settings"
                className="inline-flex items-center text-xs text-primary hover:underline mt-1"
              >
                Set up your sync
              </Link>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground">
                  Tracked stores: {trackedWithMatches.length}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Last sync: {lastSyncLabel}</span>
                  {nextSyncDate && (
                    <span>
                      Next sync: {nextSyncText}
                      {nextSyncTimeLabel && ` (at ${nextSyncTimeLabel})`}
                    </span>
                  )}
                  {lastSyncAt && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-2 py-0.5",
                        "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800"
                      )}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                      Synced
                    </Badge>
                  )}
                </div>
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
              <p>No tracked competitor stores added yet. Click "Add competitor" to get started.</p>
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
                        <p className="font-semibold text-foreground truncate">{competitor.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{competitor.url}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>
                            Matched products:{" "}
                            <Badge variant="outline" className="ml-1 text-xs font-medium">
                              {competitor.matchCount}
                            </Badge>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <Link
                        href={`/app/competitors/${competitor.id}`}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 text-xs"
                      >
                        <ExternalLink className="mr-2 h-3 w-3" />
                        Matches
                      </Link>
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
