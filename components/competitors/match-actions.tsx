"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface MatchActionsProps {
  matchId: string;
  status: string;
  competitorProducts: Array<{
    id: string;
    name: string;
    sku: string;
    price: number;
  }>;
  onStatusChange: () => void;
}

export function MatchActions({ matchId, status, competitorProducts, onStatusChange }: MatchActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [showChangeModal, setShowChangeModal] = useState(false);

  const handleStatusChange = async (newStatus: "confirmed" | "rejected") => {
    setLoading(newStatus);

    try {
      const response = await fetch(`/api/product-matches/${matchId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update match status");
      }

      router.refresh();
      onStatusChange();
    } catch (error: any) {
      console.error("Error updating match status:", error);
      alert(error.message || "Failed to update match status");
    } finally {
      setLoading(null);
    }
  };

  const handleChangeCompetitorProduct = async (competitorProductId: string) => {
    setLoading("change");

    try {
      const response = await fetch(`/api/product-matches/${matchId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ competitor_product_id: competitorProductId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to change competitor product");
      }

      setShowChangeModal(false);
      router.refresh();
      onStatusChange();
    } catch (error: any) {
      console.error("Error changing competitor product:", error);
      alert(error.message || "Failed to change competitor product");
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {status.toLowerCase() !== "confirmed" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleStatusChange("confirmed")}
            disabled={loading !== null}
            className="text-xs"
          >
            {loading === "confirmed" ? (
              <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-3 w-3" />
            )}
            Confirm
          </Button>
        )}
        {status.toLowerCase() !== "rejected" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleStatusChange("rejected")}
            disabled={loading !== null}
            className="text-xs"
          >
            {loading === "rejected" ? (
              <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <XCircle className="mr-2 h-3 w-3" />
            )}
            Reject
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowChangeModal(true)}
          disabled={loading !== null}
          className="text-xs"
        >
          <RefreshCw className="mr-2 h-3 w-3" />
          Change
        </Button>
      </div>

      <Dialog open={showChangeModal} onOpenChange={setShowChangeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Competitor Product</DialogTitle>
            <DialogDescription>
              Select a different competitor product for this match.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {competitorProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No competitor products available.</p>
            ) : (
              competitorProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleChangeCompetitorProduct(product.id)}
                  disabled={loading === "change"}
                  className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
                      <p className="text-sm font-semibold">${product.price.toFixed(2)}</p>
                    </div>
                    {loading === "change" && (
                      <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


