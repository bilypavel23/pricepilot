"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function NotificationsCard() {
  // Local state only - no server calls, no router refresh
  const [notifications, setNotifications] = useState({
    competitorDrops: true,
    lowMargin: true,
    weeklyReport: false,
  });

  const handleToggle = (key: keyof typeof notifications, checked: boolean) => {
    // Update local state only - no side effects
    setNotifications((prev) => ({ ...prev, [key]: checked }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Notifications</CardTitle>
        <CardDescription className="text-xs text-muted-foreground mt-1">
          Choose which alerts you want to receive
        </CardDescription>
        <p className="text-xs text-muted-foreground mt-1">Not connected yet</p>
      </CardHeader>
      <CardContent className="space-y-0">
        {/* Row 1: Competitor price drops */}
        <div className="flex items-center justify-between py-3 border-b border-border">
          <div className="flex-1 pr-4">
            <Label htmlFor="competitor-drops" className="text-sm font-medium">
              Competitor price drops
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Get notified when competitors lower their prices
            </p>
          </div>
          <div className="flex-shrink-0">
            <Switch
              id="competitor-drops"
              checked={notifications.competitorDrops}
              onCheckedChange={(checked) => handleToggle('competitorDrops', checked)}
            />
          </div>
        </div>

        {/* Row 2: Low margin alerts */}
        <div className="flex items-center justify-between py-3 border-b border-border">
          <div className="flex-1 pr-4">
            <Label htmlFor="low-margin" className="text-sm font-medium">
              Low margin alerts
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Alert when product margins fall below threshold
            </p>
          </div>
          <div className="flex-shrink-0">
            <Switch
              id="low-margin"
              checked={notifications.lowMargin}
              onCheckedChange={(checked) => handleToggle('lowMargin', checked)}
            />
          </div>
        </div>

        {/* Row 3: Weekly summary report */}
        <div className="flex items-center justify-between py-3">
          <div className="flex-1 pr-4">
            <Label htmlFor="weekly-report" className="text-sm font-medium">
              Weekly summary report
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Receive weekly pricing and performance summaries
            </p>
          </div>
          <div className="flex-shrink-0">
            <Switch
              id="weekly-report"
              checked={notifications.weeklyReport}
              onCheckedChange={(checked) => handleToggle('weeklyReport', checked)}
            />
          </div>
        </div>

        {/* Save button - disabled, stable height */}
        <div className="pt-4 mt-4 border-t border-border">
          <Button type="button" disabled className="w-full sm:w-auto">
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

