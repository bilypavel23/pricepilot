import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  trend?: {
    value: number;
    label: string;
  };
  icon?: React.ReactNode;
}

export function StatCard({ title, value, trend, icon }: StatCardProps) {
  const isPositive = trend && trend.value > 0;
  const isNegative = trend && trend.value < 0;

  return (
    <Card className="transition-all duration-150 hover:-translate-y-[1px] hover:shadow-[0_22px_55px_rgba(15,23,42,0.10)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
        <CardTitle className="text-xs font-medium text-slate-500 mb-0">{title}</CardTitle>
        {icon && (
          <div className="opacity-70">
            {React.cloneElement(icon as React.ReactElement, {
              className: "w-4 h-4 text-slate-400",
            })}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {trend && (
          <p className="text-xs mt-1 flex items-center gap-1">
            {isPositive && <ArrowUp className="h-3 w-3 text-emerald-500" />}
            {isNegative && <ArrowDown className="h-3 w-3 text-rose-500" />}
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
      </CardContent>
    </Card>
  );
}
