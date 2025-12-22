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

type Candidate = {
  candidate_id: string;
  competitor_product_id: string;
  competitor_url: string;
  competitor_name: string;
  competitor_last_price: number | null;
  competitor_currency: string;
  similarity_score: number;
};

type GroupedMatch = {
  product_id: string;
  product_name: string;
  product_sku: string | null;
  product_price: number | null;
  candidates: Candidate[];
};

type MatchesReviewClientProps = {
  competitorId: string;
  competitorName: string;
  competitorStatus?: string;
  errorMessage?: string | null;
  groupedMatches: GroupedMatch[];
  myProducts: MyProduct[];
};

export function MatchesReviewClient({
  competitorId,
  competitorName,
  competitorStatus,
  errorMessage,
  groupedMatches,
  myProducts,
}: MatchesReviewClientProps) {
  const router = useRouter();
  
  // Candidates are already sorted by similarity_score descending from the server
  // Initialize state with best candidate (highest similarity) as default
  const [selectedByProduct, setSelectedByProduct] = useState<Record<string, string | null>>(() => {
    const initial: Record<string, string | null> = {};
    groupedMatches.forEach((group) => {
      // Initialize default selection: highest similarity candidate if available, else null
      if (group.product_id) {
        if (group.candidates.length > 0 && group.candidates[0]?.competitor_product_id) {
          initial[group.product_id] = group.candidates[0].competitor_product_id;
        } else {
          initial[group.product_id] = null;
        }
      }
    });
    return initial;
  });
  const [loading, setLoading] = useState(false);

  // Filter products that have selections (excluding null/__none__)
  const matchedProducts = useMemo(() => {
    return groupedMatches.filter((group) => {
      const selectedId = selectedByProduct[group.product_id];
      return selectedId && selectedId !== "__none__" && selectedId !== null;
    });
  }, [groupedMatches, selectedByProduct]);


  const handleConfirmMatches = async () => {
    if (matchedProducts.length === 0) {
      return;
    }

    setLoading(true);
    try {
      // Build matches payload - only include rows where selectedId is not null/__none__
      const matches = groupedMatches
        .map((group) => {
          const selectedId = selectedByProduct[group.product_id];
          if (selectedId && selectedId !== "__none__" && selectedId !== null) {
            return {
              product_id: group.product_id,
              competitor_product_id: selectedId,
            };
          }
          return null;
        })
        .filter((m): m is { product_id: string; competitor_product_id: string } => m !== null);

      if (matches.length === 0) {
        alert("Please select at least one match to confirm.");
        setLoading(false);
        return;
      }

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
              {groupedMatches.map((group) => {
                const myProduct = myProducts.find((p) => p.id === group.product_id);

                if (!myProduct) {
                  return null; // Skip if my product not found
                }

                // Get selected ID for this product (default to highest similarity if not set)
                const selectedId = selectedByProduct[group.product_id] ?? 
                  (group.candidates?.[0]?.competitor_product_id ?? null);
                
                // Find the selected candidate
                const selectedCandidate = (selectedId && selectedId !== "__none__" && selectedId !== null)
                  ? group.candidates.find(c => c.competitor_product_id === selectedId) ?? null
                  : null;

                return (
                  <div
                    key={group.product_id}
                    className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    {/* Left: My Product (fixed) */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Label className="font-medium">{group.product_name || myProduct.name}</Label>
                        {(group.product_sku || myProduct.sku) && (
                          <Badge variant="outline" className="text-xs">
                            SKU: {group.product_sku || myProduct.sku}
                          </Badge>
                        )}
                      </div>
                      {(group.product_price !== null || myProduct.price) && (
                        <p className="text-sm text-muted-foreground">
                          ${(group.product_price ?? myProduct.price ?? 0).toFixed(2)}
                        </p>
                      )}
                    </div>

                    {/* Right: Competitor Product (with similarity badge) */}
                    <div className="w-80 flex-shrink-0">
                      <div className="flex flex-col gap-2">
                        {/* Top row: Competitor name on left, badge on right */}
                        <div className="flex items-center justify-between gap-2">
                          {selectedCandidate ? (
                            <p className="text-sm font-medium truncate flex-1 min-w-0">
                              {selectedCandidate.competitor_name}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground flex-1 min-w-0">
                              No competitor selected
                            </p>
                          )}
                          {selectedCandidate ? (
                            <Badge
                              variant={getScoreBadgeVariant(selectedCandidate.similarity_score)}
                              className="text-xs flex-shrink-0"
                            >
                              {selectedCandidate.similarity_score.toFixed(0)}% match
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs flex-shrink-0">
                              Skipped
                            </Badge>
                          )}
                        </div>

                        {/* View competitor product button */}
                        {selectedCandidate?.competitor_url ? (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="w-full"
                          >
                            <a
                              href={selectedCandidate.competitor_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View competitor product
                            </a>
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled
                            className="w-full"
                          >
                            View competitor product
                          </Button>
                        )}

                        {/* Dropdown */}
                        <Select
                          value={selectedId && selectedId !== "__none__" && selectedId !== null ? selectedId : undefined}
                          onValueChange={(value) => {
                            setSelectedByProduct(prev => {
                              if (value === "__none__") {
                                return { ...prev, [group.product_id]: null };
                              }
                              return { ...prev, [group.product_id]: value };
                            });
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select competitor product..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None (skip)</SelectItem>
                            {group.candidates.map((candidate) => {
                              const candidateId = candidate.competitor_product_id ? String(candidate.competitor_product_id) : null;
                              if (!candidateId) return null;
                              return (
                                <SelectItem key={candidate.candidate_id || candidate.competitor_product_id} value={candidateId}>
                                  {candidate.competitor_name} ({candidate.similarity_score.toFixed(0)}%)
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })}
              {groupedMatches.length === 0 && (
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
