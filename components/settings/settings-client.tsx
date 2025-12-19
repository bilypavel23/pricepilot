"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Edit2, Save, X } from "lucide-react";
import { useTheme } from "next-themes";
import { PLAN_BADGES, type Plan } from "@/lib/planLimits";
import { cn } from "@/lib/utils";
import { CompetitorSyncCard } from "@/components/settings/competitor-sync-card";
import { ConnectStoreModal } from "@/components/integrations/connect-store-modal";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { PromoCodeForm } from "@/components/settings/promo-code-form";
import { ToastContainer, type Toast } from "@/components/ui/toast";

interface SettingsClientProps {
  userEmail: string;
  store?: any;
  storeName: string;
  currentPlan: Plan;
  planLabel: string;
  syncsPerDay: number;
  initialTimezone: string | null;
  initialTimes: string[] | null;
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
}: SettingsClientProps) {
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // TODO: Replace with real notifications settings from Supabase user preferences
  const [notifications, setNotifications] = useState({
    competitorDrops: true,
    lowMargin: true,
    weeklyReport: false,
  });

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const showSuccessToast = () => {
    const id = Date.now().toString();
    setToasts((prev) => [
      ...prev,
      {
        id,
        message: "Settings saved successfully",
        type: "success",
      },
    ]);
    // Auto-dismiss after 2.5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 2500);
  };

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

  const handleSaveStoreName = () => {
    setStoreName(tempStoreName);
    setIsEditingStoreName(false);
    // TODO: Save to Supabase
    // Update localStorage for mock persistence
    if (typeof window !== "undefined") {
      localStorage.setItem("storeName", tempStoreName);
      // Trigger custom event to update topbar (same-tab update)
      window.dispatchEvent(new CustomEvent("storeNameUpdated"));
    }
  };

  const handleCancelEdit = () => {
    setTempStoreName(storeName);
    setIsEditingStoreName(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 lg:px-8 py-10 lg:py-12 space-y-8">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account preferences and integrations</p>
      </div>

      {/* Account Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Account</CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1">Manage your account details and subscription</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Email</Label>
            <p className="text-sm text-muted-foreground">{userEmail || "Loading..."}</p>
          </div>
          <ChangePasswordForm onSuccess={showSuccessToast} />
          <div className="space-y-2">
            <Label className="text-sm font-medium">Store name</Label>
            {isEditingStoreName ? (
              <div className="flex gap-2">
                <Input
                  value={tempStoreName}
                  onChange={(e) => setTempStoreName(e.target.value)}
                  className="flex-1"
                  autoFocus
                />
                <Button size="sm" onClick={handleSaveStoreName}>
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm text-foreground font-medium">{storeName}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditingStoreName(true)}
                  className="h-7 w-7 p-0"
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium">Current plan</Label>
            <div className="pt-1 flex items-center gap-2">
              <span className="text-base">{badge.emoji}</span>
              <Badge variant={badge.variant} className={cn("text-sm", badge.color)}>
                {badge.label}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

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

      {/* Notifications Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Notifications</CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            Choose which alerts you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <div className="space-y-0.5">
              <Label htmlFor="competitor-drops" className="text-sm font-medium">Competitor price drops</Label>
              <p className="text-xs text-muted-foreground">Get notified when competitors lower their prices</p>
            </div>
            <Switch
              id="competitor-drops"
              checked={notifications.competitorDrops}
              onCheckedChange={(checked) => {
                setNotifications({ ...notifications, competitorDrops: checked });
                // TODO: Save to Supabase
                showSuccessToast();
              }}
            />
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <div className="space-y-0.5">
              <Label htmlFor="low-margin" className="text-sm font-medium">Low margin alerts</Label>
              <p className="text-xs text-muted-foreground">Alert when product margins fall below threshold</p>
            </div>
            <Switch
              id="low-margin"
              checked={notifications.lowMargin}
              onCheckedChange={(checked) => {
                setNotifications({ ...notifications, lowMargin: checked });
                // TODO: Save to Supabase
                showSuccessToast();
              }}
            />
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label htmlFor="weekly-report" className="text-sm font-medium">Weekly summary report</Label>
              <p className="text-xs text-muted-foreground">Receive weekly pricing and performance summaries</p>
            </div>
            <Switch
              id="weekly-report"
              checked={notifications.weeklyReport}
              onCheckedChange={(checked) => {
                setNotifications({ ...notifications, weeklyReport: checked });
                // TODO: Save to Supabase
                showSuccessToast();
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Competitor Sync Section */}
      <CompetitorSyncCard
        planLabel={planLabel}
        syncsPerDay={syncsPerDay}
        initialTimezone={initialTimezone}
        initialTimes={initialTimes}
        storeId={store?.id}
        onSaveSuccess={showSuccessToast}
      />

      {/* Appearance Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">Appearance</CardTitle>
          <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Choose how PricePilot looks on your device.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mounted && (
            <RadioGroup
              value={theme === "system" ? "system" : theme}
              onValueChange={(value) => {
                setTheme(value as "light" | "dark" | "system");
                showSuccessToast();
              }}
              className="flex gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="light" id="theme-light" />
                <Label htmlFor="theme-light" className="text-sm font-medium cursor-pointer">
                  Light
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="dark" id="theme-dark" />
                <Label htmlFor="theme-dark" className="text-sm font-medium cursor-pointer">
                  Dark
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="system" id="theme-system" />
                <Label htmlFor="theme-system" className="text-sm font-medium cursor-pointer">
                  System
                </Label>
              </div>
            </RadioGroup>
          )}
        </CardContent>
      </Card>

      <ConnectStoreModal open={connectModalOpen} onOpenChange={setConnectModalOpen} />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}


