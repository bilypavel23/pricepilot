"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

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
  storeId?: string;
};

const NONE_VALUE = "__none__";

export function MatchesReviewClient({
  competitorId,
  competitorName,
  competitorStatus,
  errorMessage,
  groupedMatches: initialGroupedMatches,
  myProducts: initialMyProducts,
  storeId: propStoreId,
}: MatchesReviewClientProps) {
  const router = useRouter();
  const supabase = createClient();
  
  // State for polling and data refresh
  const [groupedMatches, setGroupedMatches] = useState(initialGroupedMatches);
  const [myProducts, setMyProducts] = useState(initialMyProducts);
  const [isProcessing, setIsProcessing] = useState(competitorStatus === "processing");
  const [currentStatus, setCurrentStatus] = useState(competitorStatus);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingStartTimeRef = useRef<number | null>(null);
  const [storeId, setStoreId] = useState<string | null>(propStoreId || null);
  
  // Store selection as STRING (competitor_product_id or NONE_VALUE), NOT null
  // Key: product_id (my product) -> Value: competitor_product_id or NONE_VALUE
  type SelectionMap = Record<string, string>; // key: product_id -> value: competitor_product_id or NONE_VALUE
  const [selectedByProduct, setSelectedByProduct] = useState<SelectionMap>(() => {
    const initial: SelectionMap = {};
    initialGroupedMatches.forEach((group) => {
      // Initialize default selection: highest similarity candidate if available, else NONE_VALUE
      if (group.product_id) {
        if (group.candidates.length > 0 && group.candidates[0]?.competitor_product_id) {
          initial[group.product_id] = group.candidates[0].competitor_product_id;
        } else {
          initial[group.product_id] = NONE_VALUE;
        }
      }
    });
    return initial;
  });
  const [loading, setLoading] = useState(false);
  
  // Get store_id on mount - use prop if provided, otherwise fetch
  useEffect(() => {
    if (propStoreId) {
      setStoreId(propStoreId);
      return;
    }
    
    const fetchStoreId = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        // Get store_id from competitor record
        const { data: competitor } = await supabase
          .from("competitors")
          .select("store_id")
          .eq("id", competitorId)
          .single();
        
        if (competitor?.store_id) {
          setStoreId(competitor.store_id);
        } else {
          // Fallback: get store_id from user's stores
          const { data: stores } = await supabase
            .from("stores")
            .select("id")
            .eq("owner_id", user.id)
            .limit(1)
            .single();
          
          if (stores) {
            setStoreId(stores.id);
          }
        }
      } catch (err) {
        console.error("[matches-review] Error fetching store_id:", err);
      }
    };
    
    fetchStoreId();
  }, [supabase, competitorId, propStoreId]);
  
  // Normalize RPC row data (same logic as server)
  const normalizeRow = (r: any) => {
    const score =
      r.similarity_score ??
      r.match_score ??
      r.similarity ??
      r.score ??
      0;

    const competitorPrice =
      r.competitor_price ??
      r.last_price ??
      r.price ??
      null;

    return {
      competitorProductId: r.competitor_product_id ?? r.id,
      competitorId: r.competitor_id ?? r.competitorId,
      competitorName: r.competitor_name ?? r.competitorName ?? r.name ?? "",
      competitorUrl: r.competitor_url ?? r.competitorUrl ?? r.url ?? "",
      competitorPrice,
      currency: r.currency ?? r.competitor_currency ?? "USD",

      suggestedProductId: r.suggested_product_id ?? r.suggestedProductId ?? null,
      similarityScore: Number(score) || 0,

      storeProductId: r.store_product_id ?? r.storeProductId ?? null,
      storeProductName: r.store_product_name ?? r.storeProductName ?? "",
      storeProductSku: r.store_product_sku ?? r.storeProductSku ?? "",
      storeProductPrice: r.store_product_price ?? r.storeProductPrice ?? null,
    };
  };

  // Transform match candidates to grouped format (same logic as server)
  const transformCandidatesToGrouped = (matchCandidates: any[]): GroupedMatch[] => {
    const rows = (Array.isArray(matchCandidates) ? matchCandidates : []).map(normalizeRow);

    // Group by suggested_product_id (my product)
    const productGroups = new Map<string, {
      product_id: string;
      product_name: string;
      product_sku: string | null;
      product_price: number | null;
      options: Array<{
        competitor_product_id: string;
        competitor_product_name: string;
        competitor_product_url: string;
        competitor_price: number | null;
        currency: string;
        similarity_score: number;
      }>;
    }>();

    rows.forEach((row) => {
      const productId = row.suggestedProductId || row.storeProductId || `__candidate_${row.competitorProductId}__`;

      if (!productGroups.has(productId)) {
        productGroups.set(productId, {
          product_id: row.suggestedProductId || row.storeProductId || row.competitorProductId,
          product_name: row.storeProductName || "",
          product_sku: row.storeProductSku || null,
          product_price: row.storeProductPrice ?? null,
          options: [],
        });
      }

      const group = productGroups.get(productId)!;
      group.options.push({
        competitor_product_id: row.competitorProductId || "",
        competitor_product_name: row.competitorName || "",
        competitor_product_url: row.competitorUrl || "",
        competitor_price: row.competitorPrice ?? null,
        currency: row.currency || "USD",
        similarity_score: row.similarityScore || 0,
      });
    });

    // Convert to array and sort options by similarity_score descending
    return Array.from(productGroups.values()).map((group) => ({
      product_id: group.product_id,
      product_name: group.product_name,
      product_sku: group.product_sku,
      product_price: group.product_price,
      candidates: group.options.sort((a, b) => b.similarity_score - a.similarity_score).map((opt) => ({
        candidate_id: opt.competitor_product_id,
        competitor_product_id: opt.competitor_product_id,
        competitor_url: opt.competitor_product_url,
        competitor_name: opt.competitor_product_name,
        competitor_last_price: opt.competitor_price,
        competitor_currency: opt.currency,
        similarity_score: opt.similarity_score,
      })),
    }));
  };

  // Load matches and products from client (no server cache)
  const loadMatchesAndProducts = async () => {
    if (!storeId) return { matches: null, products: null, status: null };
    
    try {
      // Check competitor status
      const { data: competitor, error: statusError } = await supabase
        .from("competitors")
        .select("status")
        .eq("id", competitorId)
        .single();
      
      if (statusError) {
        console.error("[matches-review] Error loading competitor status:", statusError);
      }
      
      const status = competitor?.status || null;
      if (competitor && status) {
        setCurrentStatus(status);
        setIsProcessing(status === "processing");
      }
      
      // Load products
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, name, sku, price")
        .eq("store_id", storeId)
        .eq("is_demo", false)
        .order("name");
      
      if (productsError) {
        console.error("[matches-review] Error loading products:", productsError);
      }
      
      const products = productsData || [];
      setMyProducts(products);
      
      // Call RPC to get match candidates (no cache)
      const { data: matchCandidates, error: candidatesError } = await supabase.rpc(
        "get_competitor_products_for_store_matches",
        {
          _store_id: storeId,
          _competitor_id: competitorId,
        }
      );
      
      if (candidatesError) {
        console.error("[matches-review] Error loading candidates:", candidatesError);
        return { matches: null, products, status };
      }
      
      // Transform candidates
      const transformed = matchCandidates && matchCandidates.length > 0
        ? transformCandidatesToGrouped(matchCandidates)
        : [];
      
      setGroupedMatches(transformed);
      
      // Initialize selections for new matches
      if (transformed.length > 0) {
        setSelectedByProduct(prev => {
          const updated = { ...prev };
          transformed.forEach((group) => {
            if (group.product_id && !updated[group.product_id]) {
              if (group.candidates.length > 0 && group.candidates[0]?.competitor_product_id) {
                updated[group.product_id] = group.candidates[0].competitor_product_id;
              } else {
                updated[group.product_id] = NONE_VALUE;
              }
            }
          });
          return updated;
        });
      }
      
      // If we have candidates, stop processing
      if (transformed.length > 0) {
        setIsProcessing(false);
      }
      
      return { matches: transformed, products, status };
    } catch (err) {
      console.error("[matches-review] Error loading data:", err);
      return { matches: null, products: null, status: null };
    }
  };
  
  // Load data on mount and when storeId changes (client-side, no cache)
  useEffect(() => {
    if (!storeId) return;
    
    // Load data immediately
    loadMatchesAndProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, competitorId]);
  
  // Polling: Start when status is 'processing' OR when no matches found
  useEffect(() => {
    if (!storeId) return;
    
    // Determine if we should poll
    const shouldPoll = isProcessing || currentStatus === "processing" || 
      (groupedMatches.length === 0 && currentStatus !== "error" && currentStatus !== "failed");
    
    if (!shouldPoll) {
      // Stop polling if not needed
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
      pollingStartTimeRef.current = null;
      return;
    }
    
    // Don't start if already polling
    if (pollingTimeoutRef.current) {
      return;
    }
    
    console.log("[matches-review] Starting polling for competitor_id=", competitorId, "isProcessing:", isProcessing, "status:", currentStatus);
    
    let cancelled = false;
    let timeoutId: NodeJS.Timeout | null = null;
    const POLL_INTERVAL = 2000; // 2 seconds
    const MAX_POLL_TIME = 90000; // 90 seconds
    
    // Record start time
    if (!pollingStartTimeRef.current) {
      pollingStartTimeRef.current = Date.now();
    }
    
    const poll = async () => {
      if (cancelled) return;
      
      // Check timeout (90 seconds)
      const elapsed = pollingStartTimeRef.current 
        ? Date.now() - pollingStartTimeRef.current 
        : 0;
      
      if (elapsed >= MAX_POLL_TIME) {
        console.log("[matches-review] Polling timeout after 90 seconds");
        setIsProcessing(false);
        pollingTimeoutRef.current = null;
        pollingStartTimeRef.current = null;
        return;
      }
      
      // Load matches and check status
      const result = await loadMatchesAndProducts();
      
      if (cancelled) return;
      
      // Stop polling if:
      // 1. We have matches
      // 2. Status is 'ready' (scanning complete)
      // 3. Status is 'error' or 'failed'
      const shouldStop = 
        (result.matches && result.matches.length > 0) ||
        result.status === "ready" ||
        result.status === "error" ||
        result.status === "failed";
      
      if (shouldStop) {
        console.log("[matches-review] Stopping polling - matches:", result.matches?.length || 0, "status:", result.status);
        pollingTimeoutRef.current = null;
        pollingStartTimeRef.current = null;
        return;
      }
      
      // Continue polling if still processing (use result.status, not closure variable)
      if (!cancelled && storeId && result.status === "processing") {
        timeoutId = setTimeout(poll, POLL_INTERVAL);
        pollingTimeoutRef.current = timeoutId;
      } else {
        pollingTimeoutRef.current = null;
        pollingStartTimeRef.current = null;
      }
    };
    
    // Start polling immediately
    poll();
    
    // Cleanup on unmount or when dependencies change
    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
      pollingStartTimeRef.current = null;
    };
  }, [isProcessing, storeId, competitorId, currentStatus, groupedMatches.length]);
  
  // Update isProcessing when status changes
  useEffect(() => {
    setIsProcessing(currentStatus === "processing");
  }, [currentStatus]);

  // Filter products that have selections (excluding NONE_VALUE)
  const matchedProducts = useMemo(() => {
    return groupedMatches.filter((group) => {
      const selectedId = selectedByProduct[group.product_id];
      return selectedId && selectedId !== NONE_VALUE;
    });
  }, [groupedMatches, selectedByProduct]);


  const handleConfirmMatches = async () => {
    if (matchedProducts.length === 0) {
      return;
    }

    if (!storeId) {
      alert("Store ID is missing. Please refresh the page.");
      return;
    }

    setLoading(true);
    try {
      // UUID regex for validation
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      // Build list of selected competitor_product_ids
      const selectedCompetitorProductIds: string[] = [];
      groupedMatches.forEach((group) => {
        const selectedCompetitorProductId = selectedByProduct[group.product_id];
        if (selectedCompetitorProductId && selectedCompetitorProductId !== NONE_VALUE) {
          const selectedCandidate = group.candidates.find(
            c => c.competitor_product_id === selectedCompetitorProductId
          );
          if (selectedCandidate && UUID_REGEX.test(selectedCandidate.competitor_product_id)) {
            selectedCompetitorProductIds.push(selectedCandidate.competitor_product_id);
          }
        }
      });

      if (selectedCompetitorProductIds.length === 0) {
        alert("Please select at least one match to confirm.");
        setLoading(false);
        return;
      }

      // Load competitor_match_candidates.id for selected competitor_product_ids
      const { data: candidateRows, error: candidateError } = await supabase
        .from("competitor_match_candidates")
        .select("id, competitor_product_id")
        .eq("store_id", storeId)
        .eq("competitor_id", competitorId)
        .in("competitor_product_id", selectedCompetitorProductIds);

      if (candidateError) {
        throw new Error(`Failed to load candidate IDs: ${candidateError.message}`);
      }

      if (!candidateRows || candidateRows.length === 0) {
        throw new Error("No matching candidates found. Please refresh the page.");
      }

      // Extract competitor_match_candidates.id values
      const selectedCandidateIds = candidateRows.map((row: any) => row.id).filter((id: any) => UUID_REGEX.test(id));

      if (selectedCandidateIds.length === 0) {
        throw new Error("No valid candidate IDs found. Please refresh the page.");
      }

      // Call RPC to confirm matches and cleanup
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "confirm_competitor_matches_and_cleanup",
        {
          _store_id: storeId,
          _competitor_id: competitorId,
          _confirmed_candidate_ids: selectedCandidateIds,
        }
      );

      if (rpcError) {
        throw new Error(rpcError.message || "Failed to confirm matches");
      }

      // Show success toast
      alert(`Matches confirmed`);
      
      // Navigate to competitors page
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
          {isProcessing && (
            <div className="flex items-center gap-2 mt-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <p className="text-xs text-blue-600 dark:text-blue-400">
                Processing... Scanning competitor store for products. This may take a few moments.
              </p>
            </div>
          )}
          {currentStatus === "needs_review" && !isProcessing && (
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
          {isProcessing || currentStatus === "processing" ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-muted-foreground">
                Scanning competitor store for products...
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Matches will appear here once scanning is complete.
              </p>
            </div>
          ) : myProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No products found. Add products first to create matches.</p>
            </div>
          ) : groupedMatches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No matches found. The competitor store may not have overlapping products.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedMatches.map((group) => {
                const myProduct = myProducts.find((p) => p.id === group.product_id);

                if (!myProduct) {
                  return null; // Skip if my product not found
                }

                // Get selected competitor product ID from state
                const selectedCompetitorProductId = selectedByProduct[group.product_id];
                // Get suggested competitor product ID (highest similarity) - only used as initial default
                const suggestedCompetitorProductId = group.candidates?.[0]?.competitor_product_id ?? null;
                
                // Compute current Select value - use selected if exists, otherwise suggested, otherwise NONE_VALUE
                // IMPORTANT: Only use suggested as INITIAL default (when no entry exists in the map)
                // Remove ANY fallback like: selectedId ?? suggestedId after user interaction
                const currentValue = selectedCompetitorProductId
                  ?? (suggestedCompetitorProductId ? suggestedCompetitorProductId : NONE_VALUE);
                
                // Find the selected candidate (treat NONE_VALUE as skipped)
                const selectedCandidate = (currentValue && currentValue !== NONE_VALUE)
                  ? group.candidates.find(c => c.competitor_product_id === currentValue) ?? null
                  : null;
                
                // Resolve current label from options list by id
                const currentSelectedLabel = currentValue === NONE_VALUE
                  ? "None (skip)"
                  : selectedCandidate
                    ? `${selectedCandidate.competitor_name} (${selectedCandidate.similarity_score.toFixed(0)}%)`
                    : "Select competitor product...";
                
                // Handle change handler - store as string (NONE_VALUE or competitor_product_id)
                const handleChange = (v: string) => {
                  setSelectedByProduct(prev => ({
                    ...prev,
                    [group.product_id]: v,
                  }));
                };

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
                        {/* Top row: Competitor name on left, badge on right - hide when NONE */}
                        {currentValue !== NONE_VALUE ? (
                          <>
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
                          </>
                        ) : (
                          <>
                            {/* When NONE: Show "Skipped" badge */}
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm text-muted-foreground flex-1 min-w-0">
                                Skipped
                              </p>
                              <Badge variant="outline" className="text-xs flex-shrink-0">
                                Skipped
                              </Badge>
                            </div>
                            {/* View competitor product button - disabled when NONE */}
                            <Button
                              variant="outline"
                              size="sm"
                              disabled
                              className="w-full"
                            >
                              View competitor product
                            </Button>
                          </>
                        )}

                        {/* Dropdown */}
                        <Select
                          value={currentValue}
                          onValueChange={handleChange}
                        >
                          <SelectTrigger className="w-full">
                            <span className="truncate">
                              {currentValue === NONE_VALUE ? "None (skip)" : currentSelectedLabel}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE_VALUE}>None (skip)</SelectItem>
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
