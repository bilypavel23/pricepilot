"use client";

import { memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface NotificationsSectionProps {
  notifications: {
    competitorDrops: boolean;
    lowMargin: boolean;
    weeklyReport: boolean;
  };
  onToggle: (key: keyof NotificationsSectionProps["notifications"], checked: boolean) => void;
}

export const NotificationsSection = memo(function NotificationsSection({
  notifications,
  onToggle,
}: NotificationsSectionProps) {
  return (
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
            onCheckedChange={(checked) => onToggle('competitorDrops', checked)}
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
            onCheckedChange={(checked) => onToggle('lowMargin', checked)}
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
            onCheckedChange={(checked) => onToggle('weeklyReport', checked)}
          />
        </div>
      </CardContent>
    </Card>
  );
});



