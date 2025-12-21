"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type MyProduct = {
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
};

type MatchCandidate = {
  candidate_id: string;
  competitor_product_id: string;
  competitor_url: string;
  competitor_name: string;
  competitor_last_price: number | null;
  competitor_currency: string;
  suggested_product_id: string;
  suggested_product_name: string;
  suggested_product_sku: string | null;
  suggested_product_price: number | null;
  similarity_score: number;
};

type MatchesReviewClientProps = {
  competitorId: string;
  competitorName: string;
  competitorStatus?: string;
  errorMessage?: string | null;
  matches: MatchCandidate[];
  myProducts: MyProduct[];
};

export function MatchesReviewClient({
  competitorId,
  competitorName,
  competitorStatus,
  errorMessage,
  matches,
  myProducts,
}: MatchesReviewClientProps) {
  const router = useRouter();
  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    matches.forEach((match) => {
      if (match.similarity_score >= 60 && match.suggested_product_id) {
        initial[match.suggested_product_id] = match.competitor_product_id;
      }
    });
    return initial;
  });
  const [loading, setLoading] = useState(false);

  // Filter products that have selections
  const matchedProducts = useMemo(() => {
    return myProducts.filter((p) => selections[p.id]);
  }, [myProducts, selections]);

  const handleCompetitorSelect = (myProductId: string, competitorProductId: string) => {
    // Handle sentinel value for "None" selection
    if (competitorProductId === "__NONE__") {
      setSelections((prev) => {
        const next = { ...prev };
        delete next[myProductId];
        return next;
      });
    } else if (competitorProductId) {
      setSelections((prev) => ({
        ...prev,
        [myProductId]: competitorProductId,
      }));
    }
  };

  const handleConfirmMatches = async () => {
    if (matchedProducts.length === 0) {
      return;
    }

    setLoading(true);
    try {
      const matches = matchedProducts.map((p) => ({
        product_id: p.id,
        competitor_product_id: selections[p.id],
      }));

      const response = await fetch(`/api/competitors/${competitorId}/matches/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matches,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to confirm matches");
      }

      // Show success toast (simple alert for now)
      alert(`Successfully confirmed ${matches.length} matches!`);
      
      router.push("/app/competitors");
      router.refresh();
    } catch (error: any) {
      alert(`Error: ${error.message || "Failed to confirm matches"}`);
    } finally {
      setLoading(false);
    }
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 90) return "default";
    if (score >= 75) return "secondary";
    if (score >= 60) return "outline";
    return "outline";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "Exact";
    if (score >= 75) return "Strong";
    if (score >= 60) return "Possible";
    return "Low";
  };

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10 lg:py-12 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Review Matches</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {competitorName}
          </p>
          {competitorStatus === "needs_review" && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
              Review and confirm matches to activate this competitor
            </p>
          )}
          {errorMessage && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              {errorMessage}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          onClick={() => router.push("/app/competitors")}
        >
          Back to Competitors
        </Button>
      </div>

      {/* Matches Table */}
      <Card>
        <CardHeader>
          <CardTitle>Product Matches</CardTitle>
          <CardDescription>
            Review and confirm matches between your products and competitor products.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {myProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No products found. Add products first to create matches.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {matches.map((match) => {
                const myProduct = myProducts.find((p) => p.id === match.suggested_product_id);
                const selectedCompetitorId = selections[match.suggested_product_id];

                if (!myProduct) {
                  return null; // Skip if my product not found
                }

                // Ensure competitor_product_id is a valid non-empty string
                const competitorProductId = match.competitor_product_id ? String(match.competitor_product_id) : null;
                if (!competitorProductId) {
                  return null; // Skip if competitor product ID is invalid
                }

                // Select value: use selectedCompetitorId if it exists, otherwise use competitorProductId as default, or undefined to show placeholder
                const selectValue = selectedCompetitorId || competitorProductId || undefined;

                return (
                  <div
                    key={match.candidate_id}
                    className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    {/* Left: My Product (fixed) */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Label className="font-medium">{match.suggested_product_name || myProduct.name}</Label>
                        {(match.suggested_product_sku || myProduct.sku) && (
                          <Badge variant="outline" className="text-xs">
                            SKU: {match.suggested_product_sku || myProduct.sku}
                          </Badge>
                        )}
                      </div>
                      {(match.suggested_product_price !== null || myProduct.price) && (
                        <p className="text-sm text-muted-foreground">
                          ${(match.suggested_product_price ?? myProduct.price ?? 0).toFixed(2)}
                        </p>
                      )}
                    </div>

                    {/* Right: Competitor Product (with similarity badge) */}
                    <div className="w-80 flex-shrink-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant={getScoreBadgeVariant(match.similarity_score)}
                          className="text-xs"
                        >
                          {getScoreLabel(match.similarity_score)} match ({match.similarity_score.toFixed(0)}%)
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium truncate">{match.competitor_name}</p>
                        {match.competitor_last_price !== null && (
                          <p className="text-xs text-muted-foreground">
                            ${match.competitor_last_price.toFixed(2)} {match.competitor_currency || "USD"}
                          </p>
                        )}
                        {match.competitor_url && (
                          <a
                            href={match.competitor_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            View product →
                          </a>
                        )}
                      </div>
                      <Select
                        value={selectValue}
                        onValueChange={(value) => handleCompetitorSelect(match.suggested_product_id, value)}
                        className="mt-2"
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select competitor product..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__NONE__">None (skip)</SelectItem>
                          <SelectItem value={competitorProductId}>
                            {match.competitor_name} (suggested)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
              {matches.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No match candidates found. Discovery scan may still be in progress.</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sticky Bottom Bar */}
      <div className="sticky bottom-0 bg-background border-t p-4 -mx-6 lg:-mx-8 px-6 lg:px-8 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {matchedProducts.length} match{matchedProducts.length !== 1 ? "es" : ""} selected
            </p>
            <p className="text-xs text-muted-foreground">
              Confirm matches to start tracking competitor prices
            </p>
          </div>
          <Button
            onClick={handleConfirmMatches}
            disabled={loading || matchedProducts.length === 0}
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Confirming...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Confirm matches
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
