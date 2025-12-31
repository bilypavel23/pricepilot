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
  competitor_product_id: string; // Can be empty string for store-scraped candidates (matched via competitor_url + candidate_id)
  competitor_url: string;
  competitor_name: string;
  competitor_last_price: number | null;
  competitor_currency: string | null;
  similarity_score: number;
};

type GroupedMatch = {
  product_id: string;
  product_name: string;
  product_sku: string | null;
  product_price: number | null;
  max_similarity_score: number | null;
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
  const pollingTimeoutMessageRef = useRef<boolean>(false);
  const [storeId, setStoreId] = useState<string | null>(propStoreId || null);
  const [errorState, setErrorState] = useState<string | null>(errorMessage || null);
  
  // Store selection as STRING (candidate_id or "none"), NOT null
  // Key: product_id (my product) -> Value: candidate_id or "none"
  // NOTE: We use candidate_id (not competitor_product_id) because competitor_product_id can be null for store-scraped candidates
  const [selectedByProduct, setSelectedByProduct] = useState<Record<string, string>>({});
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
  
  // Transform match candidates to grouped format (same logic as server)
  const transformCandidatesToGrouped = (matchCandidates: any[]): GroupedMatch[] => {
    // Group by product_id (NOT candidate_id)
    const productGroups = new Map<string, {
      product_id: string;
      product_name: string;
      product_sku: string | null;
      product_price: number | null;
      max_similarity_score: number | null;
      candidates: Array<{
        candidate_id: string;
        competitor_product_id: string;
        competitor_url: string;
        competitor_name: string;
        competitor_last_price: number | null;
        competitor_currency: string | null;
        similarity_score: number;
      }>;
    }>();

    // Group by product_id from RPC
    matchCandidates.forEach((row: any) => {
      // Skip rows without product_id (unmatched candidates)
      if (!row.product_id) {
        return;
      }
      
      const productId = String(row.product_id);

      if (!productGroups.has(productId)) {
        productGroups.set(productId, {
          product_id: productId,
          product_name: row.product_name ?? "",
          product_sku: row.product_sku ?? null,
          product_price: row.product_price != null ? Number(row.product_price) : null,
          max_similarity_score: null,
          candidates: [],
        });
      }

      const group = productGroups.get(productId)!;
      
      // Map candidate fields exactly as specified
      const candidate = {
        candidate_id: String(row.candidate_id ?? row.id),
        competitor_product_id: row.competitor_product_id ?? "",
        competitor_url: row.competitor_url ?? "",
        competitor_name: row.competitor_name ?? "",
        competitor_last_price: row.competitor_last_price ?? row.last_price ?? row.competitor_price ?? null,
        competitor_currency: row.competitor_currency ?? row.currency ?? null,
        similarity_score: row.similarity_score != null ? Number(row.similarity_score) : 0,
      };
      
      // Convert price to number if it's a string
      if (candidate.competitor_last_price != null && typeof candidate.competitor_last_price === 'string') {
        candidate.competitor_last_price = Number(candidate.competitor_last_price) || null;
      }
      
      group.candidates.push(candidate);
      
      // Track max similarity_score for this product
      if (candidate.similarity_score != null && candidate.similarity_score > 0) {
        if (group.max_similarity_score == null || candidate.similarity_score > group.max_similarity_score) {
          group.max_similarity_score = candidate.similarity_score;
        }
      }
    });

    // Sort products by max similarity_score DESC, then sort candidates within each product by similarity_score DESC (then price ASC as tiebreaker)
    return Array.from(productGroups.values())
      .map((group) => {
        // Sort candidates by similarity_score DESC, then by price ASC as tiebreaker
        const sortedCandidates = [...group.candidates].sort((a, b) => {
          // First by similarity_score DESC
          const scoreDiff = (b.similarity_score ?? 0) - (a.similarity_score ?? 0);
          if (scoreDiff !== 0) return scoreDiff;
          // Then by price ASC as tiebreaker
          const priceA = a.competitor_last_price ?? Infinity;
          const priceB = b.competitor_last_price ?? Infinity;
          return priceA - priceB;
        });
        
        // Deduplicate by competitor_url (keep first occurrence)
        const seenUrls = new Set<string>();
        const deduplicatedCandidates = sortedCandidates.filter(c => {
          if (!c.competitor_url) return true; // Keep candidates without URL
          if (seenUrls.has(c.competitor_url)) return false;
          seenUrls.add(c.competitor_url);
          return true;
        });
        
        return {
          product_id: group.product_id,
          product_name: group.product_name,
          product_sku: group.product_sku,
          product_price: group.product_price,
          max_similarity_score: group.max_similarity_score,
          candidates: deduplicatedCandidates,
        };
      })
      .sort((a, b) => {
        // Sort products by max similarity_score DESC (nulls last)
        if (a.max_similarity_score === null && b.max_similarity_score === null) return 0;
        if (a.max_similarity_score === null) return 1;
        if (b.max_similarity_score === null) return -1;
        return b.max_similarity_score - a.max_similarity_score;
      });
  };

  // Load matches and products from client (no server cache)
  const loadMatchesAndProducts = async () => {
    if (!storeId || !competitorId) return { matches: null, products: null, status: null };
    
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
        
        // Clear error state if status is not failed/error/blocked
        if (status !== "failed" && status !== "error" && status !== "blocked") {
          setErrorState(null);
        }
        
        // Set error state if status is failed/error (but not blocked, which has its own UI)
        if ((status === "failed" || status === "error") && !errorState) {
          setErrorState("An error occurred during competitor setup. Please try adding the competitor again.");
        }
        
        // Stop processing if status is blocked
        if (status === "blocked") {
          setIsProcessing(false);
        }
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
      // Guard: ensure both storeId and competitorId are present
      if (!storeId || !competitorId) {
        console.error("[matches-review] Missing storeId or competitorId for RPC call");
        return { matches: null, products, status };
      }
      
      const { data: matchCandidates, error: candidatesError } = await supabase.rpc(
        "get_competitor_products_for_store_matches",
        {
          _store_id: storeId,
          _competitor_id: competitorId,
          _min_score: 15, // Default to 15 for better matches, can be adjusted
        }
      );
      
      if (candidatesError) {
        console.error("[matches-review] Error loading candidates:", candidatesError);
        return { matches: null, products, status };
      }
      
      // Ensure matchCandidates is an array (not count or single object)
      const candidatesData = Array.isArray(matchCandidates) ? matchCandidates : [];
      const candidates = candidatesData ?? [];
      
      // Log candidates before transformation
      console.log('[matches-review] candidates length:', candidates.length, 'first:', candidates[0]);
      
      // Transform candidates
      const transformed = candidates.length > 0
        ? transformCandidatesToGrouped(candidates)
        : [];
      
      setGroupedMatches(transformed);
      
      // Initialize selections will be handled by useEffect when groupedMatches changes
      
      // Update status state - do NOT stop processing based on matches count
      // Let status be the source of truth - polling will stop when status changes from 'processing'
      // Only update state if status actually changed
      if (status && status !== currentStatus) {
        setCurrentStatus(status);
        setIsProcessing(status === "processing");
      }
      
      return { matches: transformed, products, status: status || currentStatus };
    } catch (err) {
      console.error("[matches-review] Error loading data:", err);
      return { matches: null, products: null, status: null };
    }
  };
  
  // Function to handle discover API response
  const handleDiscoverResponse = async (response: Response) => {
    try {
      const data = await response.json();
      
      if (!response.ok || !data.ok) {
        // Error response
        setErrorState(data.error || "Failed to start discovery scan");
        setIsProcessing(false);
        setCurrentStatus("failed");
        return;
      }
      
      if (data.status === "empty" || data.discoveredCount === 0 || data.upsertedCount === 0) {
        // Empty result - stop loading and show empty state
        setErrorState(null);
        setIsProcessing(false);
        setCurrentStatus("empty");
        // Reload to get updated status
        await loadMatchesAndProducts();
        return;
      }
      
      // Success - start polling
      setErrorState(null);
      setIsProcessing(true);
      setCurrentStatus("processing");
      // Start polling
      loadMatchesAndProducts();
    } catch (err) {
      console.error("[matches-review] Error handling discover response:", err);
      setErrorState("Failed to process discovery response");
      setIsProcessing(false);
    }
  };

  // Load data on mount and when storeId/competitorId changes (client-side, no cache)
  // Only run once per storeId/competitorId change - do not depend on status or matches
  useEffect(() => {
    if (!storeId || !competitorId) return;
    
    // Load data immediately on mount or when IDs change
    loadMatchesAndProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, competitorId]); // Do NOT add loadMatchesAndProducts to deps - it would cause loops
  
  // Polling: Controlled polling only when status is 'processing'
  // CRITICAL: Do NOT include groupedMatches.length in dependencies to avoid re-render loops
  useEffect(() => {
    if (!storeId || !competitorId) return;
    
    // Only poll when status is explicitly 'processing'
    const shouldPoll = currentStatus === "processing";
    
    if (!shouldPoll) {
      // Stop polling if not needed
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
      pollingStartTimeRef.current = null;
      pollingTimeoutMessageRef.current = false;
      setIsProcessing(false);
      return;
    }
    
    // Don't start if already polling
    if (pollingTimeoutRef.current) {
      return;
    }
    
    console.log("[matches-review] Starting controlled polling for competitor_id=", competitorId, "status:", currentStatus);
    
    let cancelled = false;
    let timeoutId: NodeJS.Timeout | null = null;
    const POLL_INTERVAL = 2500; // 2.5 seconds (slightly longer to reduce load)
    const MAX_POLL_TIME = 120000; // 120 seconds (2 minutes)
    
    // Record start time
    if (!pollingStartTimeRef.current) {
      pollingStartTimeRef.current = Date.now();
    }
    
    const poll = async () => {
      if (cancelled) return;
      
      // Check timeout
      const elapsed = pollingStartTimeRef.current 
        ? Date.now() - pollingStartTimeRef.current 
        : 0;
      
      if (elapsed >= MAX_POLL_TIME) {
        console.log("[matches-review] Polling timeout after 120 seconds");
        setIsProcessing(false);
        pollingTimeoutMessageRef.current = true;
        pollingTimeoutRef.current = null;
        pollingStartTimeRef.current = null;
        return;
      }
      
      // Load matches and check status
      const result = await loadMatchesAndProducts();
      
      if (cancelled) return;
      
      // Stop polling if status is no longer 'processing'
      // Don't stop based on matches count - let status be the source of truth
      const shouldStop = 
        result.status !== "processing" ||
        result.status === "active" ||
        result.status === "ready" || // Discovery completes with 'ready' status
        result.status === "empty" ||
        result.status === "error" ||
        result.status === "failed" ||
        result.status === "blocked";
      
      if (shouldStop) {
        console.log("[matches-review] Stopping polling - status changed to:", result.status);
        setIsProcessing(false);
        setCurrentStatus(result.status || currentStatus);
        pollingTimeoutRef.current = null;
        pollingStartTimeRef.current = null;
        pollingTimeoutMessageRef.current = false;
        return;
      }
      
      // Continue polling only if status is still 'processing'
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
      pollingTimeoutMessageRef.current = false;
    };
  }, [storeId, competitorId, currentStatus]); // REMOVED groupedMatches.length to prevent re-render loop
  
  // Update isProcessing when status changes
  useEffect(() => {
    setIsProcessing(currentStatus === "processing");
  }, [currentStatus]);

  // On initial load (when grouped data changes), set default selections
  // ONLY for products that do not already have a selection in state
  // DO NOT overwrite user selections afterwards
  useEffect(() => {
    setSelectedByProduct(prev => {
      const next = { ...prev };
      for (const row of groupedMatches) {
        const pid = row.product_id;
        // Only set default if productId has no entry yet
        if (next[pid] == null) {
          // Candidates are already sorted by similarity_score DESC (then price ASC)
          // Best candidate is first
          if (row.candidates?.length > 0 && row.candidates[0]?.candidate_id) {
            next[pid] = row.candidates[0].candidate_id;
          } else {
            next[pid] = "none";
          }
        }
      }
      return next;
    });
  }, [groupedMatches]);

  // Filter products that have selections (excluding "none")
  const matchedProducts = useMemo(() => {
    return groupedMatches.filter((group) => {
      const selectedId = selectedByProduct[group.product_id];
      return selectedId && selectedId !== "none";
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

      // Build list of selected candidate_ids (not competitor_product_ids)
      // NOTE: We use candidate_id because competitor_product_id can be null for store-scraped candidates
      // For store-scraped candidates, we match via competitor_url + candidate_id
      const selectedCandidateIds: string[] = [];
      groupedMatches.forEach((group) => {
        const selectedCandidateId = selectedByProduct[group.product_id];
        if (selectedCandidateId && selectedCandidateId !== "none") {
          const selectedCandidate = group.candidates.find(
            c => c.candidate_id === selectedCandidateId
          );
          if (selectedCandidate && UUID_REGEX.test(selectedCandidate.candidate_id)) {
            selectedCandidateIds.push(selectedCandidate.candidate_id);
          }
        }
      });

      if (selectedCandidateIds.length === 0) {
        alert("Please select at least one match to confirm.");
        setLoading(false);
        return;
      }

      // Load competitor_match_candidates.id for selected candidate_ids
      const { data: candidateRows, error: candidateError } = await supabase
        .from("competitor_match_candidates")
        .select("id, competitor_url")
        .eq("store_id", storeId)
        .eq("competitor_id", competitorId)
        .in("id", selectedCandidateIds);

      if (candidateError) {
        throw new Error(`Failed to load candidate IDs: ${candidateError.message}`);
      }

      if (!candidateRows || candidateRows.length === 0) {
        throw new Error("No matching candidates found. Please refresh the page.");
      }

      // Extract competitor_match_candidates.id values (already have them from query)
      // Extract competitor_match_candidates.id values from candidateRows
      const confirmedCandidateIds = candidateRows.map((row: any) => row.id).filter((id: any) => UUID_REGEX.test(id));

      if (confirmedCandidateIds.length === 0) {
        throw new Error("No valid candidate IDs found. Please refresh the page.");
      }

      // Call RPC to confirm matches and cleanup
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "confirm_competitor_matches_and_cleanup",
        {
          _store_id: storeId,
          _competitor_id: competitorId,
          _confirmed_candidate_ids: confirmedCandidateIds,
        }
      );

      if (rpcError) {
        throw new Error(rpcError.message || "Failed to confirm matches");
      }

      // Show success toast
      alert(`Matches confirmed`);
      
      // Navigate to competitors page (navigation will refresh automatically)
      router.push("/app/competitors");
    } catch (error: any) {
      alert(`Error: ${error.message || "Failed to confirm matches"}`);
    } finally {
      setLoading(false);
    }
  };

  const getScoreBadgeVariant = (score: number | null) => {
    if (score === null) return "outline";
    if (score >= 90) return "default";
    if (score >= 75) return "secondary";
    if (score >= 60) return "outline";
    return "outline";
  };

  const getScoreLabel = (score: number | null) => {
    if (score === null) return "—";
    if (score >= 90) return "Exact";
    if (score >= 75) return "Strong";
    if (score >= 60) return "Possible";
    return "Low";
  };

  const formatMatchScore = (score: number | null): string => {
    if (score === null) return "—";
    return `${Math.round(score)}% match`;
  };

  const formatPrice = (price: number | null): string => {
    if (price == null) return "N/A";
    return `$${price.toFixed(2)}`;
  };

  const formatCompetitorOptionLabel = (candidate: Candidate): string => {
    const name = candidate.competitor_name || "Unknown";
    const price = formatPrice(candidate.competitor_last_price);
    const score = `${Math.round(candidate.similarity_score)}%`;
    // Display: competitor_name + price + (similarity_score%)
    // Show BOTH competitor name + price + score, e.g.: "Iphone — $899.99 (100%)"
    return `${name} — ${price} (${score})`;
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
          {errorState && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              {errorState}
            </p>
          )}
          {pollingTimeoutMessageRef.current && (
            <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs">
              <p className="text-yellow-800 dark:text-yellow-200">
                Still scanning… You can leave this page; we'll keep working and notify you here when results are ready.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  pollingTimeoutMessageRef.current = false;
                  loadMatchesAndProducts();
                }}
              >
                Refresh
              </Button>
            </div>
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
          {currentStatus === "blocked" ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold mb-2 text-yellow-600 dark:text-yellow-400">Site blocks automated scraping</h3>
              <p className="text-muted-foreground mb-6">
                This competitor site blocks automated scraping. You can still add competitors manually by URL on individual products.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => router.push("/app/products?addCompetitorByUrl=true")}
                >
                  Add competitor by URL
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push("/app/competitors")}
                >
                  Back to Competitors
                </Button>
              </div>
            </div>
          ) : currentStatus === "empty" ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold mb-2">No matches found</h3>
              <p className="text-muted-foreground mb-6">
                We scanned the competitor store but couldn't find matching products. Try a different competitor URL or add matches manually.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => router.push("/app/products?addCompetitorByUrl=true")}
                >
                  Add competitor by URL
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push("/app/competitors")}
                >
                  Back to Competitors
                </Button>
              </div>
            </div>
          ) : errorState && (currentStatus === "failed" || currentStatus === "error") ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold mb-2 text-red-600 dark:text-red-400">Error</h3>
              <p className="text-muted-foreground mb-6">{errorState}</p>
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => router.push("/app/competitors")}
                >
                  Back to Competitors
                </Button>
              </div>
            </div>
          ) : isProcessing || currentStatus === "processing" ? (
            // E) Safe fallback: If candidates.length > 0, never show "No matches found" even during processing
            groupedMatches.length === 0 ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Scanning competitor store for products...
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Matches will appear here once scanning is complete.
                </p>
              </div>
            ) : null
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
              {(() => {
                // Log before render - verify candidates array
                console.log('[matches-review] candidates length:', groupedMatches.length, 'first:', groupedMatches[0]);
                return null;
              })()}
              {groupedMatches.map((group) => {
                const myProduct = myProducts.find((p) => p.id === group.product_id);

                if (!myProduct) {
                  return null; // Skip if my product not found
                }

                // Derive selected candidate object for rendering
                const selectedId = selectedByProduct[group.product_id];
                const selectedCandidate =
                  selectedId && selectedId !== "none"
                    ? group.candidates.find(c => c.candidate_id === selectedId)
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
                        {selectedCandidate ? (
                          <div className="flex flex-col gap-1">
                            {/* Row 1: name + price */}
                            <div className="truncate font-medium text-sm">
                              {selectedCandidate.competitor_name} — {formatPrice(selectedCandidate.competitor_last_price)}
                            </div>

                            {/* Row 2: actions */}
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                  if (selectedCandidate.competitor_url) {
                                    window.open(selectedCandidate.competitor_url, "_blank");
                                  }
                                }}
                              >
                                View
                              </Button>

                              <Badge
                                variant={getScoreBadgeVariant(selectedCandidate.similarity_score)}
                                className="text-xs"
                              >
                                {Math.round(selectedCandidate.similarity_score)}% match
                              </Badge>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {/* Row 1: No competitor selected */}
                            <div className="text-sm text-muted-foreground">
                              No competitor selected
                            </div>

                            {/* Row 2: Skipped badge */}
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                Skipped
                              </Badge>
                            </div>
                          </div>
                        )}

                        {/* Dropdown */}
                        <Select
                          value={selectedByProduct[group.product_id] ?? "none"}
                          onValueChange={(val) => {
                            setSelectedByProduct(prev => ({ ...prev, [group.product_id]: val }));
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <span className="truncate">
                              {selectedId === "none" || !selectedId
                                ? "None (skip)"
                                : selectedCandidate
                                  ? formatCompetitorOptionLabel(selectedCandidate)
                                  : "Select competitor product..."}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None (skip)</SelectItem>
                            {group.candidates.map((c) => {
                              // Ensure candidate_id is always string and stable unique key/value
                              const candidateId = String(c.candidate_id);
                              return (
                                <SelectItem key={c.candidate_id} value={candidateId}>
                                  {c.competitor_name} — {formatPrice(c.competitor_last_price)} ({Math.round(c.similarity_score)}%)
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
