"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp } from "lucide-react";

interface CompetitorProduct {
  id: string;
  name: string | null;
  url: string | null;
  price: number | null;
  updated_at: string | null;
}

interface UrlCompetitor {
  id: string;
  name: string;
  url: string;
  domain: string | null;
  competitorProducts: CompetitorProduct[];
  linkedProductsCount: number;
}

export function UrlCompetitorCard({ competitor, firstLetter }: { competitor: UrlCompetitor; firstLetter: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-slate-50/50 dark:bg-slate-800/50">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-semibold text-sm">{firstLetter}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">{competitor.name}</p>
              <Badge variant="secondary" className="text-[10px] px-2 py-0">
                Added by URL
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">{competitor.url}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span>
                {competitor.linkedProductsCount} linked product{competitor.linkedProductsCount !== 1 ? "s" : ""}
              </span>
              {competitor.competitorProducts.length > 0 && (
                <span>
                  {competitor.competitorProducts.length} product{competitor.competitorProducts.length !== 1 ? "s" : ""} added
                </span>
              )}
            </div>
          </div>
        </div>
        <button className="flex-shrink-0 p-1">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>
      {isExpanded && competitor.competitorProducts.length > 0 && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-2">
          {competitor.competitorProducts.map((cp) => (
            <div
              key={cp.id}
              className="flex items-center justify-between p-2 rounded bg-background border border-border"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{cp.name || "Unnamed product"}</p>
                {cp.url && (
                  <a
                    href={cp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {cp.url}
                  </a>
                )}
              </div>
              <div className="text-right ml-3">
                {cp.price != null ? (
                  <p className="text-sm font-semibold">${Number(cp.price).toFixed(2)}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">No price</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


