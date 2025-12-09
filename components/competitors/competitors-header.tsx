"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type CompetitorsHeaderProps = {
  used: number;
  limit: number;
  onAddClick: () => void;
  planLabel?: string;
};

export function CompetitorsHeader({
  used,
  limit,
  onAddClick,
  planLabel,
}: CompetitorsHeaderProps) {
  const isFull = used >= limit;
  const ratio = limit > 0 ? used / limit : 0;
  const badgeVariant =
    ratio === 0 ? "outline" : ratio < 0.7 ? "default" : "destructive";

  const badgeText =
    limit > 0 ? `${used} / ${limit} competitors used` : `${used} competitors`;

  const helpText = isFull
    ? "Reached competitor limit for your plan."
    : "Add a competitor store to track their prices.";

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Competitors
          </h2>
          {planLabel && (
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              {planLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge
            className={cn(
              "text-xs px-2 py-0.5",
              badgeVariant === "destructive" && "bg-destructive text-destructive-foreground",
              badgeVariant === "default" && "bg-primary text-primary-foreground",
              badgeVariant === "outline" && "border border-muted-foreground/40"
            )}
          >
            {badgeText}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {helpText}
          </span>
        </div>
      </div>
      {isFull ? (
        <Tooltip side="left">
          <TooltipTrigger asChild>
            <Button
              size="sm"
              disabled={isFull}
              onClick={onAddClick}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add competitor
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p className="max-w-[220px] text-xs">
              You&apos;ve reached the competitor limit for your current plan.
              Upgrade your plan to add more competitors.
            </p>
          </TooltipContent>
        </Tooltip>
      ) : (
        <Button
          size="sm"
          disabled={isFull}
          onClick={onAddClick}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add competitor
        </Button>
      )}
    </div>
  );
}

