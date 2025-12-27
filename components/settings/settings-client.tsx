"use client";

import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { PLAN_BADGES, type Plan } from "@/lib/planLimits";
import { cn } from "@/lib/utils";
import { CompetitorSyncCard } from "@/components/settings/competitor-sync-card";
import { ConnectStoreModal } from "@/components/integrations/connect-store-modal";
import { PromoCodeForm } from "@/components/settings/promo-code-form";
import { ToastContainer, type Toast } from "@/components/ui/toast";
import { NotificationsCard } from "@/components/settings/notifications-card";
import { AccountSection } from "@/components/settings/account-section";
import { AppearanceSection } from "@/components/settings/appearance-section";

// Memoized CompetitorSyncCard to prevent remounting
const MemoizedCompetitorSyncCard = memo(CompetitorSyncCard);

interface SettingsClientProps {
  userEmail: string;
  store?: any;
  storeName: string;
  currentPlan: Plan;
  planLabel: string;
  syncsPerDay: number;
  initialTimezone: string | null;
  initialTimes: string[] | null;
  lastCompetitorSyncAt?: string | null;
  lastCompetitorSyncStatus?: string | null;
  lastCompetitorSyncUpdatedCount?: number | null;
}

export function SettingsClient({
  userEmail,
  store,
  storeName: initialStoreName,
  currentPlan,
  planLabel,
  syncsPerDay,
  initialTimezone,
  initialTimes,
  lastCompetitorSyncAt,
  lastCompetitorSyncStatus,
  lastCompetitorSyncUpdatedCount,
}: SettingsClientProps) {
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);


  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showSuccessToast = useCallback(() => {
    const id = Date.now().toString();
    setToasts((prev) => [
      ...prev,
      {
        id,
        message: "Settings saved successfully",
        type: "success",
      },
    ]);
    // Auto-dismiss after 2 seconds
    setTimeout(() => {
      removeToast(id);
    }, 2000);
  }, [removeToast]);

  const showErrorToast = useCallback((message: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [
      ...prev,
      {
        id,
        message,
        type: "error",
      },
    ]);
    // Auto-dismiss after 3 seconds for errors
    setTimeout(() => {
      removeToast(id);
    }, 3000);
  }, [removeToast]);

  const [storeName, setStoreName] = useState(initialStoreName);
  const [isEditingStoreName, setIsEditingStoreName] = useState(false);
  const [tempStoreName, setTempStoreName] = useState(initialStoreName);

  const badge = PLAN_BADGES[currentPlan];

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load store name from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("storeName");
      if (saved) {
        setStoreName(saved);
        setTempStoreName(saved);
      }
    }
  }, []);

  // Ensure body never has overflow-y-auto/scroll (prevent double scrollbar)
  // The AppShell main element is the scroll container, not body
  // Only allow overflow: hidden when dialogs are open
  // Removed dependencies to prevent re-runs on state changes
  useEffect(() => {
    const checkAndFixBodyOverflow = () => {
      const hasOpenDialog = document.querySelector('[data-state="open"][role="dialog"]');
      const bodyStyle = window.getComputedStyle(document.body);
      const bodyOverflow = document.body.style.overflow || bodyStyle.overflow;
      
      // If no dialog is open, body should never have overflow
      if (!hasOpenDialog) {
        // Remove any overflow styles that might cause scrolling
        if (bodyOverflow && bodyOverflow !== 'hidden') {
          document.body.style.overflow = '';
          document.body.style.overflowY = '';
          document.body.style.overflowX = '';
        }
      } else {
        // Dialog is open - allow overflow: hidden but nothing else
        if (bodyOverflow && bodyOverflow !== 'hidden') {
          document.body.style.overflow = 'hidden';
        }
      }
    };

    // Check immediately
    checkAndFixBodyOverflow();
    
    // Watch for changes to body style
    const observer = new MutationObserver(() => {
      checkAndFixBodyOverflow();
    });
    
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['style'],
    });
    
    return () => {
      observer.disconnect();
    };
  }, []); // Empty deps - only run once on mount

  const handleSaveStoreName = useCallback(() => {
    setStoreName(tempStoreName);
    setIsEditingStoreName(false);
    // TODO: Save to Supabase
    // Update localStorage for mock persistence
    if (typeof window !== "undefined") {
      localStorage.setItem("storeName", tempStoreName);
      // Trigger custom event to update topbar (same-tab update)
      window.dispatchEvent(new CustomEvent("storeNameUpdated"));
    }
    showSuccessToast();
  }, [tempStoreName]);

  const handleCancelEdit = useCallback(() => {
    setTempStoreName(storeName);
    setIsEditingStoreName(false);
  }, [storeName]);


  // Memoize CompetitorSyncCard props to prevent remounting
  const competitorSyncProps = useMemo(() => ({
    planLabel,
    syncsPerDay,
    initialTimezone,
    initialTimes,
    storeId: store?.id,
    onSaveSuccess: showSuccessToast,
    onSaveError: showErrorToast,
    lastCompetitorSyncAt,
    lastCompetitorSyncStatus,
    lastCompetitorSyncUpdatedCount,
  }), [planLabel, syncsPerDay, initialTimezone, initialTimes, store?.id, showSuccessToast, showErrorToast, lastCompetitorSyncAt, lastCompetitorSyncStatus, lastCompetitorSyncUpdatedCount]);

  // Memoize section props to prevent unnecessary re-renders
  const accountSectionProps = useMemo(() => ({
    userEmail,
    storeName,
    tempStoreName,
    isEditingStoreName,
    currentPlan,
    onStoreNameChange: setTempStoreName,
    onEditStart: () => setIsEditingStoreName(true),
    onEditSave: handleSaveStoreName,
    onEditCancel: handleCancelEdit,
    onPasswordChangeSuccess: showSuccessToast,
  }), [userEmail, storeName, tempStoreName, isEditingStoreName, currentPlan, handleSaveStoreName, handleCancelEdit, showSuccessToast]);


  const appearanceSectionProps = useMemo(() => ({
    mounted,
    theme,
    onThemeChange: (value: "light" | "dark" | "system") => {
      setTheme(value);
      showSuccessToast();
    },
  }), [mounted, theme, showSuccessToast]);

  return (
    <div 
      className="max-w-4xl mx-auto px-6 lg:px-8 py-10 lg:py-12 space-y-8" 
      style={{ 
        minHeight: 'calc(100vh - 64px)', // Subtract header height (Topbar is ~64px)
        flexShrink: 0, // Prevent flex container from shrinking
      }}
    >
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account preferences and integrations</p>
      </div>

      {/* Account Section - Always mounted */}
      <AccountSection {...accountSectionProps} />

      {/* Promo Code Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Promo code</CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            Enter a promo code to unlock discounts or features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PromoCodeForm />
        </CardContent>
      </Card>

      {/* Store Connection Section */}
      <Card>
        <CardHeader>
          <CardTitle>Store Connection</CardTitle>
          <CardDescription>
            Connect your store to automatically sync products and inventory.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {store?.platform ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Connected platform:</p>
                <p className="font-semibold capitalize">{store.platform}</p>
              </div>
              {store.shop_domain && (
                <div>
                  <p className="text-sm text-muted-foreground">Domain:</p>
                  <p className="font-semibold">{store.shop_domain}</p>
                </div>
              )}
              <Button onClick={() => setConnectModalOpen(true)} variant="outline">
                Reconnect Store
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Connect your store to automatically sync products and inventory.
              </p>
              <Button onClick={() => setConnectModalOpen(true)}>
                Connect Store
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notifications Section - Always mounted, self-contained */}
      <NotificationsCard />

      {/* Competitor Sync Section - Always mounted, memoized props */}
      <MemoizedCompetitorSyncCard {...competitorSyncProps} />

      {/* Appearance Section - Always mounted */}
      <AppearanceSection {...appearanceSectionProps} />

      <ConnectStoreModal open={connectModalOpen} onOpenChange={setConnectModalOpen} />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}


