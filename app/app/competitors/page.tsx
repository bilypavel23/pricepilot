import { getProfile } from "@/lib/getProfile";
import { getMatchCountForCompetitor } from "@/lib/competitors";
import { getOrCreateStore } from "@/lib/store";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, ExternalLink, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CompetitorsClient } from "@/components/competitors/competitors-client";
import { DeleteCompetitorButton } from "@/components/competitors/delete-competitor-button";

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
    redirect("/sign-in");
  }

  const isDemo = profile?.plan === "free_demo";

  // Get or create store (automatically creates one if none exists)
  const store = await getOrCreateStore();

  // Create Supabase client for server-side queries
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );

  // Load competitors for the store
  const { data: competitors = [], error: competitorsError } = await supabase
    .from("competitors")
    .select("id, name, url, created_at")
    .eq("store_id", store.id)
    .order("created_at", { ascending: true });

  console.log("Competitors page - store.id:", store.id);
  console.log("Competitors page - competitors count:", competitors?.length || 0);
  console.log("Competitors page - competitors:", competitors);
  if (competitorsError) {
    console.error("Error loading competitors:", competitorsError);
  }
  
  // Also try loading all competitors for debugging
  const { data: allCompetitors, error: allError } = await supabase
    .from("competitors")
    .select("id, name, url, store_id, created_at")
    .order("created_at", { ascending: true });
  
  console.log("Competitors page - all competitors count:", allCompetitors?.length || 0);
  console.log("Competitors page - all competitors:", allCompetitors);
  if (allError) {
    console.error("Error loading all competitors:", allError);
  }

  // Get match counts for each competitor
  const competitorsWithMatches = await Promise.all(
    competitors.map(async (competitor) => {
      const matchCount = await getMatchCountForCompetitor(competitor.id);
      return {
        ...competitor,
        matchCount,
      };
    })
  );

  // Get last sync time - TODO: get from sync logs
  const lastGlobalSync = "Today, 12:34";

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-8 py-10 lg:py-12 space-y-10">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Competitors</h1>
            <p className="text-sm text-muted-foreground mt-1">Track competitor prices and market positioning</p>
            {/* Last sync status */}
            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
              <span>Last sync: {lastGlobalSync}</span>
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
            </div>
          </div>
          <CompetitorsClient isDemo={isDemo} storeId={store.id} />
        </div>
      </div>

      {/* Global Sync Box */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Sync competitor prices</h3>
              <p className="text-sm text-muted-foreground">
                Sync runs automatically based on your plan.
              </p>
              <div className="flex flex-wrap gap-4 mt-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Tracked stores: </span>
                  <span className="font-medium">{competitorsWithMatches.length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Last global sync: </span>
                  <span className="font-medium">{lastGlobalSync}</span>
                </div>
              </div>
            </div>
            <button
              disabled
              className="px-4 py-2 text-sm text-muted-foreground bg-muted rounded-md cursor-not-allowed whitespace-nowrap"
            >
              Sync runs automatically based on your plan
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Competitor Stores Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Competitor Stores</CardTitle>
          <CardDescription>Manage your tracked competitor stores and review matches.</CardDescription>
        </CardHeader>
        <CardContent>
          {competitorsWithMatches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No competitor stores added yet. Click "Add competitor" to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {competitorsWithMatches.map((competitor) => {
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
    </div>
  );
}
