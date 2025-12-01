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
import Link from "next/link";
import { useTheme } from "next-themes";
import { PLAN_BADGES } from "@/lib/planLimits";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // TODO: Replace with real notifications settings from Supabase user preferences
  const [notifications, setNotifications] = useState({
    competitorDrops: true,
    lowMargin: true,
    weeklyReport: false,
  });

  // TODO: Replace with real user settings from Supabase
  const mockEmail = "user@example.com";
  const [storeName, setStoreName] = useState("My Store");
  const [isEditingStoreName, setIsEditingStoreName] = useState(false);
  const [tempStoreName, setTempStoreName] = useState(storeName);
  const mockPlan: "STARTER" | "PRO" | "SCALE" = "STARTER";

  const badge = PLAN_BADGES[mockPlan];

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
            <p className="text-sm text-muted-foreground">{mockEmail}</p>
          </div>
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
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, competitorDrops: checked })
              }
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
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, lowMargin: checked })
              }
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
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, weeklyReport: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

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
              onValueChange={(value) => setTheme(value as "light" | "dark" | "system")}
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
    </div>
  );
}
