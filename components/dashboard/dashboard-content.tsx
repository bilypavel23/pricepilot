"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, DollarSign, TrendingUp, Package, Activity, Upload, Link as LinkIcon, Lightbulb, ArrowUpDown, Bell, RefreshCw } from "lucide-react";
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

// Helper to format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays === 0) {
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins < 1 ? "Just now" : `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    }
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

// Helper to get icon for event type
function getEventIcon(type: string) {
  switch (type) {
    case "price_updated":
      return ArrowUpDown;
    case "products_sync":
      return RefreshCw;
    case "competitor_sync":
      return Bell;
    default:
      return Activity;
  }
}

function KPICard({ 
  title, 
  value, 
  trend, 
  icon, 
  sparklineData 
}: { 
  title: string; 
  value: string; 
  trend?: { value: number; label: string }; 
  icon: React.ReactNode;
  sparklineData: number[];
}) {
  const hasData = value !== "No data yet" && sparklineData.length > 0;
  const isPositive = trend && trend.value > 0;
  const isNegative = trend && trend.value < 0;
  const maxValue = sparklineData.length > 0 ? Math.max(...sparklineData) : 0;
  const minValue = sparklineData.length > 0 ? Math.min(...sparklineData) : 0;
  const range = maxValue - minValue || 1;

  return (
    <Card className="rounded-2xl bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800 transition-all duration-150 hover:-translate-y-[1px] hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0">{title}</CardTitle>
        <div className="opacity-70">
          {React.cloneElement(icon as React.ReactElement, {
            className: "w-4 h-4 text-slate-400 dark:text-slate-500",
          })}
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn(
          "text-2xl font-semibold tracking-tight",
          hasData ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"
        )}>
          {value}
        </div>
        {trend && hasData && (
          <p className="text-xs mt-1 flex items-center gap-1">
            {isPositive && <span className="text-emerald-500">↑</span>}
            {isNegative && <span className="text-rose-500">↓</span>}
            <span
              className={cn(
                "font-medium",
                isPositive && "text-emerald-500",
                isNegative && "text-rose-500"
              )}
            >
              {isPositive ? "+" : ""}
              {trend.value}% {trend.label}
            </span>
          </p>
        )}
        {/* Mini sparkline */}
        {hasData && sparklineData.length > 0 ? (
          <div className="mt-3 h-8 w-full flex items-end gap-0.5">
            {sparklineData.map((val, idx) => {
              const height = ((val - minValue) / range) * 100;
              return (
                <div
                  key={idx}
                  className="flex-1 bg-blue-500 dark:bg-blue-600 rounded-t"
                  style={{ height: `${Math.max(height, 10)}%` }}
                />
              );
            })}
          </div>
        ) : (
          <div className="mt-3 h-8 w-full flex items-center justify-center">
            <p className="text-xs text-slate-400 dark:text-slate-500">No data yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface DashboardMetrics {
  productsCount: number;
  competitorsCount: number;
  inventoryWorth: number;
  averageMargin: number;
  competitorActivityCount: number;
  recommendationsWaiting: number;
}

interface ChartData {
  avgPrice: number;
  avgMargin: number | null;
  hasCostData: boolean;
}

interface ActivityEvent {
  id: string;
  store_id: string;
  type: string;
  title: string;
  meta: any;
  created_at: string;
}

export function DashboardContent({ 
  isDemo, 
  store,
  products = [], 
  competitors = [],
  metrics,
  chartData,
  activityEvents = []
}: { 
  isDemo: boolean;
  store?: any;
  products?: any[];
  competitors?: any[];
  metrics?: DashboardMetrics;
  chartData?: ChartData;
  activityEvents?: ActivityEvent[];
}) {

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Use real metrics
  const inventoryWorth = metrics?.inventoryWorth ?? 0;
  const margin = metrics?.averageMargin ?? 0;
  const productsCount = metrics?.productsCount ?? 0;
  const competitorsCount = metrics?.competitorsCount ?? 0;
  const competitorActivityCount = metrics?.competitorActivityCount ?? 0;
  const recommendationsWaiting = metrics?.recommendationsWaiting ?? 0;
  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-8 py-10 lg:py-12 space-y-10">
      {/* Demo Banner */}
      {isDemo && (
        <Card className="rounded-2xl border-2 border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-500/30">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-2">
                  You're currently exploring PricePilot in demo mode.
                </h3>
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  The products and competitors you see are demo data. To connect your own store and start tracking real competitors, upgrade your plan.
                </p>
              </div>
              <Button asChild className="bg-amber-600 hover:bg-amber-700 text-white">
                <Link href="/app/pricing">Upgrade</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Welcome back! Here's what's happening with your pricing.</p>
      </div>

      {/* AI Market Summary */}
      <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/70 p-5 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/30">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-white/70 p-2 shadow-sm dark:bg-blue-900/50">
            <Bot className="h-5 w-5 text-blue-600 dark:text-blue-300" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
              AI Market Overview
            </p>
            <p className="mt-1 text-xs text-blue-800 dark:text-blue-200">
              {competitorsCount > 0 
                ? "Add competitors to unlock recommendations and price tracking."
                : "Connect competitors to start getting pricing recommendations."}
            </p>
            <ul className="mt-3 grid gap-1 text-xs text-blue-900 dark:text-blue-100">
              {productsCount > 0 ? (
                <>
                  <li>• Inventory worth: <span className="font-semibold">{formatCurrency(inventoryWorth)}</span></li>
                  <li>• {competitorsCount} competitor{competitorsCount !== 1 ? 's' : ''} tracked</li>
                  <li>• <span className="font-semibold">{recommendationsWaiting}</span> recommendation{recommendationsWaiting !== 1 ? 's' : ''} waiting</li>
                </>
              ) : (
                <li>• No data yet. Add products to see insights.</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Inventory worth"
          value={productsCount > 0 ? formatCurrency(inventoryWorth) : "No data yet"}
          trend={undefined}
          icon={<DollarSign />}
          sparklineData={productsCount > 0 ? Array(7).fill(0) : []}
        />
        <KPICard
          title="Margin"
          value={margin > 0 ? `${margin.toFixed(1)}%` : "No data yet"}
          trend={undefined}
          icon={<TrendingUp />}
          sparklineData={margin > 0 ? Array(7).fill(0) : []}
        />
        <KPICard
          title="Products synced"
          value={productsCount > 0 ? productsCount.toString() : "No data yet"}
          trend={undefined}
          icon={<Package />}
          sparklineData={productsCount > 0 ? Array(7).fill(0) : []}
        />
        <KPICard
          title="Competitor activity"
          value={competitorActivityCount > 0 ? competitorActivityCount.toString() : "0"}
          trend={undefined}
          icon={<Activity />}
          sparklineData={competitorActivityCount > 0 ? Array(7).fill(0) : Array(7).fill(0)}
        />
      </div>

      {/* Quick Actions */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {isDemo ? (
          <Button 
            className="h-16 rounded-2xl flex items-center justify-center gap-2 opacity-50 cursor-not-allowed" 
            disabled
            title="Demo mode: You can't add products. Upgrade to STARTER to connect your store."
          >
            <Upload className="h-5 w-5" /> Add Products
          </Button>
        ) : (
          <Button className="h-16 rounded-2xl flex items-center justify-center gap-2" asChild>
            <Link href="/app/products">
              <Upload className="h-5 w-5" /> Add Products
            </Link>
          </Button>
        )}
        {isDemo ? (
          <Button 
            className="h-16 rounded-2xl flex items-center justify-center gap-2 opacity-50 cursor-not-allowed" 
            disabled
            title="Demo mode: You can't add competitors. Upgrade to STARTER to connect your store."
          >
            <LinkIcon className="h-5 w-5" /> Add Competitor
          </Button>
        ) : (
          <Button className="h-16 rounded-2xl flex items-center justify-center gap-2" asChild>
            <Link href="/app/competitors">
              <LinkIcon className="h-5 w-5" /> Add Competitor
            </Link>
          </Button>
        )}
        <Button className="h-16 rounded-2xl flex items-center justify-center gap-2" asChild>
          <Link href="/app/recommendations">
            <Lightbulb className="h-5 w-5" /> Review Recommendations
          </Link>
        </Button>
      </div>

      {/* Chart Section */}
      <Card className="rounded-2xl bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800 p-8">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-base font-semibold mb-2">Price & Margin Trends (last 14 days)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {productsCount > 0 && chartData ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart 
                data={Array(14).fill(0).map((_, i) => ({
                  date: `Day ${i + 1}`,
                  price: chartData.avgPrice,
                  margin: chartData.avgMargin ?? 0,
                }))} 
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
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
                  dataKey="price"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Average Product Price ($)"
                />
                {chartData.hasCostData && chartData.avgMargin !== null && (
                  <Line
                    type="monotone"
                    dataKey="margin"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={{ fill: '#10B981', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Average Margin %"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-slate-400 dark:text-slate-500">
              <p className="text-sm">No data yet. Add products to see trends.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      <Card className="rounded-2xl bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Recent Events</CardTitle>
        </CardHeader>
        <CardContent>
          {activityEvents.length > 0 ? (
            <>
              <div className="space-y-4">
                {activityEvents.map((event) => {
                  const Icon = getEventIcon(event.type);
                  return (
                    <div key={event.id} className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full bg-slate-100 dark:bg-slate-800 p-2">
                        <Icon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{event.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {formatRelativeTime(event.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <Link
                  href="/app/events"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  Show full log of events
                </Link>
              </div>
            </>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No recent events yet.
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Apply a price or run a sync to see activity here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>


    </div>
  );
}

