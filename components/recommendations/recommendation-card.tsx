"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { CheckCircle2, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { PriceRecommendation, CompetitorPrice } from "@/types";

type StoreInfo = {
  platform: string | null;
  shopify_access_token: string | null;
};

type Props = {
  recommendation: PriceRecommendation;
  competitorAvg: number;
  store: StoreInfo;
  onPriceUpdated?: (productId: string, newPrice: number) => void;
};

export function RecommendationCard({ recommendation, competitorAvg, store, onPriceUpdated }: Props) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [newPrice, setNewPrice] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localCurrentPrice, setLocalCurrentPrice] = useState(recommendation.currentPrice);

  const isShopify = store.platform === "shopify" && !!store.shopify_access_token;
  const canApply = isShopify && recommendation.suggestedPrice !== localCurrentPrice;
  const isIncrease = recommendation.direction === "UP";
  const isDecrease = recommendation.direction === "DOWN";

  const handleOpenSheet = () => {
    setNewPrice(recommendation.suggestedPrice.toFixed(2));
    setError(null);
    setIsSheetOpen(true);
  };

  const handleSavePrice = async () => {
    setError(null);
    const value = parseFloat(newPrice);

    if (isNaN(value) || value <= 0) {
      setError("Please enter a valid price.");
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetch("/api/shopify/products/update-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: recommendation.productId,
          newPrice: value,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update price");
      }

      // Update local state
      setLocalCurrentPrice(value);
      onPriceUpdated?.(recommendation.productId, value);
      setIsSheetOpen(false);
    } catch (err: any) {
      setError(err.message || "Failed to update price");
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate new change percent if price was updated
  const effectiveRecommendedPrice = recommendation.suggestedPrice;
  const effectiveChangePercent =
    ((effectiveRecommendedPrice - localCurrentPrice) / localCurrentPrice) * 100;

  // Prepare competitor slots (always 5 items)
  const competitors = recommendation.competitors ?? [];
  const competitorSlots: (CompetitorPrice | null)[] = [
    competitors[0] ?? null,
    competitors[1] ?? null,
    competitors[2] ?? null,
    competitors[3] ?? null,
    competitors[4] ?? null,
  ];

  return (
    <>
      <Card className="rounded-2xl bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800 transition-all duration-150 hover:-translate-y-[1px] hover:shadow-md">
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-stretch">
            {/* Left Column */}
            <div className="w-full md:w-1/2 space-y-3">
              <div className="flex gap-4">
                {/* Product Image Placeholder */}
                <div className="flex-shrink-0 w-20 h-20 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Package className="h-8 w-8 text-slate-400" />
                </div>

                {/* Main Content */}
                <div className="flex-1 space-y-3">
                  {/* Product Name */}
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {recommendation.productName}
                  </h3>

                  {/* Price Change */}
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      ${localCurrentPrice.toFixed(2)} → ${effectiveRecommendedPrice.toFixed(2)}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-medium px-2 py-1 rounded-full",
                        isIncrease
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : isDecrease
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                      )}
                    >
                      ({isIncrease ? "+" : ""}{effectiveChangePercent.toFixed(1)}%)
                    </span>
                  </div>

                  {/* Competitor Info */}
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Competitor avg: <span className="font-semibold">${competitorAvg.toFixed(2)}</span>
                  </p>

                  {/* AI Reason */}
                  <p className="text-sm text-slate-700 dark:text-slate-300">{recommendation.reason}</p>

                  {/* Apply Button or Message */}
                  <div className="pt-2">
                    {canApply ? (
                      <Button size="sm" onClick={handleOpenSheet} className="gap-2">
                        Apply in my store
                      </Button>
                    ) : !isShopify ? (
                      <p className="text-xs text-muted-foreground">
                        Automatic price updates are available only for Shopify stores.
                      </p>
                    ) : effectiveRecommendedPrice === localCurrentPrice ? (
                      <p className="text-xs text-muted-foreground">No price change needed.</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Competitors Panel */}
            <div className="w-full md:w-1/2">
              <div className="h-full rounded-xl border border-border/60 bg-background/40 dark:bg-slate-800/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Competitors
                  </p>
                </div>

                <div className="space-y-1.5">
                  {competitorSlots.map((c, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg bg-muted/40 dark:bg-slate-700/40 px-3 py-2 text-xs"
                    >
                      {c && c.name ? (
                        <>
                          <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                              Competitor {index + 1}
                            </span>

                            {c.url ? (
                              <a
                                href={c.url}
                                target="_blank"
                                rel="noreferrer"
                                className="truncate text-xs font-medium text-primary hover:underline"
                                title={c.name}
                              >
                                {c.name}
                              </a>
                            ) : (
                              <span
                                className="truncate text-xs font-medium"
                                title={c.name}
                              >
                                {c.name}
                              </span>
                            )}

                            <span className="shrink-0 text-xs text-muted-foreground">
                              ${c.oldPrice?.toFixed(2) ?? "?"} → ${c.newPrice?.toFixed(2) ?? "?"}
                            </span>
                          </div>

                          {c.changePercent != null && (
                            <span
                              className={cn(
                                "ml-2 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                c.changePercent > 0
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : c.changePercent < 0
                                  ? "bg-red-500/10 text-red-400"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {c.changePercent > 0 ? "+" : ""}
                              {c.changePercent.toFixed(1)}%
                            </span>
                          )}
                        </>
                      ) : (
                        <div className="flex w-full items-center justify-between text-muted-foreground/70">
                          <span className="text-[11px] font-semibold">
                            Competitor {index + 1}
                          </span>
                          <span className="text-xs">-</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Drawer */}
      {canApply && (
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen} side="bottom">
          <SheetContent className="h-auto max-h-[80vh] w-full max-w-none rounded-t-2xl border-t border-l-0 border-r-0 border-b-0 overflow-y-auto">
            <div className="mx-auto w-full max-w-xl space-y-4 px-4 pb-4">
              <SheetHeader>
                <SheetTitle>Set new price</SheetTitle>
                <SheetDescription>{recommendation.productName}</SheetDescription>
              </SheetHeader>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current price</span>
                  <span className="font-medium">${localCurrentPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recommended</span>
                  <span>
                    ${recommendation.suggestedPrice.toFixed(2)}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({recommendation.changePercent > 0 ? "+" : ""}
                      {recommendation.changePercent.toFixed(1)}%)
                    </span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Competitor avg</span>
                  <span className="font-medium">${competitorAvg.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPrice">New price</Label>
                <Input
                  id="newPrice"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className={error ? "border-red-500" : ""}
                />
                {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setIsSheetOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={handleSavePrice} disabled={isSaving}>
                  {isSaving ? "Updating..." : "Update price"}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

