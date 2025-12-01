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

// Mock trend data
const mockTrendData = [
  { date: "Day 1", price: 45.2, margin: 52.1 },
  { date: "Day 2", price: 46.1, margin: 53.2 },
  { date: "Day 3", price: 45.8, margin: 52.8 },
  { date: "Day 4", price: 47.2, margin: 54.1 },
  { date: "Day 5", price: 46.9, margin: 53.5 },
  { date: "Day 6", price: 48.1, margin: 55.2 },
  { date: "Day 7", price: 47.5, margin: 54.6 },
  { date: "Day 8", price: 49.2, margin: 56.1 },
  { date: "Day 9", price: 48.8, margin: 55.8 },
  { date: "Day 10", price: 50.1, margin: 57.2 },
  { date: "Day 11", price: 49.5, margin: 56.5 },
  { date: "Day 12", price: 51.2, margin: 58.1 },
  { date: "Day 13", price: 50.8, margin: 57.8 },
  { date: "Day 14", price: 52.1, margin: 59.2 },
];

// Mock sparkline data for KPI cards
const mockSparklineData = {
  revenue: [12, 14, 13, 15, 16, 15, 17],
  margin: [52, 53, 52, 54, 55, 54, 56],
  products: [120, 122, 123, 125, 126, 127, 127],
  competitors: [20, 21, 22, 23, 23, 23, 23],
};

// Mock activity timeline
const mockActivities = [
  {
    id: 1,
    icon: ArrowUpDown,
    date: "2 hours ago",
    description: "Price updated for Wireless Headphones",
  },
  {
    id: 2,
    icon: Bell,
    date: "5 hours ago",
    description: "New competitor price alert: TechStore",
  },
  {
    id: 3,
    icon: RefreshCw,
    date: "Yesterday",
    description: "Product sync completed: 127 products",
  },
];

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
  const isPositive = trend && trend.value > 0;
  const isNegative = trend && trend.value < 0;
  const maxValue = Math.max(...sparklineData);
  const minValue = Math.min(...sparklineData);
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
        <div className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{value}</div>
        {trend && (
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
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-8 py-10 lg:py-12 space-y-10">
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
              Your store is performing better than 62% of similar shops in the last 7 days.
            </p>
            <ul className="mt-3 grid gap-1 text-xs text-blue-900 dark:text-blue-100">
              <li>• Revenue this week <span className="font-semibold">↑ 4.2%</span></li>
              <li>• Competitor prices rising on several categories</li>
              <li>• <span className="font-semibold">12</span> recommendations waiting</li>
            </ul>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Revenue"
          value="$12,450"
          trend={{ value: 12, label: "vs last 7 days" }}
          icon={<DollarSign />}
          sparklineData={mockSparklineData.revenue}
        />
        <KPICard
          title="Margin"
          value="54.2%"
          trend={{ value: 4, label: "vs last 7 days" }}
          icon={<TrendingUp />}
          sparklineData={mockSparklineData.margin}
        />
        <KPICard
          title="Products synced"
          value="127"
          trend={{ value: 8, label: "vs last 7 days" }}
          icon={<Package />}
          sparklineData={mockSparklineData.products}
        />
        <KPICard
          title="Competitor activity"
          value="23"
          trend={{ value: -2, label: "vs last 7 days" }}
          icon={<Activity />}
          sparklineData={mockSparklineData.competitors}
        />
      </div>

      {/* Quick Actions */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Button className="h-16 rounded-2xl flex items-center justify-center gap-2" asChild>
          <Link href="/app/products">
            <Upload className="h-5 w-5" /> Add Products
          </Link>
        </Button>
        <Button className="h-16 rounded-2xl flex items-center justify-center gap-2" asChild>
          <Link href="/app/competitors">
            <LinkIcon className="h-5 w-5" /> Add Competitor
          </Link>
        </Button>
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
          {/* TODO: Replace with real analytics data from Supabase/API */}
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mockTrendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
              <Line
                type="monotone"
                dataKey="margin"
                stroke="#10B981"
                strokeWidth={2}
                dot={{ fill: '#10B981', r: 4 }}
                activeDot={{ r: 6 }}
                name="Average Margin %"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      <Card className="rounded-2xl bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Recent Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockActivities.map((activity) => {
              const Icon = activity.icon;
              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-slate-100 dark:bg-slate-800 p-2">
                    <Icon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{activity.description}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{activity.date}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Weekly Forecast */}
      <Card className="rounded-2xl bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <CardContent className="p-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Expected revenue next week: <span className="font-semibold text-slate-900 dark:text-slate-100">$3,200 – $3,600</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
