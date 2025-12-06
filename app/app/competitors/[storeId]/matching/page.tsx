"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getProducts } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  getCompetitorStore,
  getCompetitorProducts,
  getProductMatches,
  updateProductMatchStatus,
  updateProductMatchCompetitor,
} from "@/data/mockCompetitorStores";
import type { ProductMatch, CompetitorProduct } from "@/types";

export default function MatchingPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = use(params);
  const router = useRouter();
  const [matches, setMatches] = useState<ProductMatch[]>([]);
  const [competitorProducts, setCompetitorProducts] = useState<CompetitorProduct[]>([]);
  const [store, setStore] = useState(getCompetitorStore(storeId));
  const [showChangeModal, setShowChangeModal] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  const { data: myProducts = [] } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
  });

  useEffect(() => {
    if (!store) {
      router.push("/app/competitors");
      return;
    }

    const products = getCompetitorProducts(storeId);
    const productMatches = getProductMatches(storeId);
    setCompetitorProducts(products);
    setMatches(productMatches);
  }, [storeId, router, store]);

  const handleConfirm = (matchId: string) => {
    updateProductMatchStatus(matchId, "CONFIRMED");
    setMatches(getProductMatches(storeId));
  };

  const handleReject = (matchId: string) => {
    updateProductMatchStatus(matchId, "REJECTED");
    setMatches(getProductMatches(storeId));
  };

  const handleChange = (matchId: string) => {
    setSelectedMatchId(matchId);
    setShowChangeModal(matchId);
  };

  const handleSelectCompetitorProduct = (competitorProductId: string) => {
    if (selectedMatchId) {
      updateProductMatchCompetitor(selectedMatchId, competitorProductId);
      setMatches(getProductMatches(storeId));
      setShowChangeModal(null);
      setSelectedMatchId(null);
    }
  };

  if (!store) {
    return null;
  }

  const getMyProduct = (productId: string) => {
    return myProducts.find((p) => p.id === productId);
  };

  const getCompetitorProduct = (productId: string) => {
    return competitorProducts.find((p) => p.id === productId);
  };

  const getStatusBadge = (status: ProductMatch["status"]) => {
    const variants = {
      AUTO_MATCHED: "bg-emerald-500/20 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
      PENDING: "bg-amber-500/20 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
      CONFIRMED: "bg-blue-500/20 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      REJECTED: "bg-slate-500/20 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300",
    };

    const labels = {
      AUTO_MATCHED: "Auto-matched",
      PENDING: "Needs review",
      CONFIRMED: "Confirmed",
      REJECTED: "Rejected",
    };

    return (
      <Badge className={cn("text-xs font-medium px-2 py-0.5 rounded-full", variants[status])}>
        {labels[status]}
      </Badge>
    );
  };

  const getConfidenceBadge = (confidence: number) => {
    let variant = "bg-slate-500/20 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300";
    if (confidence > 0.9) {
      variant = "bg-emerald-500/20 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    } else if (confidence >= 0.75) {
      variant = "bg-amber-500/20 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    }

    return (
      <Badge className={cn("text-xs font-medium px-2 py-0.5 rounded-full", variant)}>
        {Math.round(confidence * 100)}% match
      </Badge>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-8 py-10 lg:py-12 space-y-10">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/app/competitors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to competitors
          </Link>
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Match products</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Review suggested matches between your catalog and this competitor store.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline" className="text-sm">
              {store.name}
            </Badge>
          </div>
        </div>
      </div>

      {/* Matches List */}
      <Card>
        <CardHeader>
          <CardTitle>Product Matches</CardTitle>
          <CardDescription>Review and confirm product matches with this competitor store</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {matches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No matches found. Add products to your catalog first.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {matches.map((match) => {
                const myProduct = getMyProduct(match.myProductId);
                const competitorProduct = getCompetitorProduct(match.competitorProductId);

                if (!myProduct || !competitorProduct) return null;

                return (
                  <div
                    key={match.id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/20 transition-colors"
                  >
                    {/* Your Product */}
                    <div className="md:col-span-4 space-y-1">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Your product</p>
                      <p className="font-semibold text-foreground">{myProduct.name}</p>
                      <p className="text-sm text-muted-foreground">SKU: {myProduct.sku}</p>
                      <p className="text-sm font-medium text-foreground">${myProduct.currentPrice.toFixed(2)}</p>
                    </div>

                    {/* Competitor Product */}
                    <div className="md:col-span-4 space-y-1">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Suggested competitor product</p>
                      <p className="font-semibold text-foreground">{competitorProduct.name}</p>
                      {competitorProduct.sku && (
                        <p className="text-sm text-muted-foreground">SKU: {competitorProduct.sku}</p>
                      )}
                      <p className="text-sm font-medium text-foreground">${competitorProduct.price.toFixed(2)}</p>
                    </div>

                    {/* Confidence & Status */}
                    <div className="md:col-span-4 space-y-3">
                      <div className="flex flex-col gap-2">
                        {getConfidenceBadge(match.confidence)}
                        {getStatusBadge(match.status)}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {match.status !== "CONFIRMED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleConfirm(match.id)}
                            className="text-xs px-3 py-1"
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Confirm
                          </Button>
                        )}
                        {match.status !== "REJECTED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(match.id)}
                            className="text-xs px-3 py-1"
                          >
                            <XCircle className="mr-1 h-3 w-3" />
                            Reject
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleChange(match.id)}
                          className="text-xs px-3 py-1"
                        >
                          <RefreshCw className="mr-1 h-3 w-3" />
                          Change
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Competitor Product Modal */}
      {showChangeModal && selectedMatchId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md rounded-2xl bg-white dark:bg-card shadow-xl p-6 space-y-4">
            <CardHeader className="p-0">
              <CardTitle className="text-lg font-semibold">Change competitor product</CardTitle>
              <CardDescription className="text-sm text-muted-foreground mt-1">
                Select a different competitor product for this match.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-2 max-h-96 overflow-y-auto">
              {competitorProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleSelectCompetitorProduct(product.id)}
                  className="w-full text-left p-3 rounded-xl border border-border hover:bg-muted/50 transition-colors"
                >
                  <p className="font-medium text-foreground">{product.name}</p>
                  {product.sku && (
                    <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
                  )}
                  <p className="text-sm font-semibold text-foreground mt-1">${product.price.toFixed(2)}</p>
                </button>
              ))}
            </CardContent>
            <div className="pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowChangeModal(null);
                  setSelectedMatchId(null);
                }}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

