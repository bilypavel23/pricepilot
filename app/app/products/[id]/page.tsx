"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getProducts } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Brain } from "lucide-react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  // TODO: Replace with real product data from Supabase
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
  });

  const product = products.find((p) => p.id === id);

  if (!product) {
    return (
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-10 lg:py-12">
        <p className="text-muted-foreground mb-4">Product not found</p>
        <Button asChild>
          <Link href="/app/products">Back to products</Link>
        </Button>
      </div>
    );
  }

  // ======================================================
  // MOCK DATA
  // ======================================================
  const mockProduct = {
    name: "Wireless Headphones",
    sku: "WH-001",
    currentPrice: 79.99,
    suggestedPrice: 83.99,
    cost: 40,
    marginPercent: 50,
    inventory: 25,
  };

  const mockCompetitor = {
    avgPrice: 81.59,
    diffVsUsPercent: -2,
    urls: [
      { name: "TechStore", price: 74.99, lastChecked: "2024-01-20" },
      { name: "ElectroHub", price: 82.99, lastChecked: "2024-01-20" },
    ],
  };

  const mockPriceHistory = {
    labels: ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"],
    competitorAverage: [75, 75.5, 76, 77, 78, 78.2, 78.5],
    ourPrice: [79.99, 80.2, 80.5, 81, 82, 82.5, 83],
  };

  const mockCompetitorBreakdown = [
    { name: "Your price", price: mockProduct.currentPrice },
    { name: "TechStore", price: 74.99 },
    { name: "ElectroHub", price: 82.99 },
    { name: "GigaSound", price: 86.5 },
  ];

  const mockRecommendationsHistory = [
    {
      date: "2024-01-15",
      oldPrice: 75.99,
      suggestedPrice: 79.99,
      applied: true,
      type: "increase",
      reason: "Competitor average increased by 6% over the last week.",
    },
    {
      date: "2024-01-10",
      oldPrice: 74.99,
      suggestedPrice: 76.99,
      applied: false,
      type: "increase",
      reason: "Your margin was below target threshold.",
    },
    {
      date: "2024-01-04",
      oldPrice: 77.99,
      suggestedPrice: 74.99,
      applied: true,
      type: "decrease",
      reason: "Competitors dropped prices and you were 10% above market.",
    },
  ];

  // ======================================================
  // STAVY
  // ======================================================
  const [simulatedPrice, setSimulatedPrice] = useState(mockProduct.suggestedPrice);
  const [activeChartTab, setActiveChartTab] = useState("history");

  // Transform data for charts
  const priceHistoryData = mockPriceHistory.labels.map((label, idx) => ({
    date: label,
    yourPrice: mockPriceHistory.ourPrice[idx],
    competitorAvg: mockPriceHistory.competitorAverage[idx],
  }));

  // Competitor breakdown calculations
  const maxPrice = Math.max(...mockCompetitorBreakdown.map((c) => c.price));

  // Price simulator calculations
  const simulatedMargin = ((simulatedPrice - mockProduct.cost) / simulatedPrice) * 100;
  const simulatedDiffVsCompetitor = ((simulatedPrice - mockCompetitor.avgPrice) / mockCompetitor.avgPrice) * 100;
  const priceChangePercent = ((simulatedPrice - mockProduct.currentPrice) / mockProduct.currentPrice) * 100;

  const recommendation = {
    price: mockProduct.suggestedPrice,
    direction: mockProduct.suggestedPrice > mockProduct.currentPrice ? "UP" : mockProduct.suggestedPrice < mockProduct.currentPrice ? "DOWN" : "SAME",
    summary: "Market analysis suggests a price adjustment would improve margins.",
  };

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-8 py-10 lg:py-12 space-y-10">
      {/* Hero Header */}
      <Card className="bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200/50 dark:border-blue-800/50">
        <CardContent className="p-8">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Button variant="ghost" size="sm" asChild className="mb-4">
                <Link href="/app/products">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to products
                </Link>
              </Button>
              <h1 className="text-3xl font-semibold tracking-tight">{mockProduct.name}</h1>
              <p className="text-muted-foreground">SKU: {mockProduct.sku}</p>
            </div>
            {recommendation && (
              <Button className="shadow-lg">
                Apply suggested price
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI Insight Card */}
      <div className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-white/60 p-1.5 shadow-sm dark:bg-emerald-900/60">
              <Brain className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                AI insight
              </p>
              <p className="mt-0.5 text-sm">
                Your price is <span className="font-semibold">{Math.abs(mockCompetitor.diffVsUsPercent)}%</span>
                {mockCompetitor.diffVsUsPercent < 0 ? " below" : " above"} competitor average.
                Increasing price to <span className="font-semibold">${mockProduct.suggestedPrice.toFixed(2)}</span>
                could add an estimated <span className="font-semibold">+$180/week</span> in revenue.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-8">
          {/* Product Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Product Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Current Price</p>
                    <p className="text-3xl font-semibold">${mockProduct.currentPrice.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Cost</p>
                    <p className="text-xl font-medium">${mockProduct.cost.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Margin %</p>
                    <p className="text-xl font-medium">{mockProduct.marginPercent.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Inventory</p>
                    <p className="text-xl font-medium">{mockProduct.inventory ?? "-"}</p>
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Suggested Price</p>
                    <p className="text-3xl font-semibold">
                      {recommendation ? `$${recommendation.price.toFixed(2)}` : "No active recommendation"}
                    </p>
                    {recommendation && (
                      <div className="flex items-center gap-2 mt-3">
                        <Badge
                          variant={recommendation.direction === "UP" ? "default" : "secondary"}
                          className={cn(
                            recommendation.direction === "UP" && "bg-gradient-to-r from-green-500 to-green-600",
                            recommendation.direction === "DOWN" && "bg-gradient-to-r from-red-500 to-red-600"
                          )}
                        >
                          {recommendation.direction === "UP" && <TrendingUp className="h-3 w-3 mr-1" />}
                          {recommendation.direction === "DOWN" && <TrendingDown className="h-3 w-3 mr-1" />}
                          {recommendation.direction === "SAME" && <Minus className="h-3 w-3 mr-1" />}
                          {recommendation.direction}
                        </Badge>
                        <p className="text-sm text-muted-foreground">{recommendation.summary}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Price Simulator */}
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Price Simulator</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Adjust the slider to see how your margin, revenue and market position change.
              </p>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>$70</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">${simulatedPrice.toFixed(2)}</span>
                  <span>$110</span>
                </div>

                <input
                  type="range"
                  min={70}
                  max={110}
                  step={0.5}
                  value={simulatedPrice}
                  onChange={(e) => setSimulatedPrice(Number(e.target.value))}
                  className="mt-2 w-full accent-blue-500"
                />
              </div>

              {/* Simulation Metrics */}
              <div className="mt-6 grid grid-cols-3 gap-4 pt-4 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">New Margin</p>
                  <p className="text-sm font-semibold">{simulatedMargin.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">vs Competitors</p>
                  <p className={cn(
                    "text-sm font-semibold",
                    simulatedDiffVsCompetitor > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                  )}>
                    {simulatedDiffVsCompetitor > 0 ? "+" : ""}{simulatedDiffVsCompetitor.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Revenue Impact</p>
                  <p className={cn(
                    "text-sm font-semibold",
                    priceChangePercent > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  )}>
                    {priceChangePercent > 0 ? "+" : ""}{priceChangePercent.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Competitor Insights */}
          <Card>
            <CardHeader>
              <CardTitle>Competitor Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Competitor average price</p>
                <p className="text-2xl font-semibold">${mockCompetitor.avgPrice.toFixed(2)}</p>
              </div>
              <p className={cn(
                "text-sm font-medium",
                mockCompetitor.diffVsUsPercent > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
              )}>
                You are {Math.abs(mockCompetitor.diffVsUsPercent).toFixed(1)}%
                {mockCompetitor.diffVsUsPercent > 0 ? " higher" : " lower"} than competitors
              </p>
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-sm font-medium">Competitor URLs:</p>
                <ul className="text-sm text-muted-foreground space-y-1.5">
                  {mockCompetitor.urls.map((url, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        idx === 0 ? "bg-blue-500" : "bg-purple-500"
                      )}></span>
                      {url.name}: ${url.price.toFixed(2)} (last checked: {url.lastChecked})
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {/* Price History Chart with Tabs */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Price History</CardTitle>
                <div className="inline-flex items-center rounded-full bg-slate-100 p-1 text-[11px] dark:bg-slate-900/60">
                  <button
                    onClick={() => setActiveChartTab("history")}
                    className={cn(
                      "px-3 py-1 rounded-full transition-colors",
                      activeChartTab === "history"
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                    )}
                  >
                    Price history
                  </button>
                  <button
                    onClick={() => setActiveChartTab("breakdown")}
                    className={cn(
                      "px-3 py-1 rounded-full transition-colors",
                      activeChartTab === "breakdown"
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                    )}
                  >
                    Competitor breakdown
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {activeChartTab === "history" ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={priceHistoryData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      stroke="var(--muted-foreground)"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: '0.75rem',
                        padding: '0.5rem'
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="yourPrice"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={{ fill: '#3B82F6', r: 4 }}
                      activeDot={{ r: 6 }}
                      name="Your Price"
                    />
                    <Line
                      type="monotone"
                      dataKey="competitorAvg"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={{ fill: '#10B981', r: 4 }}
                      activeDot={{ r: 6 }}
                      name="Competitor Average"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="space-y-4">
                  {mockCompetitorBreakdown.map((comp, idx) => {
                    const widthPercent = (comp.price / maxPrice) * 100;
                    const isYourPrice = comp.name === "Your price";
                    return (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700 dark:text-slate-300">{comp.name}</span>
                          <span className="text-slate-600 dark:text-slate-400">${comp.price.toFixed(2)}</span>
                        </div>
                        <div className="relative h-6 rounded-md bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-md transition-all",
                              isYourPrice
                                ? "bg-blue-500 dark:bg-blue-600"
                                : "bg-slate-400 dark:bg-slate-600"
                            )}
                            style={{ width: `${widthPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recommendation History */}
          <Card>
            <CardHeader>
              <CardTitle>Recommendation History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockRecommendationsHistory.map((rec, idx) => {
                  const changePercent = ((rec.suggestedPrice - rec.oldPrice) / rec.oldPrice) * 100;
                  const isIncrease = rec.type === "increase";
                  const isDecrease = rec.type === "decrease";

                  return (
                    <div
                      key={idx}
                      className={cn(
                        "p-4 rounded-xl border transition-all",
                        rec.applied
                          ? "bg-green-50/50 dark:bg-green-950/10 border-green-200 dark:border-green-800"
                          : "bg-slate-50/50 dark:bg-slate-900/50 border-border"
                      )}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold">{rec.date}</p>
                            <Badge
                              variant={rec.applied ? "default" : "outline"}
                              className={cn(
                                rec.applied && "bg-green-500 text-white",
                                !rec.applied && "bg-slate-200 dark:bg-slate-800"
                              )}
                            >
                              {rec.applied ? "Applied" : "Pending"}
                            </Badge>
                            {isIncrease && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-700">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                Increase
                              </Badge>
                            )}
                            {isDecrease && (
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-700">
                                <TrendingDown className="h-3 w-3 mr-1" />
                                Decrease
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{rec.reason}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-muted-foreground">Old:</span>
                            <span className="text-sm font-medium">${rec.oldPrice.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">New:</span>
                            <span className="text-sm font-semibold">${rec.suggestedPrice.toFixed(2)}</span>
                            <span className={cn(
                              "text-xs font-medium",
                              isIncrease ? "text-green-600 dark:text-green-400" : isDecrease ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                            )}>
                              ({isIncrease ? "+" : ""}{changePercent.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <div className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center",
                            isIncrease && "bg-green-100 dark:bg-green-900/30",
                            isDecrease && "bg-red-100 dark:bg-red-900/30",
                            !isIncrease && !isDecrease && "bg-slate-100 dark:bg-slate-800"
                          )}>
                            {isIncrease && <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />}
                            {isDecrease && <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />}
                            {!isIncrease && !isDecrease && <Minus className="h-5 w-5 text-slate-600 dark:text-slate-400" />}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
