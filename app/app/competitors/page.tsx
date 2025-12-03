"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getProducts } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Globe, Plus, ExternalLink, RefreshCw, Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import {
  addCompetitorStore,
  generateMockCompetitorProducts,
  generateMockProductMatches,
  getCompetitorStores,
  getProductMatches,
} from "@/data/mockCompetitorStores";
import { ToastContainer, type Toast } from "@/components/ui/toast";
import { canAddCompetitorStore, isPlanLimitExceeded, type Plan } from "@/lib/planLimits";
import { usePlan } from "@/components/providers/plan-provider";
import { UpgradeModal } from "@/components/ui/upgrade-modal";
import { AutoMatchSheet } from "@/components/competitors/auto-match-sheet";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function CompetitorsPage() {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [stores, setStores] = useState(getCompetitorStores());
  const [globalSyncLoading, setGlobalSyncLoading] = useState(false);
  const [storeSyncLoading, setStoreSyncLoading] = useState<Record<string, boolean>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeModalData, setUpgradeModalData] = useState<{
    limitType: "products" | "stores" | "competitorsPerProduct";
    current: number;
    limit: number;
  } | null>(null);
  const [autoMatchStore, setAutoMatchStore] = useState<{ id: string; name: string } | null>(null);
  
  const currentPlan = usePlan();
  const isDemo = currentPlan === "free_demo";
  
  // Mock state for sync times
  const [lastGlobalSync, setLastGlobalSync] = useState<string>("Today, 12:34 (mock)");
  const [storeLastSync, setStoreLastSync] = useState<Record<string, string>>({});

  // TODO: Replace with real sync status from Supabase cron job logs
  const mockCompetitorSyncStatus = {
    status: "synced" as "synced" | "syncing" | "error",
    lastSync: lastGlobalSync.replace(" (mock)", ""),
  };

  // TODO: Replace with real product data from Supabase
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
  });

  // Initialize store last sync times
  useEffect(() => {
    const syncTimes: Record<string, string> = {};
    stores.forEach((store) => {
      if (!storeLastSync[store.id]) {
        const hours = Math.floor(Math.random() * 12);
        const minutes = Math.floor(Math.random() * 60);
        syncTimes[store.id] = `Today, ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} (mock)`;
      }
    });
    if (Object.keys(syncTimes).length > 0) {
      setStoreLastSync((prev) => ({ ...prev, ...syncTimes }));
    }
  }, [stores]);

  const formatTime = (date: Date): string => {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `Today, ${hours}:${minutes} (mock)`;
  };

  const handleAddStore = () => {
    if (!storeName.trim() || !storeUrl.trim()) return;

    // Check if in demo mode
    if (isDemo) {
      setToasts([
        ...toasts,
        {
          id: Date.now().toString(),
          message: "Demo mode: You can't add competitors. Upgrade to STARTER to connect your store.",
          type: "error",
        },
      ]);
      return;
    }

    // Check plan limits before adding
    const limitCheck = isPlanLimitExceeded(currentPlan, {
      totalProducts: 0, // Not checking products here
      competitorStores: stores.length,
    });

    if (limitCheck.exceeded && limitCheck.limitType === "stores") {
      setUpgradeModalData({
        limitType: limitCheck.limitType,
        current: limitCheck.current,
        limit: limitCheck.limit,
      });
      setShowUpgradeModal(true);
      return;
    }

    // TODO: Replace with real Supabase insert
    const newStore = addCompetitorStore(storeName.trim(), storeUrl.trim());
    
    // Generate mock competitor products
    const competitorProducts = generateMockCompetitorProducts(newStore.id, 5);
    
    // Generate mock product matches
    const myProducts = products.map((p) => ({ id: p.id, name: p.name }));
    generateMockProductMatches(newStore.id, myProducts, competitorProducts);
    
    // Initialize sync time for new store
    setStoreLastSync((prev) => ({
      ...prev,
      [newStore.id]: formatTime(new Date()),
    }));
    
    setStores([...getCompetitorStores()]);
    setShowAddModal(false);
    setStoreName("");
    setStoreUrl("");
    
    // Redirect to matching page
    router.push(`/app/competitors/${newStore.id}/matching`);
  };

  const handleGlobalSync = async () => {
    setGlobalSyncLoading(true);
    
    // TODO: Replace with real sync API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    setLastGlobalSync(formatTime(new Date()));
    setGlobalSyncLoading(false);
    
    setToasts([
      ...toasts,
      {
        id: Date.now().toString(),
        message: "Global competitor sync completed (mock).",
        type: "success",
      },
    ]);
  };

  const handleStoreSync = async (storeId: string, storeName: string) => {
    setStoreSyncLoading((prev) => ({ ...prev, [storeId]: true }));
    
    // TODO: Replace with real sync API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    setStoreLastSync((prev) => ({
      ...prev,
      [storeId]: formatTime(new Date()),
    }));
    
    setStoreSyncLoading((prev) => ({ ...prev, [storeId]: false }));
    
    setToasts([
      ...toasts,
      {
        id: Date.now().toString(),
        message: `Sync for ${storeName} completed (mock).`,
        type: "success",
      },
    ]);
  };

  const removeToast = (id: string) => {
    setToasts(toasts.filter((t) => t.id !== id));
  };

  const getMatchCount = (storeId: string): number => {
    const matches = getProductMatches(storeId);
    return matches.length || Math.floor(Math.random() * 8) + 5; // 5-12 if no matches
  };

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-8 py-10 lg:py-12 space-y-10">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Competitors</h1>
            <p className="text-sm text-muted-foreground mt-1">Track competitor prices and market positioning</p>
            {/* Last sync status */}
            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
              <span>
                Last sync: {mockCompetitorSyncStatus.lastSync}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-2 py-0.5",
                  mockCompetitorSyncStatus.status === "synced" && "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800",
                  mockCompetitorSyncStatus.status === "syncing" && "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-800",
                  mockCompetitorSyncStatus.status === "error" && "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800"
                )}
              >
                {mockCompetitorSyncStatus.status === "synced" && (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                    Synced
                  </>
                )}
                {mockCompetitorSyncStatus.status === "syncing" && (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 inline animate-spin" />
                    Syncing...
                  </>
                )}
                {mockCompetitorSyncStatus.status === "error" && (
                  <>
                    <AlertCircle className="h-3 w-3 mr-1 inline" />
                    Error
                  </>
                )}
              </Badge>
            </div>
          </div>
          <Button
            onClick={() => {
              if (isDemo) {
                setToasts([
                  ...toasts,
                  {
                    id: Date.now().toString(),
                    message: "Demo mode: You can't add competitors. Upgrade to STARTER to connect your store.",
                    type: "error",
                  },
                ]);
                return;
              }
              setShowAddModal(true);
            }}
            disabled={isDemo}
            className={cn("shadow-md", isDemo && "opacity-50 cursor-not-allowed")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add competitor
          </Button>
        </div>
      </div>

      {/* Global Sync Box */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Sync competitor prices</h3>
              <p className="text-sm text-muted-foreground">
                Manually trigger a refresh of competitor prices and matches. (mock)
              </p>
              <div className="flex flex-wrap gap-4 mt-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Tracked stores: </span>
                  <span className="font-medium">{stores.length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Last global sync: </span>
                  <span className="font-medium">{lastGlobalSync}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Next scheduled sync: </span>
                  <span className="font-medium">In 6 hours (mock)</span>
                </div>
              </div>
            </div>
            <Button
              onClick={handleGlobalSync}
              disabled={globalSyncLoading}
              className="shadow-md whitespace-nowrap"
            >
              {globalSyncLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Run global sync (mock)
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Competitor Stores Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Competitor Stores</CardTitle>
          <CardDescription>Manage your tracked competitor stores and review matches.</CardDescription>
        </CardHeader>
        <CardContent>
          {stores.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-6 py-10 text-center">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                No competitor data yet.
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {isDemo
                  ? "Demo competitors data is not loaded yet."
                  : "No competitor data yet. Add competitors or let PricePilot scrape them for your products."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stores.map((store) => {
                const matchCount = getMatchCount(store.id);
                const lastSync = storeLastSync[store.id] || "Never (mock)";
                const isLoading = storeSyncLoading[store.id] || false;

                return (
                  <div
                    key={store.id}
                    className="flex items-center justify-between gap-4 rounded-2xl bg-white dark:bg-card border border-slate-100 dark:border-border shadow-[0_18px_45px_rgba(15,23,42,0.06)] px-5 py-4 hover:-translate-y-[1px] hover:shadow-[0_22px_55px_rgba(15,23,42,0.10)] transition-all duration-150"
                  >
                    {/* Left: Avatar + Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                        <Globe className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{store.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{store.url}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>
                            Matched products:{" "}
                            <Badge variant="outline" className="ml-1 text-xs font-medium">
                              {matchCount}
                            </Badge>
                          </span>
                          <span>Last sync: {lastSync}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <Link href={`/app/competitors/${store.id}/matching`}>
                        <Button variant="outline" size="sm" className="text-xs">
                          <ExternalLink className="mr-2 h-3 w-3" />
                          Matches
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAutoMatchStore({ id: store.id, name: store.name })}
                        className="text-xs"
                      >
                        <Sparkles className="mr-2 h-3 w-3" />
                        Auto-match products
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStoreSync(store.id, store.name)}
                        disabled={isLoading}
                        className="text-xs"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="mr-2 h-3 w-3" />
                            Sync store (mock)
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Competitor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-lg rounded-2xl bg-white dark:bg-card shadow-xl p-6 space-y-4">
            <CardHeader className="p-0">
              <CardTitle className="text-xl font-semibold">Add competitor store</CardTitle>
              <CardDescription className="text-sm text-muted-foreground mt-1">
                Add a competitor's shop URL and we'll scan it for overlapping products (mock).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="store-name" className="text-sm font-medium text-slate-700">Store name</Label>
                <Input
                  id="store-name"
                  name="store-name"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="e.g., TechStore"
                  required
                  className="rounded-xl bg-white dark:bg-neutral-900 border border-border focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-xs transition-all duration-150"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="store-url" className="text-sm font-medium text-slate-700">Store URL</Label>
                <Input
                  id="store-url"
                  name="store-url"
                  type="url"
                  value={storeUrl}
                  onChange={(e) => setStoreUrl(e.target.value)}
                  placeholder="https://competitor-shop.com"
                  required
                  className="rounded-xl bg-white dark:bg-neutral-900 border border-border focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-xs transition-all duration-150"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleAddStore}
                  disabled={!storeName.trim() || !storeUrl.trim()}
                  className="flex-1 shadow-md"
                >
                  Scan store (mock)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddModal(false);
                    setStoreName("");
                    setStoreUrl("");
                  }}
                  className="shadow-md"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Auto-Match Sheet */}
      {autoMatchStore && (
        <AutoMatchSheet
          competitorName={autoMatchStore.name}
          competitorId={autoMatchStore.id}
          open={!!autoMatchStore}
          onOpenChange={(open) => {
            if (!open) {
              setAutoMatchStore(null);
            }
          }}
        />
      )}

      {/* Upgrade Modal */}
      {upgradeModalData && (
        <UpgradeModal
          open={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          limitType={upgradeModalData.limitType}
          current={upgradeModalData.current}
          limit={upgradeModalData.limit}
          currentPlan={currentPlan}
        />
      )}
    </div>
  );
}
