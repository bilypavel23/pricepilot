"use client";

import { useState, useMemo } from "react";
import { mockRecommendations } from "@/data/mockData";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { ToastContainer, type Toast } from "@/components/ui/toast";
import { RecommendationCard } from "./recommendation-card";
import { cn } from "@/lib/utils";

// Mock competitor average prices
const getCompetitorAvg = (productId: string): number => {
  const mockAvgs: Record<string, number> = {
    "1": 82.10,
    "2": 194.50,
    "3": 12.20,
  };
  return mockAvgs[productId] || 0;
};

type StoreInfo = {
  platform: string | null;
  shopify_access_token: string | null;
};

type Props = {
  store: StoreInfo;
};

export function RecommendationsClient({ store }: Props) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [sortBy, setSortBy] = useState("biggest-impact");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [updatedPrices, setUpdatedPrices] = useState<Record<string, number>>({});

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

  // Mock risk scores
  const getRiskScore = (changePercent: number): "low" | "med" | "high" => {
    const abs = Math.abs(changePercent);
    if (abs <= 3) return "low";
    if (abs <= 7) return "med";
    return "high";
  };

  const filteredRecommendations = useMemo(() => {
    let filtered = mockRecommendations.filter((rec) => {
      if (typeFilter === "increases" && rec.direction !== "UP") return false;
      if (typeFilter === "decreases" && rec.direction !== "DOWN") return false;
      if (typeFilter === "safe-only" && Math.abs(rec.changePercent) > 5) return false;
      if (riskFilter !== "all") {
        const risk = getRiskScore(rec.changePercent);
        if (riskFilter === "low" && risk !== "low") return false;
        if (riskFilter === "med" && risk !== "med") return false;
        if (riskFilter === "high" && risk !== "high") return false;
      }
      return true;
    });

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "biggest-impact":
          return Math.abs(b.changePercent) - Math.abs(a.changePercent);
        case "highest-margin":
          return (b.suggestedPrice - b.currentPrice) - (a.suggestedPrice - a.currentPrice);
        case "lowest-margin":
          return (a.suggestedPrice - a.currentPrice) - (b.suggestedPrice - b.currentPrice);
        case "alphabetical":
          return a.productName.localeCompare(b.productName);
        default:
          return 0;
      }
    });

    return filtered;
  }, [typeFilter, riskFilter, sortBy]);


  const removeToast = (id: string) => {
    setToasts(toasts.filter((t) => t.id !== id));
  };

  const increaseCount = mockRecommendations.filter((r) => r.direction === "UP" && r.status === "PENDING").length;
  const decreaseCount = mockRecommendations.filter((r) => r.direction === "DOWN" && r.status === "PENDING").length;
  const neutralCount = mockRecommendations.filter((r) => r.direction === "SAME" && r.status === "PENDING").length;

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-8 py-10 lg:py-12 space-y-10">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Recommendations</h1>
        <p className="text-sm text-muted-foreground mt-1">AI-powered pricing suggestions to optimize your margins</p>
      </div>

      {/* AI Summary Panel */}
      <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/40">
        <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300">AI Pricing Summary</h3>
        <p className="mt-1 text-xs text-blue-800 dark:text-blue-200">
          AI found <span className="font-semibold">{mockRecommendations.filter((r) => r.status === "PENDING").length}</span> price opportunities today.
        </p>
        <ul className="mt-2 text-xs text-blue-900 dark:text-blue-200">
          <li>• {increaseCount} increases</li>
          <li>• {decreaseCount} decreases</li>
          <li>• {neutralCount} neutral opportunities</li>
        </ul>
      </div>

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

            {/* Risk Filter */}
            <Select
              id="risk-filter"
              name="risk-filter"
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="w-32"
            >
              <option value="all">All Risk</option>
              <option value="low">Low</option>
              <option value="med">Medium</option>
              <option value="high">High</option>
            </Select>

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
        {filteredRecommendations.map((rec) => {
          const competitorAvg = getCompetitorAvg(rec.productId);
          // Use updated price if available, otherwise use original
          const currentPrice = updatedPrices[rec.productId] ?? rec.currentPrice;

          return (
            <RecommendationCard
              key={rec.id}
              recommendation={{
                ...rec,
                currentPrice, // Use updated price
              }}
              competitorAvg={competitorAvg}
              store={store}
              onPriceUpdated={handlePriceUpdated}
            />
          );
        })}
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

