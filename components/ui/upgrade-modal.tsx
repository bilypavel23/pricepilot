"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card";
import { Button } from "./button";
import { X } from "lucide-react";
import Link from "next/link";
import { Plan } from "@/lib/planLimits";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  limitType: "products" | "stores" | "competitorsPerProduct";
  current: number;
  limit: number;
  currentPlan: Plan;
}

export function UpgradeModal({
  open,
  onClose,
  limitType,
  current,
  limit,
  currentPlan,
}: UpgradeModalProps) {
  if (!open) return null;

  const limitMessages = {
    products: {
      title: "Product Limit Reached",
      description: `You've reached the ${limit} product limit for the ${currentPlan} plan.`,
      action: "Upgrade to add more products",
    },
    stores: {
      title: "Competitor Store Limit Reached",
      description: `You've reached the ${limit} competitor store limit for the ${currentPlan} plan.`,
      action: "Upgrade to track more stores",
    },
    competitorsPerProduct: {
      title: "Competitor Limit Reached",
      description: `You've reached the ${limit} competitors per product limit for the ${currentPlan} plan.`,
      action: "Upgrade to track more competitors",
    },
  };

  const message = limitMessages[limitType];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-lg rounded-2xl bg-white dark:bg-card shadow-xl p-6 space-y-4">
        <CardHeader className="p-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold">{message.title}</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription className="text-sm mt-1">{message.description}</CardDescription>
        </CardHeader>
        <CardContent className="p-0 space-y-4">
          <div className="bg-muted p-4 rounded-xl border border-border">
            <p className="text-sm text-muted-foreground">
              Current: <strong className="text-foreground">{current}</strong> / {limit}
            </p>
          </div>
          <div className="flex gap-3">
            <Button className="flex-1 shadow-lg" asChild>
              <Link href="/app/pricing">{message.action}</Link>
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
