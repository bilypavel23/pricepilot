import { getProfile } from "@/lib/getProfile";
import { getOrCreateStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { MatchActions } from "@/components/competitors/match-actions";
import { AutoMatchButton } from "@/components/competitors/auto-match-button";
import { ManualMatchForm } from "@/components/competitors/manual-match-form";

type MatchProduct = { 
  id: string; 
  name: string; 
  sku: string | null; 
  price: number | null;
};

type MatchCompetitorProduct = { 
  id: string; 
  name: string; 
  sku: string | null; 
  price: number | null;
};

type Match = {
  id: string;
  match_score: number | null;
  status: string | null;
  products: MatchProduct[]; // array
  competitor_products: MatchCompetitorProduct[]; // array
};

export default async function CompetitorMatchesPage({
  params,
}: {
  params: Promise<{ competitorId: string }>;
}) {
  const { competitorId } = await params;
  const { user } = await getProfile();

  if (!user) {
    redirect("/login");
  }

  // Get or create store (automatically creates one if none exists)
  const store = await getOrCreateStore();

  // Create Supabase client
  const supabase = await createClient();

  // Get competitor store
  const { data: competitor, error: competitorError } = await supabase
    .from("competitors")
    .select("id, name, url")
    .eq("id", competitorId)
    .eq("store_id", store.id)
    .single();

  if (competitorError || !competitor) {
    return (
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-10 lg:py-12">
        <div className="text-center py-12 text-muted-foreground">
          <p>Competitor not found.</p>
          <Link href="/app/competitors" className="text-blue-500 hover:underline mt-2 inline-block">
            Back to Competitors
          </Link>
        </div>
      </div>
    );
  }

  // Get all competitor_products for this competitor
  const { data: competitorProducts } = await supabase
    .from("competitor_products")
    .select("id, name, sku, price")
    .eq("competitor_id", competitorId);

  const competitorProductsSafe = competitorProducts ?? [];

  // If no competitor products exist, show empty state
  if (competitorProductsSafe.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-10 lg:py-12 space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/app/competitors"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Product Matches</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {competitor.name}
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>No products found yet.</p>
            <p className="text-sm mt-2">
              This competitor store has no products. Products will appear here once they are scraped or imported.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get all my products for the store
  const { data: myProducts } = await supabase
    .from("products")
    .select("id, name, sku, price")
    .eq("store_id", store.id)
    .eq("is_demo", false);

  const myProductsSafe = myProducts ?? [];

  const competitorProductIds = competitorProductsSafe.map((cp) => cp.id);

  // Get all product_matches for this store + competitor
  const { data: matches, error: matchesError } = await supabase
    .from("product_matches")
    .select(`
      id,
      match_score,
      status,
      products:product_id (
        id,
        name,
        sku,
        price
      ),
      competitor_products:competitor_product_id (
        id,
        name,
        sku,
        price
      )
    `)
    .eq("store_id", store.id)
    .in("competitor_product_id", competitorProductIds.length > 0 ? competitorProductIds : [""])
    .order("created_at", { ascending: false });

  const matchesSafe = matches ?? [];

  if (matchesError) {
    console.error("Error loading matches:", matchesError);
  }

  const getStatusBadge = (status: string | null) => {
    const variants: Record<string, string> = {
      auto_matched: "bg-emerald-500/20 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
      pending: "bg-amber-500/20 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
      confirmed: "bg-blue-500/20 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      rejected: "bg-slate-500/20 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300",
    };

    const labels: Record<string, string> = {
      auto_matched: "Auto-matched",
      pending: "Needs review",
      confirmed: "Confirmed",
      rejected: "Rejected",
    };

    const statusKey = (status || "pending").toLowerCase();
    return (
      <Badge
        variant="outline"
        className={cn("text-xs font-medium", variants[statusKey] || variants.pending)}
      >
        {labels[statusKey] || status || "Pending"}
      </Badge>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-8 py-10 lg:py-12 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/app/competitors"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Product Matches</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {competitor.name} • {matchesSafe.length} matches
          </p>
        </div>
      </div>

      {/* Auto-match Button */}
      <div className="flex justify-end">
        <AutoMatchButton
          competitorId={competitorId}
          onSuccess={(count) => {
            // Toast will be shown via alert for now
            if (count > 0) {
              alert(`Auto-matched ${count} products`);
            }
          }}
        />
      </div>

      {/* Matches List */}
      {matchesSafe.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>No products found yet.</p>
            <p className="text-sm mt-2">
              No matches have been created yet. Use "Auto-match by name" or create matches manually below.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {matchesSafe.map((match) => {
            const product = match.products?.[0] ?? null;
            const competitorProduct = match.competitor_products?.[0] ?? null;

            if (!product || !competitorProduct) {
              return null;
            }

            const matchScore = match.match_score ?? 0;
            const matchStatus = match.status ?? "pending";

            return (
              <Card key={match.id} className="p-6">
                <div className="space-y-6">
                  {/* Match Score */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Match Score</span>
                      <span className="font-medium">{matchScore}%</span>
                    </div>
                    <Progress value={matchScore} className="h-2" />
                  </div>

                  {/* Products Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Your Product */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-muted-foreground">YOUR PRODUCT</h3>
                      <div className="space-y-1">
                        <p className="font-semibold">{product.name || "Unknown"}</p>
                        <p className="text-sm text-muted-foreground">SKU: {product.sku || "-"}</p>
                        <p className="text-lg font-semibold">
                          {product.price != null ? `$${product.price.toFixed(2)}` : "-"}
                        </p>
                      </div>
                    </div>

                    {/* Competitor Product */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-muted-foreground">SUGGESTED COMPETITOR PRODUCT</h3>
                      <div className="space-y-1">
                        <p className="font-semibold">{competitorProduct.name || "Unknown"}</p>
                        <p className="text-sm text-muted-foreground">SKU: {competitorProduct.sku || "-"}</p>
                        <p className="text-lg font-semibold">
                          {competitorProduct.price != null ? `$${competitorProduct.price.toFixed(2)}` : "-"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Status and Actions */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div>{getStatusBadge(matchStatus)}</div>
                    <MatchActions
                      matchId={match.id}
                      status={matchStatus}
                      competitorProducts={competitorProductsSafe}
                      onStatusChange={() => {
                        // This will be handled by client component refresh
                      }}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Manual Match Form */}
      <ManualMatchForm
        myProducts={myProductsSafe.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku || "",
        }))}
        competitorProducts={competitorProductsSafe.map((cp) => ({
          id: cp.id,
          name: cp.name,
          sku: cp.sku || null,
        }))}
        onSuccess={() => {
          alert("Match created");
        }}
      />
    </div>
  );
}

