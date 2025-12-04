"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PLAN_LIMITS, PLAN_BADGES, type Plan } from "@/lib/planLimits";
import { usePlan } from "@/components/providers/plan-provider";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "STARTER" as const,
    monthlyPrice: 29,
  },
  {
    name: "PRO" as const,
    monthlyPrice: 79,
  },
  {
    name: "SCALE" as const,
    monthlyPrice: 199,
  },
];

export default function PricingPage() {
  const currentPlan = usePlan();
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  const getPrice = (monthlyPrice: number) => {
    if (billingPeriod === "yearly") {
      return {
        price: monthlyPrice * 12 * 0.8,
        display: `$${Math.round(monthlyPrice * 12 * 0.8)}/year`,
        subtext: `$${monthlyPrice}/mo billed yearly (-20%)`,
        period: "Billed yearly",
      };
    }
    return {
      price: monthlyPrice,
      display: `$${monthlyPrice}/mo`,
      subtext: "",
      period: "Monthly",
    };
  };

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-8 py-10 lg:py-12 space-y-10">
      {/* Page Header */}
      <div className="text-center space-y-4 mb-6">
        <h1 className="text-4xl font-semibold tracking-tight">Pricing</h1>
        <p className="text-muted-foreground text-lg">
          Choose the plan that's right for you
        </p>
      </div>

      {/* Billing Toggle */}
      <div className="flex items-center justify-center gap-2 mt-4">
        <Button
          variant={billingPeriod === "monthly" ? "default" : "outline"}
          onClick={() => setBillingPeriod("monthly")}
          className="rounded-full px-5 py-1.5 text-sm font-medium"
        >
          Monthly
        </Button>
        <Button
          variant={billingPeriod === "yearly" ? "default" : "outline"}
          onClick={() => setBillingPeriod("yearly")}
          className="rounded-full px-5 py-1.5 text-sm font-medium"
        >
          Yearly (save 20%)
        </Button>
      </div>

      {/* Plan Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const priceInfo = getPrice(plan.monthlyPrice);
          const isCurrent = plan.name === currentPlan;
          const isPopular = plan.name === "PRO";
          const badge = PLAN_BADGES[plan.name];
          const limits = PLAN_LIMITS[plan.name];

          return (
            <div
              key={plan.name}
              className={cn(
                "relative flex flex-col h-full justify-between rounded-2xl bg-white border border-transparent bg-clip-padding transition-all duration-150 hover:-translate-y-[1px] hover:shadow-[0_22px_55px_rgba(15,23,42,0.10)]",
                isCurrent && "border-primary border-2",
                isPopular && "before:absolute before:inset-0 before:-z-10 before:rounded-2xl before:bg-gradient-to-r before:from-blue-500/70 before:via-indigo-500/70 before:to-sky-500/70"
              )}
            >
              {isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg">
                    Most Popular
                  </Badge>
                </div>
              )}
              <Card className="h-full flex flex-col justify-between border-0 shadow-none bg-transparent">
                <CardHeader>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{badge.emoji}</span>
                      <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    </div>
                    {isCurrent && (
                      <Badge variant="default" className="bg-gradient-to-r from-green-500 to-green-600">
                        Current Plan
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-4xl font-bold">{priceInfo.display}</div>
                    {priceInfo.subtext && (
                      <p className="text-sm text-muted-foreground">
                        {priceInfo.subtext}
                      </p>
                    )}
                    <Badge variant="outline" className="mt-2">
                      {priceInfo.period}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-sm mb-6">
                    {plan.name === "STARTER" && (
                      <>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>Shopify & CSV import</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>Up to 100 products</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>2 competitors per product</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>1 store</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>Sync frequency: 1× per day</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>Alerts: Basic (price changes only)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>Manual price updates</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <X className="h-4 w-4 text-slate-400" />
                          <span className="text-muted-foreground">No bulk updates</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <X className="h-4 w-4 text-slate-400" />
                          <span className="text-muted-foreground">No automation</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>Support: Email</span>
                        </li>
                      </>
                    )}
                    {plan.name === "PRO" && (
                      <>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>Shopify & CSV import</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>Up to 1,000 products</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>5 competitors per product</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>Up to 3 stores</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>Sync frequency: 4× per day</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>Alerts: Priority (price + stock changes)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>Bulk Apply (update many products at once)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>Automatic pricing rules</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>Competitor out-of-stock alerts</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>Support: Priority</span>
                        </li>
                      </>
                    )}
                    {plan.name === "SCALE" && (
                      <>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>Shopify & CSV import</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>Up to 5,000+ products</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>Unlimited competitors per product</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>Up to 10 stores</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>Sync frequency: 6× per day / near real-time</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>Alerts: Fast / Premium</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>Advanced automation priority</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>Team access & API access</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>Dedicated onboarding</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span>Support: Dedicated</span>
                        </li>
                      </>
                    )}
                  </ul>
                  <Button
                    className="w-full shadow-lg"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isCurrent}
                  >
                    {isCurrent ? "Current Plan" : "Upgrade"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Feature Comparison Table */}
      {/* TODO: Integrate with Stripe for real plan upgrades and billing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Feature Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold">Feature</TableHead>
                <TableHead className="text-center font-semibold">STARTER</TableHead>
                <TableHead className="text-center font-semibold">PRO</TableHead>
                <TableHead className="text-center font-semibold">SCALE</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer">
                <TableCell className="font-medium">Products limit</TableCell>
                <TableCell className="text-center">100</TableCell>
                <TableCell className="text-center">1,000</TableCell>
                <TableCell className="text-center">5,000+</TableCell>
              </TableRow>
              <TableRow className="hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer">
                <TableCell className="font-medium">Stores</TableCell>
                <TableCell className="text-center">1</TableCell>
                <TableCell className="text-center">3</TableCell>
                <TableCell className="text-center">10</TableCell>
              </TableRow>
              <TableRow className="hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer">
                <TableCell className="font-medium">Competitors per product</TableCell>
                <TableCell className="text-center">2</TableCell>
                <TableCell className="text-center">5</TableCell>
                <TableCell className="text-center">Unlimited</TableCell>
              </TableRow>
              <TableRow className="hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer">
                <TableCell className="font-medium">Sync frequency</TableCell>
                <TableCell className="text-center">1×/day</TableCell>
                <TableCell className="text-center">4×/day</TableCell>
                <TableCell className="text-center">
                  <span className="whitespace-nowrap">6×/day / near real-time</span>
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer">
                <TableCell className="font-medium">Shopify & CSV import</TableCell>
                <TableCell className="text-center">
                  <Check className="h-4 w-4 text-blue-500 mx-auto" />
                </TableCell>
                <TableCell className="text-center">
                  <Check className="h-4 w-4 text-blue-500 mx-auto" />
                </TableCell>
                <TableCell className="text-center">
                  <Check className="h-4 w-4 text-blue-500 mx-auto" />
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer">
                <TableCell className="font-medium">Manual price updates</TableCell>
                <TableCell className="text-center">
                  <Check className="h-4 w-4 text-blue-500 mx-auto" />
                </TableCell>
                <TableCell className="text-center">
                  <Check className="h-4 w-4 text-blue-500 mx-auto" />
                </TableCell>
                <TableCell className="text-center">
                  <Check className="h-4 w-4 text-blue-500 mx-auto" />
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer">
                <TableCell className="font-medium">Bulk Apply</TableCell>
                <TableCell className="text-center">
                  <X className="h-4 w-4 text-slate-400 mx-auto" />
                </TableCell>
                <TableCell className="text-center">
                  <Check className="h-4 w-4 text-blue-500 mx-auto" />
                </TableCell>
                <TableCell className="text-center">
                  <Check className="h-4 w-4 text-blue-500 mx-auto" />
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer">
                <TableCell className="font-medium">Automatic pricing rules</TableCell>
                <TableCell className="text-center">
                  <X className="h-4 w-4 text-slate-400 mx-auto" />
                </TableCell>
                <TableCell className="text-center">
                  <Check className="h-4 w-4 text-blue-500 mx-auto" />
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Check className="h-4 w-4 text-blue-500" />
                    <span className="text-blue-600 dark:text-blue-400">Advanced</span>
                  </div>
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer">
                <TableCell className="font-medium">Competitor price alerts</TableCell>
                <TableCell className="text-center">Basic</TableCell>
                <TableCell className="text-center">Priority</TableCell>
                <TableCell className="text-center">Fast / Premium</TableCell>
              </TableRow>
              <TableRow className="hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer">
                <TableCell className="font-medium">Competitor out-of-stock alerts</TableCell>
                <TableCell className="text-center">
                  <X className="h-4 w-4 text-slate-400 mx-auto" />
                </TableCell>
                <TableCell className="text-center">
                  <Check className="h-4 w-4 text-blue-500 mx-auto" />
                </TableCell>
                <TableCell className="text-center">
                  <Check className="h-4 w-4 text-blue-500 mx-auto" />
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer">
                <TableCell className="font-medium">Min/Max margin protection</TableCell>
                <TableCell className="text-center">
                  <X className="h-4 w-4 text-slate-400 mx-auto" />
                </TableCell>
                <TableCell className="text-center">
                  <Check className="h-4 w-4 text-blue-500 mx-auto" />
                </TableCell>
                <TableCell className="text-center">
                  <Check className="h-4 w-4 text-blue-500 mx-auto" />
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer">
                <TableCell className="font-medium">Automation priority</TableCell>
                <TableCell className="text-center">
                  <X className="h-4 w-4 text-slate-400 mx-auto" />
                </TableCell>
                <TableCell className="text-center">Standard</TableCell>
                <TableCell className="text-center">
                  <span className="whitespace-nowrap">Priority queue</span>
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer">
                <TableCell className="font-medium">Team access</TableCell>
                <TableCell className="text-center">
                  <X className="h-4 w-4 text-slate-400 mx-auto" />
                </TableCell>
                <TableCell className="text-center">
                  <X className="h-4 w-4 text-slate-400 mx-auto" />
                </TableCell>
                <TableCell className="text-center">
                  <Check className="h-4 w-4 text-blue-500 mx-auto" />
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer">
                <TableCell className="font-medium">API access</TableCell>
                <TableCell className="text-center">
                  <X className="h-4 w-4 text-slate-400 mx-auto" />
                </TableCell>
                <TableCell className="text-center">
                  <X className="h-4 w-4 text-slate-400 mx-auto" />
                </TableCell>
                <TableCell className="text-center">
                  <Check className="h-4 w-4 text-blue-500 mx-auto" />
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer">
                <TableCell className="font-medium">Support</TableCell>
                <TableCell className="text-center">Email</TableCell>
                <TableCell className="text-center">Priority</TableCell>
                <TableCell className="text-center">Dedicated</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        You can change or cancel your plan at any time.
      </p>
    </div>
  );
}
