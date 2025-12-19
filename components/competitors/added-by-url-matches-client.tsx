"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Trash2 } from "lucide-react";

interface Match {
  matchId: string;
  productId: string;
  productName: string;
  productSku: string | null;
  competitorProductId: string;
  competitorUrl: string | null;
  competitorName: string;
  competitorDomain: string;
  competitorPrice: number | null;
}

export function AddedByUrlMatchesClient() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/competitors/added-by-url/matches");
      if (!res.ok) {
        const text = await res.text();
        console.error("[added-by-url-matches] Failed to load matches:", res.status, text);
        throw new Error(`Failed to load matches (${res.status}): ${text.substring(0, 200)}`);
      }
      const data = await res.json();
      setMatches(data.matches || []);
    } catch (err: any) {
      console.error("[added-by-url-matches] Error loading:", err);
      // Error will be shown via UI state
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (matchId: string) => {
    if (!confirm("Are you sure you want to remove this match?")) {
      return;
    }

    try {
      setDeleting(matchId);
      const res = await fetch(`/api/competitors/added-by-url/matches/${matchId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to delete match" }));
        throw new Error(data.error || `Server error (${res.status})`);
      }

      // Remove from UI
      setMatches(matches.filter((m) => m.matchId !== matchId));
      router.refresh();
    } catch (err: any) {
      console.error("[delete-match] Error:", err);
      alert(err.message || "Failed to remove match");
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p>Loading matches...</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p>No URL competitors linked yet.</p>
        <p className="text-sm mt-2">Add competitors by URL from product detail pages.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">My Product</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Competitor</th>
            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => (
            <tr key={match.matchId} className="border-b border-border hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
              <td className="py-3 px-4">
                <div>
                  <p className="text-sm font-medium">{match.productName}</p>
                  {match.productSku && (
                    <p className="text-xs text-muted-foreground mt-1">SKU: {match.productSku}</p>
                  )}
                </div>
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    {match.competitorUrl ? (
                      <a
                        href={match.competitorUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 truncate"
                      >
                        {match.competitorUrl}
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground">{match.competitorName}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-[10px] px-2 py-0">
                        {match.competitorDomain}
                      </Badge>
                      {match.competitorPrice != null && (
                        <span className="text-xs text-muted-foreground">
                          ${Number(match.competitorPrice).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </td>
              <td className="py-3 px-4 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(match.matchId)}
                  disabled={deleting === match.matchId}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

