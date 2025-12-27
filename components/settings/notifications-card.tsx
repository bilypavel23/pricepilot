"use client";

import { useState, memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export const NotificationsCard = memo(function NotificationsCard() {
  const [notifications, setNotifications] = useState({
    competitorDrops: true,
    lowMargin: true,
    weeklyReport: false,
  });

  const handleToggle = (key: keyof typeof notifications, checked: boolean) => {
    setNotifications((prev) => ({ ...prev, [key]: checked }));
  };

  return (
    <Card className="relative isolate">
      <CardHeader className="pointer-events-none">
        <CardTitle className="text-base font-semibold">
          Notifications
        </CardTitle>
        <CardDescription className="text-xs">
          Choose which alerts you want to receive
        </CardDescription>
        <p className="text-xs text-muted-foreground">
          Not connected yet
        </p>
      </CardHeader>

      <CardContent className="space-y-0 pointer-events-auto">
        <div className="grid grid-cols-[1fr_auto] items-center gap-4 py-3 border-b">
          <div>
            <p className="text-sm font-medium">Competitor price drops</p>
            <p className="text-xs text-muted-foreground">
              Get notified when competitors lower their prices
            </p>
          </div>

          <Switch
            checked={notifications.competitorDrops}
            onCheckedChange={(checked) =>
              handleToggle("competitorDrops", checked)
            }
            className="relative z-20"
          />
        </div>

        <div className="grid grid-cols-[1fr_auto] items-center gap-4 py-3 border-b">
          <div>
            <p className="text-sm font-medium">Low margin alerts</p>
            <p className="text-xs text-muted-foreground">
              Alert when product margins fall below threshold
            </p>
          </div>

          <Switch
            checked={notifications.lowMargin}
            onCheckedChange={(checked) =>
              handleToggle("lowMargin", checked)
            }
            className="relative z-20"
          />
        </div>

        <div className="grid grid-cols-[1fr_auto] items-center gap-4 py-3">
          <div>
            <p className="text-sm font-medium">Weekly summary report</p>
            <p className="text-xs text-muted-foreground">
              Receive weekly pricing and performance summaries
            </p>
          </div>

          <Switch
            checked={notifications.weeklyReport}
            onCheckedChange={(checked) =>
              handleToggle("weeklyReport", checked)
            }
            className="relative z-20"
          />
        </div>

        <div className="pt-4 mt-4 border-t">
          <Button disabled>Save</Button>
        </div>
      </CardContent>
    </Card>
  );
});
