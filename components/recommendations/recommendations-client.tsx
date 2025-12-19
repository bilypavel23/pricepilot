"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { ToastContainer, type Toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RecommendationCard } from "./recommendation-card";
import { cn } from "@/lib/utils";
import type { ProductRecommendation } from "@/lib/recommendations/types";

type StoreInfo = {
  platform: string | null;
  shopify_access_token: string | null;
};

type Props = {
  store: StoreInfo;
  recommendations: ProductRecommendation[];
  hasProducts: boolean;
  plan: string;
};

export function RecommendationsClient({ store, recommendations, hasProducts, plan }: Props) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("biggest-impact");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [updatedPrices, setUpdatedPrices] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkMenuOpen, setIsBulkMenuOpen] = useState(false);
  const [decreaseOffset, setDecreaseOffset] = useState<number>(0);
  const [increaseOffset, setIncreaseOffset] = useState<number>(0);
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  const isShopify = store.platform === "shopify" && !!store.shopify_access_token;

  const handlePriceUpdated = (productId: string, newPrice: number) => {
    setUpdatedPrices((prev) => ({ ...prev, [productId]: newPrice }));
    setToasts([
      ...toasts,
      {
        id: Date.now().toString(),
        message: "Price updated in your Shopify store",
        type: "success",
      },
    ]);
  };

  // Check if any recommendations have competitors (for summary stats only)
  const hasCompetitors = useMemo(() => {
    return recommendations.some(rec => rec.competitorCount > 0);
  }, [recommendations]);

  // Separate products with and without competitors for stats
  const productsWithCompetitors = useMemo(() => {
    return recommendations.filter(rec => rec.competitorCount > 0);
  }, [recommendations]);

  const productsWithoutCompetitors = useMemo(() => {
    return recommendations.filter(rec => rec.competitorCount === 0);
  }, [recommendations]);

  // Generate display recommendations
  const displayRecommendations = useMemo(() => {
    if (!hasProducts) {
      // CASE A: No products at all - return empty, will show message
      return [];
    }

    // Use real recommendations
    return recommendations.map((rec) => ({
      ...rec,
      productPrice: updatedPrices[rec.productId] ?? rec.productPrice,
    }));
  }, [hasProducts, recommendations, updatedPrices]);

  const filteredRecommendations = useMemo(() => {
    let filtered = displayRecommendations.filter((rec) => {
      // Products without competitors should only appear in "all" filter
      if (rec.competitorCount === 0) {
        return typeFilter === "all";
      }

      if (typeFilter === "increases" && rec.changePercent <= 0) return false;
      if (typeFilter === "decreases" && rec.changePercent >= 0) return false;
      if (typeFilter === "safe-only" && Math.abs(rec.changePercent) > 5) return false;
      return true;
    });

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "biggest-impact":
          return Math.abs(b.changePercent) - Math.abs(a.changePercent);
        case "highest-margin":
          const marginA = (a.recommendedPrice ?? 0) - (a.productPrice ?? 0);
          const marginB = (b.recommendedPrice ?? 0) - (b.productPrice ?? 0);
          return marginB - marginA;
        case "lowest-margin":
          const marginA2 = (a.recommendedPrice ?? 0) - (a.productPrice ?? 0);
          const marginB2 = (b.recommendedPrice ?? 0) - (b.productPrice ?? 0);
          return marginA2 - marginB2;
        case "alphabetical":
          return a.productName.localeCompare(b.productName);
        default:
          return 0;
      }
    });

    return filtered;
  }, [displayRecommendations, typeFilter, sortBy]);

  const removeToast = (id: string) => {
    setToasts(toasts.filter((t) => t.id !== id));
  };

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };

  const realFilteredRecs = filteredRecommendations;
  const allSelected = realFilteredRecs.length > 0 &&
    selectedIds.length === realFilteredRecs.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(realFilteredRecs.map((r) => r.productId));
    }
  };

  // Bulk apply logic
  const handleConfirmBulkApply = async () => {
    if (selectedIds.length === 0) return;

    try {
      setIsBulkSaving(true);

      const selectedRecs = recommendations.filter((r) =>
        selectedIds.includes(r.productId)
      );

      let successCount = 0;
      let skippedCount = 0;

      for (const rec of selectedRecs) {
        const comp = rec.competitorAvg;
        if (!comp || comp <= 0) {
          skippedCount++;
          continue;
        }

        const myPrice =
          rec.productPrice ??
          rec.recommendedPrice ??
          rec.competitorAvg;

        if (!myPrice || myPrice <= 0) {
          skippedCount++;
          continue;
        }

        const diffVsMe = ((comp - myPrice) / myPrice) * 100;

        let offset: number;
        if (diffVsMe < 0) {
          // competitors are cheaper than me -> we should go DOWN
          offset = decreaseOffset; // e.g. -2 => 2% cheaper than competitors
        } else if (diffVsMe > 0) {
          // competitors are more expensive than me -> we can go UP
          offset = increaseOffset; // e.g. +2 => 2% above competitors
        } else {
          // equal – treat as increase case or just match
          offset = 0;
        }

        const newPriceRaw = comp * (1 + offset / 100);
        const newPrice = Number(newPriceRaw.toFixed(2));

        try {
          const res = await fetch("/api/shopify/products/update-price", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId: rec.productId,
              newPrice,
            }),
          });

          if (res.ok) {
            successCount++;
            setUpdatedPrices((prev) => ({ ...prev, [rec.productId]: newPrice }));
          } else {
            console.error("Bulk update failed for product", rec.productId);
          }
        } catch (err) {
          console.error(`Failed to update ${rec.productId}:`, err);
        }
      }

      setIsBulkMenuOpen(false);
      setSelectedIds([]);

      // Show toast
      setToasts([
        ...toasts,
        {
          id: Date.now().toString(),
          message: `Bulk update: ${successCount} updated${skippedCount > 0 ? `, ${skippedCount} skipped` : ""}`,
          type: "success",
        },
      ]);
    } catch (err) {
      console.error("Bulk apply error:", err);
      setToasts([
        ...toasts,
        {
          id: Date.now().toString(),
          message: "Failed to apply some updates",
          type: "error",
        },
      ]);
    } finally {
      setIsBulkSaving(false);
    }
  };

  // Calculate summary stats from products WITH competitors only
  const recsWithCompetitors = productsWithCompetitors;
  const increaseCount = recsWithCompetitors.filter((r) => r.changePercent > 0).length;
  const decreaseCount = recsWithCompetitors.filter((r) => r.changePercent < 0).length;
  const neutralCount = recsWithCompetitors.filter((r) => r.changePercent === 0).length;

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-8 py-10 lg:py-12 pb-24 space-y-10">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Recommendations</h1>
        <p className="text-sm text-muted-foreground mt-1">AI-powered pricing suggestions to optimize your margins</p>
      </div>

      {/* CASE A: No products message */}
      {!hasProducts && (
        <div className="mb-6 rounded-2xl border border-yellow-200 bg-yellow-50/60 p-4 shadow-sm dark:border-yellow-900/40 dark:bg-yellow-950/40">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            You don&apos;t have any products yet. Add products first to see pricing recommendations.
          </p>
        </div>
      )}

      {/* AI Summary Panel */}
      {hasProducts && (
        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/40">
          <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300">AI Pricing Summary</h3>
          {recsWithCompetitors.length > 0 ? (
            <>
              <p className="mt-1 text-xs text-blue-800 dark:text-blue-200">
                AI found <span className="font-semibold">{recsWithCompetitors.length}</span> price opportunities today.
              </p>
              <ul className="mt-2 text-xs text-blue-900 dark:text-blue-200">
                <li>• {increaseCount} increases</li>
                <li>• {decreaseCount} decreases</li>
                <li>• {neutralCount} neutral opportunities</li>
              </ul>
            </>
          ) : (
            <p className="mt-1 text-xs text-blue-800 dark:text-blue-200">
              Add competitors to unlock AI pricing recommendations.
            </p>
          )}
          {productsWithoutCompetitors.length > 0 && (
            <p className="mt-2 text-xs text-blue-700 dark:text-blue-300 italic">
              {productsWithoutCompetitors.length} product{productsWithoutCompetitors.length !== 1 ? 's' : ''} need competitors.
            </p>
          )}
        </div>
      )}

      {/* Filters Bar */}
      <Card className="rounded-2xl bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Type Filter */}
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800 p-1">
              <button
                onClick={() => setTypeFilter("all")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  typeFilter === "all"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                All
              </button>
              <button
                onClick={() => setTypeFilter("increases")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  typeFilter === "increases"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                Increase
              </button>
              <button
                onClick={() => setTypeFilter("decreases")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  typeFilter === "decreases"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                Decrease
              </button>
              <button
                onClick={() => setTypeFilter("safe-only")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  typeFilter === "safe-only"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                Safe only
              </button>
            </div>

            {/* Sort By */}
            <Select
              id="sort-filter"
              name="sort-filter"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-48"
            >
              <option value="biggest-impact">Biggest impact</option>
              <option value="highest-margin">Highest margin</option>
              <option value="lowest-margin">Lowest margin</option>
              <option value="alphabetical">Alphabetical</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations List */}
      <div className="space-y-4">
        {!hasProducts ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>You don&apos;t have any products yet. Add products first to see pricing recommendations.</p>
          </div>
        ) : filteredRecommendations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No recommendations match your current filters.</p>
          </div>
        ) : (
          filteredRecommendations.map((rec) => (
            <RecommendationCard
              key={rec.productId}
              recommendation={rec}
              store={store}
              plan={plan}
              onPriceUpdated={handlePriceUpdated}
              isSelected={selectedIds.includes(rec.productId)}
              onToggleSelect={toggleSelect}
            />
          ))
        )}
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Bulk Update Bar - Fixed at bottom, always visible when items selected */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-background/95 backdrop-blur border-t border-border px-4 py-3 flex items-center justify-between" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-xs text-muted-foreground cursor-pointer" onClick={toggleSelectAll}>
                Select all
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} selected
            </span>
          </div>

          <Button 
            size="sm" 
            onClick={() => setIsBulkMenuOpen(true)}
            disabled={!isShopify || selectedIds.length === 0}
          >
            Apply to selected
          </Button>
        </div>
      )}

      {/* Bulk Update Dialog */}
      <Dialog open={isBulkMenuOpen} onOpenChange={setIsBulkMenuOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Bulk update prices</DialogTitle>
            <DialogDescription>
              Choose how far you want to move your prices from competitor average.
              Products without competitors will be skipped.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-5 text-sm">
            {/* Decrease section */}
            <div className="space-y-2">
              <p className="font-medium">When prices should go down</p>
                <p className="text-xs text-muted-foreground">
                Used when competitors are cheaper than your current price.
                Negative values = cheaper than competitors. Average 0 = Competitor Average.
              </p>

              <div className="space-y-2">
                <Slider
                  min={-3}
                  max={3}
                  step={1}
                  value={[decreaseOffset]}
                  onValueChange={(v) => setDecreaseOffset(v[0])}
                  className="w-full"
                />
                <div className="mt-1 grid grid-cols-7 text-[11px] text-muted-foreground text-center">
                  <span>-3%</span>
                  <span>-2%</span>
                  <span>-1%</span>
                  <span className="font-medium">Competitor avg</span>
                  <span>+1%</span>
                  <span>+2%</span>
                  <span>+3%</span>
                </div>
                <p className="text-xs">
                  Current: <span className="font-semibold">{decreaseOffset}%</span> vs competitor average
                </p>
              </div>
            </div>

            {/* Increase section */}
            <div className="space-y-2">
              <p className="font-medium">When prices can go up</p>
                <p className="text-xs text-muted-foreground">
                Used when competitors are more expensive than your current price.
                Positive values = more expensive than competitors. Average 0 = Competitor Average.
              </p>

              <div className="space-y-2">
                <Slider
                  min={-3}
                  max={3}
                  step={1}
                  value={[increaseOffset]}
                  onValueChange={(v) => setIncreaseOffset(v[0])}
                  className="w-full"
                />
                <div className="mt-1 grid grid-cols-7 text-[11px] text-muted-foreground text-center">
                  <span>-3%</span>
                  <span>-2%</span>
                  <span>-1%</span>
                  <span className="font-medium">Competitor avg</span>
                  <span>+1%</span>
                  <span>+2%</span>
                  <span>+3%</span>
                </div>
                <p className="text-xs">
                  Current: <span className="font-semibold">{increaseOffset}%</span> vs competitor average
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsBulkMenuOpen(false)} disabled={isBulkSaving}>
              Cancel
            </Button>
            <Button onClick={handleConfirmBulkApply} disabled={isBulkSaving}>
              {isBulkSaving ? "Applying..." : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
