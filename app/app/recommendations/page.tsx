"use client";

import { useState, useMemo } from "react";
import { mockRecommendations } from "@/data/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowUp, 
  ArrowDown, 
  Minus, 
  CheckCircle2, 
  Sparkles,
  ChevronDown,
  Download,
  Eye,
  Package
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToastContainer, type Toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// Mock risk scores
const getRiskScore = (changePercent: number): "low" | "med" | "high" => {
  const abs = Math.abs(changePercent);
  if (abs <= 3) return "low";
  if (abs <= 7) return "med";
  return "high";
};

// Mock competitor average prices
const getCompetitorAvg = (productId: string): number => {
  const mockAvgs: Record<string, number> = {
    "1": 82.10,
    "2": 194.50,
    "3": 12.20,
  };
  return mockAvgs[productId] || 0;
};

export default function RecommendationsPage() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [sortBy, setSortBy] = useState("biggest-impact");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

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

  const handleApply = (recId: string) => {
    const rec = mockRecommendations.find((r) => r.id === recId);
    if (rec) {
      rec.status = "APPLIED";
      setSelectedIds(selectedIds.filter(id => id !== recId));
      setToasts([...toasts, { id: Date.now().toString(), message: `Applied recommendation for ${rec.productName}`, type: "success" }]);
    }
  };

  const handleApplyAllSafe = () => {
    const safeRecs = mockRecommendations.filter(
      (rec) => Math.abs(rec.changePercent) <= 5 && rec.status === "PENDING"
    );
    safeRecs.forEach((rec) => {
      rec.status = "APPLIED";
    });
    setSelectedIds([]);
    setToasts([...toasts, { id: Date.now().toString(), message: `Applied ${safeRecs.length} recommendations (mock mode)`, type: "success" }]);
  };

  const handleApplySelected = () => {
    selectedIds.forEach(id => {
      const rec = mockRecommendations.find((r) => r.id === id);
      if (rec) {
        rec.status = "APPLIED";
      }
    });
    setSelectedIds([]);
    setToasts([...toasts, { id: Date.now().toString(), message: `Applied ${selectedIds.length} recommendations`, type: "success" }]);
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredRecommendations.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRecommendations.map(r => r.id));
    }
  };

  const removeToast = (id: string) => {
    setToasts(toasts.filter((t) => t.id !== id));
  };

  const safeCount = mockRecommendations.filter(
    (rec) => Math.abs(rec.changePercent) <= 5 && rec.status === "PENDING"
  ).length;

  const increaseCount = mockRecommendations.filter(r => r.direction === "UP" && r.status === "PENDING").length;
  const decreaseCount = mockRecommendations.filter(r => r.direction === "DOWN" && r.status === "PENDING").length;
  const neutralCount = mockRecommendations.filter(r => r.direction === "SAME" && r.status === "PENDING").length;

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-8 py-10 lg:py-12 space-y-10 pb-24">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Recommendations</h1>
        <p className="text-sm text-muted-foreground mt-1">AI-powered pricing suggestions to optimize your margins</p>
      </div>

      {/* AI Summary Panel */}
      <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/40">
        <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300">
          AI Pricing Summary
        </h3>
        <p className="mt-1 text-xs text-blue-800 dark:text-blue-200">
          AI found <span className="font-semibold">{mockRecommendations.filter(r => r.status === "PENDING").length}</span> price opportunities today.
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
          const risk = getRiskScore(rec.changePercent);
          const competitorAvg = getCompetitorAvg(rec.productId);
          const isSelected = selectedIds.includes(rec.id);
          const isIncrease = rec.direction === "UP";
          const isDecrease = rec.direction === "DOWN";

          return (
            <Card
              key={rec.id}
              className={cn(
                "rounded-2xl bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800 transition-all duration-150 hover:-translate-y-[1px] hover:shadow-md",
                isSelected && "ring-2 ring-blue-500 dark:ring-blue-400"
              )}
            >
              <CardContent className="p-6">
                <div className="flex gap-4">
                  {/* Product Image Placeholder */}
                  <div className="flex-shrink-0 w-20 h-20 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Package className="h-8 w-8 text-slate-400" />
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 space-y-3">
                    {/* Header with Badge and Checkbox */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(rec.id)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{rec.productName}</h3>
                        <Badge
                          className={cn(
                            "text-xs",
                            isIncrease && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
                            isDecrease && "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                          )}
                        >
                          {isIncrease ? "Increase" : isDecrease ? "Decrease" : "No change"}
                        </Badge>
                      </div>
                    </div>

                    {/* Price Change */}
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        ${rec.currentPrice.toFixed(2)} → ${rec.suggestedPrice.toFixed(2)}
                      </span>
                      <span className={cn(
                        "text-sm font-medium px-2 py-1 rounded-full",
                        isIncrease
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : isDecrease
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                      )}>
                        ({isIncrease ? "+" : ""}{rec.changePercent.toFixed(1)}%)
                      </span>
                    </div>

                    {/* Competitor Info */}
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Competitor avg: <span className="font-semibold">${competitorAvg.toFixed(2)}</span>
                    </p>

                    {/* AI Reason */}
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {rec.reason}
                    </p>

                    {/* Risk Score and Actions */}
                    <div className="flex items-center justify-between pt-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          risk === "low" && "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-700",
                          risk === "med" && "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-700",
                          risk === "high" && "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-700"
                        )}
                      >
                        Risk: {risk === "low" ? "Low" : risk === "med" ? "Medium" : "High"}
                      </Badge>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApply(rec.id)}
                          disabled={rec.status === "APPLIED"}
                          className={cn(
                            rec.status === "APPLIED" && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          {rec.status === "APPLIED" ? (
                            <>
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Applied
                            </>
                          ) : (
                            "Apply"
                          )}
                        </Button>
                        {Math.abs(rec.changePercent) <= 5 && rec.status === "PENDING" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApply(rec.id)}
                          >
                            Apply safe
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4 mr-1" />
                              Impact preview
                              <ChevronDown className="h-4 w-4 ml-1" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <div className="text-xs space-y-1">
                                <p className="font-semibold">Revenue impact</p>
                                <p className="text-slate-600 dark:text-slate-400">
                                  +${((rec.suggestedPrice - rec.currentPrice) * 10).toFixed(2)}/week (est.)
                                </p>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <div className="text-xs space-y-1">
                                <p className="font-semibold">Margin change</p>
                                <p className="text-slate-600 dark:text-slate-400">
                                  {isIncrease ? "+" : ""}{rec.changePercent.toFixed(1)}%
                                </p>
                              </div>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Bulk Action Bar (Sticky Bottom) */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-lg z-50">
          <div className="max-w-6xl mx-auto px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                >
                  {selectedIds.length === filteredRecommendations.length ? "Deselect all" : "Select all"}
                </Button>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {selectedIds.length} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleApplyAllSafe}
                >
                  Apply all safe
                </Button>
                <Button
                  size="sm"
                  onClick={handleApplySelected}
                >
                  Apply selected ({selectedIds.length})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
