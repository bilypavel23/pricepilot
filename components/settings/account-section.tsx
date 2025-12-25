"use client";

import { memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Edit2, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { PLAN_BADGES, type Plan } from "@/lib/planLimits";

interface AccountSectionProps {
  userEmail: string;
  storeName: string;
  tempStoreName: string;
  isEditingStoreName: boolean;
  currentPlan: Plan;
  onStoreNameChange: (value: string) => void;
  onEditStart: () => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onPasswordChangeSuccess: () => void;
}

export const AccountSection = memo(function AccountSection({
  userEmail,
  storeName,
  tempStoreName,
  isEditingStoreName,
  currentPlan,
  onStoreNameChange,
  onEditStart,
  onEditSave,
  onEditCancel,
  onPasswordChangeSuccess,
}: AccountSectionProps) {
  const badge = PLAN_BADGES[currentPlan];

  return (
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
        <ChangePasswordForm onSuccess={onPasswordChangeSuccess} />
        <div className="space-y-2">
          <Label className="text-sm font-medium">Store name</Label>
          {isEditingStoreName ? (
            <div className="flex gap-2">
              <Input
                value={tempStoreName}
                onChange={(e) => onStoreNameChange(e.target.value)}
                className="flex-1"
                autoFocus
              />
              <Button size="sm" onClick={onEditSave}>
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={onEditCancel}>
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
                onClick={onEditStart}
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
  );
});

