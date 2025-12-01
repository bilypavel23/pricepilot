"use client";

import * as React from "react";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Sparkles, 
  CheckCircle2, 
  X, 
  Loader2, 
  ArrowRight,
  Package,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getProducts } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

type AutoMatchSheetProps = {
  competitorName: string;
  competitorId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Mock competitor products
const mockCompetitorProducts = [
  { id: "cp1", name: "Wireless Headphones Pro", price: 74.99 },
  { id: "cp2", name: "4K Monitor 27\"", price: 299.99 },
  { id: "cp3", name: "USB-C Charger 65W", price: 19.99 },
  { id: "cp4", name: "Mechanical Keyboard RGB", price: 129.99 },
  { id: "cp5", name: "Laptop Stand Aluminum", price: 49.99 },
];

// Mock matching logic
function generateMatches(myProducts: any[], competitorProducts: typeof mockCompetitorProducts) {
  const matches: Array<{
    myProductId: string;
    myProductName: string;
    competitorProductId: string;
    competitorProductName: string;
    confidence: number;
    status: "pending" | "confirmed" | "rejected";
  }> = [];

  // Simple matching: match by similar names or index
  myProducts.forEach((myProduct, idx) => {
    const competitorProduct = competitorProducts[idx % competitorProducts.length];
    if (competitorProduct) {
      const confidence = 0.7 + Math.random() * 0.25; // 0.7 - 0.95
      matches.push({
        myProductId: myProduct.id,
        myProductName: myProduct.name,
        competitorProductId: competitorProduct.id,
        competitorProductName: competitorProduct.name,
        confidence,
        status: confidence >= 0.9 ? "confirmed" : "pending",
      });
    }
  });

  return matches;
}

export function AutoMatchSheet({ competitorName, competitorId, open, onOpenChange }: AutoMatchSheetProps) {
  const [step, setStep] = useState<"scanning" | "review" | "complete">("scanning");
  const [matches, setMatches] = useState<ReturnType<typeof generateMatches>>([]);
  const [confirmedMatches, setConfirmedMatches] = useState<Set<string>>(new Set());

  // TODO: Replace with real product data from Supabase
  const { data: myProducts = [] } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
  });

  React.useEffect(() => {
    if (open && step === "scanning") {
      // Simulate scanning
      const timer = setTimeout(() => {
        const generatedMatches = generateMatches(myProducts, mockCompetitorProducts);
        setMatches(generatedMatches);
        // Auto-confirm high confidence matches
        const autoConfirmed = generatedMatches
          .filter(m => m.confidence >= 0.9)
          .map(m => m.myProductId);
        setConfirmedMatches(new Set(autoConfirmed));
        setStep("review");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [open, step, myProducts]);

  const handleConfirm = (myProductId: string) => {
    setConfirmedMatches(prev => new Set([...prev, myProductId]));
  };

  const handleReject = (myProductId: string) => {
    setConfirmedMatches(prev => {
      const next = new Set(prev);
      next.delete(myProductId);
      return next;
    });
  };

  const handleComplete = () => {
    setStep("complete");
    setTimeout(() => {
      onOpenChange(false);
      setStep("scanning");
      setMatches([]);
      setConfirmedMatches(new Set());
    }, 2000);
  };

  const pendingMatches = matches.filter(m => !confirmedMatches.has(m.myProductId) && m.status !== "rejected");
  const allConfirmed = matches.length > 0 && pendingMatches.length === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetClose />
        <SheetHeader className="pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <SheetTitle>Auto-Match Products</SheetTitle>
              <SheetDescription>
                AI-powered product matching for {competitorName}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {step === "scanning" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold">Scanning competitor store...</p>
                <p className="text-sm text-muted-foreground">
                  Analyzing products and finding matches
                </p>
              </div>
            </div>
          )}

          {step === "review" && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">
                    Found {matches.length} potential matches
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {confirmedMatches.size} confirmed, {pendingMatches.length} pending review
                  </p>
                </div>
                <Button
                  onClick={handleComplete}
                  disabled={!allConfirmed}
                  className="shadow-md"
                >
                  {allConfirmed ? (
                    <>
                      Complete matching
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  ) : (
                    "Review all matches first"
                  )}
                </Button>
              </div>

              <div className="space-y-3">
                {matches.map((match) => {
                  const isConfirmed = confirmedMatches.has(match.myProductId);
                  const isRejected = match.status === "rejected";
                  const confidencePercent = Math.round(match.confidence * 100);

                  return (
                    <Card
                      key={match.myProductId}
                      className={cn(
                        "rounded-xl border transition-all",
                        isConfirmed && "bg-green-50/50 dark:bg-green-950/10 border-green-200 dark:border-green-800",
                        isRejected && "bg-red-50/50 dark:bg-red-950/10 border-red-200 dark:border-red-800",
                        !isConfirmed && !isRejected && "bg-white dark:bg-slate-900 border-border"
                      )}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-slate-400" />
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  {match.myProductName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Your product
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-6">
                              <ArrowRight className="h-4 w-4 text-slate-400" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                  {match.competitorProductName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Competitor product
                                </p>
                              </div>
                            </div>
                            <div className="ml-6 mt-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  match.confidence >= 0.9 && "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-700",
                                  match.confidence >= 0.75 && match.confidence < 0.9 && "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-700",
                                  match.confidence < 0.75 && "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                                )}
                              >
                                {confidencePercent}% confidence
                              </Badge>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            {isConfirmed ? (
                              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                                <CheckCircle2 className="h-5 w-5" />
                                <span className="text-xs font-medium">Confirmed</span>
                              </div>
                            ) : isRejected ? (
                              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                <X className="h-5 w-5" />
                                <span className="text-xs font-medium">Rejected</span>
                              </div>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleConfirm(match.myProductId)}
                                  className="text-xs"
                                >
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  Confirm
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReject(match.myProductId)}
                                  className="text-xs"
                                >
                                  <X className="mr-1 h-3 w-3" />
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}

          {step === "complete" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold">Matching complete!</p>
                <p className="text-sm text-muted-foreground">
                  {confirmedMatches.size} products matched successfully
                </p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

