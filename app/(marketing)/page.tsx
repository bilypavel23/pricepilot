"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, BarChart3, Zap, Shield, Check, ArrowRight, X } from "lucide-react";
import { PLAN_BADGES, PLAN_PRODUCT_LIMITS } from "@/lib/planLimits";
import { cn } from "@/lib/utils";
import { ScreenshotGallery } from "@/components/marketing/screenshot-gallery";
import { BetaBadge } from "@/components/marketing/beta-badge";

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

function PricingSection() {
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
    <>
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-white mb-4">Simple, transparent pricing</h2>
        <p className="text-xl text-slate-400">Choose the plan that fits your store – and upgrade only when you grow.</p>
      </div>

      {/* Billing Toggle */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <Button
          variant={billingPeriod === "monthly" ? "default" : "outline"}
          onClick={() => setBillingPeriod("monthly")}
          className={cn(
            "rounded-full px-5 py-1.5 text-sm font-medium",
            billingPeriod === "monthly"
              ? "bg-blue-500 hover:bg-blue-600 text-white border-blue-500"
              : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
          )}
        >
          Monthly
        </Button>
        <Button
          variant={billingPeriod === "yearly" ? "default" : "outline"}
          onClick={() => setBillingPeriod("yearly")}
          className={cn(
            "rounded-full px-5 py-1.5 text-sm font-medium",
            billingPeriod === "yearly"
              ? "bg-blue-500 hover:bg-blue-600 text-white border-blue-500"
              : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
          )}
        >
          Yearly (save 20%)
        </Button>
      </div>

      {/* Plan Cards */}
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        {plans.map((plan) => {
          const priceInfo = getPrice(plan.monthlyPrice);
          const isPopular = plan.name === "PRO";
          const isScale = plan.name === "SCALE";
          const badge = PLAN_BADGES[plan.name];

          return (
            <div
              key={plan.name}
              className={cn(
                "relative flex flex-col h-full justify-between rounded-2xl bg-slate-900/50 border border-slate-800 transition-all duration-150 hover:-translate-y-[1px] hover:shadow-[0_22px_55px_rgba(0,0,0,0.3)]",
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
                      <CardTitle className="text-2xl text-white">{plan.name}</CardTitle>
                    </div>
                    {isPopular && (
                      <Badge variant="default" className="bg-gradient-to-r from-green-500 to-green-600">
                        Current Plan
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-4xl font-bold text-white">{priceInfo.display}</div>
                    {priceInfo.subtext && (
                      <p className="text-sm text-slate-400">
                        {priceInfo.subtext}
                      </p>
                    )}
                    <Badge variant="outline" className="mt-2 border-slate-700 text-slate-300">
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
                          <span className="text-slate-300">Shopify & CSV import</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span className="text-slate-300">Up to {PLAN_PRODUCT_LIMITS.starter} products</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span className="text-slate-300">2 competitors per product</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span className="text-slate-300">Sync frequency: 1× per day</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span className="text-slate-300">Alerts: Basic (price changes only)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span className="text-slate-300">Manual price updates</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <X className="h-4 w-4 text-slate-500" />
                          <span className="text-slate-500">No bulk updates</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <X className="h-4 w-4 text-slate-500" />
                          <span className="text-slate-500">No automation</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span className="text-slate-300">Support: Email</span>
                        </li>
                      </>
                    )}
                    {plan.name === "PRO" && (
                      <>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span className="text-slate-300">Shopify & CSV import</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span className="text-slate-300">Up to {PLAN_PRODUCT_LIMITS.pro} products</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span className="text-slate-300">5 competitors per product</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span className="text-slate-300">Sync frequency: 2× per day</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span className="text-slate-300">Alerts: Priority (price + stock changes)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span className="text-slate-300">Bulk Apply (update many products at once)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span className="text-slate-300">Automatic pricing rules</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span className="text-slate-300">Competitor out-of-stock alerts</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span className="text-slate-300">Support: Priority</span>
                        </li>
                      </>
                    )}
                    {plan.name === "SCALE" && (
                      <>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span className="text-slate-300">Shopify & CSV import</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span className="text-slate-300">{PLAN_PRODUCT_LIMITS.scale}+ products</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span className="text-slate-300">10 competitors per product</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span className="text-slate-300">Sync frequency: 4× per day</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span className="text-slate-300">Alerts: Fast / Premium</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span className="text-slate-300">Advanced automation priority</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span className="text-slate-300">Team access & API access</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span className="text-slate-300">Dedicated onboarding</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-blue-500" />
                          <span className="text-slate-300">Support: Dedicated</span>
                        </li>
                      </>
                    )}
                  </ul>
                  <Button
                    className={cn(
                      "w-full shadow-lg",
                      (isPopular || isScale) && "opacity-60 cursor-not-allowed"
                    )}
                    variant="default"
                    disabled={isPopular || isScale}
                    asChild={!isPopular && !isScale}
                  >
                    {isPopular ? (
                      <span>Current plan</span>
                    ) : isScale ? (
                      <span>Coming Soon</span>
                    ) : (
                      <Link href="/register">Upgrade</Link>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
      <p className="text-center text-sm text-slate-400">
        Need more than {PLAN_PRODUCT_LIMITS.scale} products? <Link href="#" className="text-blue-400 hover:text-blue-300">Contact us</Link> for a custom plan.
      </p>
    </>
  );
}

export default function LandingPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm">
              <Zap className="h-4 w-4" />
              AI-Powered Price Optimization for e-commerce
            </div>
            <BetaBadge />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Stop Guessing Your Prices.
            <span className="block text-blue-400">Let AI Optimize Them.</span>
          </h1>
          <p className="text-xl text-slate-400 mb-8 max-w-3xl mx-auto">
            PricePilot tracks competitor prices, analyzes your margins and market trends, and gives you clear, data-backed price recommendations – so you can increase profit without losing customers.
          </p>
          <div className="flex gap-4 justify-center mb-4">
            <Button asChild size="lg" className="bg-blue-500 hover:bg-blue-600 text-white text-lg px-8">
              <Link href="/register">Get started <ArrowRight className="ml-2 h-5 w-5 inline" /></Link>
            </Button>
            </div>
          <p className="text-sm text-slate-500 mb-2">No credit card required</p>
          <p className="text-xs text-slate-500">PricePilot is currently in beta. Features and pricing may change.</p>
          </div>

        {/* Hero Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-24">
          <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
            <TrendingUp className="h-8 w-8 text-blue-400 mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Track competitor prices automatically</h2>
          </div>
          <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
            <BarChart3 className="h-8 w-8 text-blue-400 mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">See margin impact before you apply changes</h2>
            </div>
          <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
            <Zap className="h-8 w-8 text-blue-400 mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Bulk apply safe recommendations in one click</h2>
          </div>
        </div>
      </section>

      {/* Live Product Preview Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 border-t border-slate-800">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">Live product preview (real screenshots)</h2>
          <p className="text-xl text-slate-400">See the dashboard, product catalog, and AI recommendations in action.</p>
        </div>
        <ScreenshotGallery
          images={[
            "/landing/01.png",
            "/landing/02.png",
            "/landing/03.png",
            "/landing/04.png",
          ]}
          alt="PricePilot screenshot"
        />
      </section>

      {/* Works with your stack */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 border-t border-slate-800">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">Works with your stack</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
            <h3 className="text-lg font-semibold text-white mb-2">Shopify</h3>
            <p className="text-slate-400 text-sm">Two-way sync (apply changes to your store)</p>
                    </div>
          <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
            <h3 className="text-lg font-semibold text-white mb-2">CSV Import</h3>
            <p className="text-slate-400 text-sm">Upload catalog + prices in minutes</p>
                  </div>
          <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
            <h3 className="text-lg font-semibold text-white mb-2">Feed URL</h3>
            <p className="text-slate-400 text-sm">Auto-refresh your catalog from a link</p>
        </div>
          <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
            <h3 className="text-lg font-semibold text-white mb-2">Bulk Actions</h3>
            <p className="text-slate-400 text-sm">Apply safe changes across products</p>
                  </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 border-t border-slate-800">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">Everything you need to grow profit – not just revenue</h2>
          <p className="text-xl text-slate-400">Powerful features to automate competitor tracking, protect your margins, and make better pricing decisions.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
            <Zap className="h-8 w-8 text-blue-400 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">AI Price Recommendations</h3>
            <p className="text-slate-400">Get clear, data-backed price suggestions based on competitor prices, demand signals, and your target margins.</p>
          </div>
          <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
            <TrendingUp className="h-8 w-8 text-blue-400 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Competitor Tracking</h3>
            <p className="text-slate-400">Monitor competitor stores automatically, see when they change prices, and react before it hurts your margins.</p>
          </div>
          <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
            <BarChart3 className="h-8 w-8 text-blue-400 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Margin Analytics</h3>
            <p className="text-slate-400">Understand which products drive profit, which leak margin, and where small price tweaks have the biggest impact.</p>
            </div>
          <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
            <Zap className="h-8 w-8 text-blue-400 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Auto-Sync Products</h3>
            <p className="text-slate-400">Connect feeds or your store once and keep your product catalog in sync automatically.</p>
          </div>
          <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
            <Shield className="h-8 w-8 text-blue-400 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Risk Assessment</h3>
            <p className="text-slate-400">See risk scores before applying changes so you can protect brand positioning and avoid underpricing.</p>
              </div>
          <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
            <Check className="h-8 w-8 text-blue-400 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Bulk Actions</h3>
            <p className="text-slate-400">Apply safe recommendations in bulk with one click to update hundreds of products at once.</p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 border-t border-slate-800">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">How PricePilot works in 3 simple steps</h2>
          <p className="text-xl text-slate-400">Get set up in minutes – not weeks.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">1</div>
            <h3 className="text-xl font-semibold text-white mb-2">Connect your store</h3>
            <p className="text-slate-400">Connect Shopify for automatic two-way sync, or import products via CSV or a feed URL. We&apos;ll keep your catalog and margins up to date.</p>
        </div>
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">2</div>
            <h3 className="text-xl font-semibold text-white mb-2">Add competitors</h3>
            <p className="text-slate-400">Paste competitor store URLs and let PricePilot match overlapping products automatically. Review matches once and start tracking price changes.</p>
              </div>
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">3</div>
            <h3 className="text-xl font-semibold text-white mb-2">Review & apply prices</h3>
            <p className="text-slate-400">Get AI price suggestions, preview margin impact, and apply safe changes in bulk. If Shopify is connected, updates sync back to your store.</p>
            </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 border-t border-slate-800">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">Simple, transparent pricing</h2>
          <p className="text-xl text-slate-400">Choose the plan that fits your store – and upgrade only when you grow.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="p-8 rounded-xl bg-slate-900/50 border border-slate-800">
            <h3 className="text-2xl font-semibold text-white mb-2">Starter</h3>
            <p className="text-sm text-slate-400 mb-4">Perfect for small stores</p>
            <p className="text-4xl font-bold text-white mb-6">$29<span className="text-lg text-slate-400">/mo</span></p>
            <ul className="space-y-3 text-slate-400 mb-8">
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-blue-400" /><span className="text-slate-300">Shopify & CSV import</span></li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-blue-400" /><span className="text-slate-300">Up to 50 products</span></li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-blue-400" /><span className="text-slate-300">2 competitors per product</span></li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-blue-400" /><span className="text-slate-300">Sync frequency: 1x per day</span></li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-blue-400" /><span className="text-slate-300">Alerts: Basic (price changes only)</span></li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-blue-400" /><span className="text-slate-300">Manual price updates</span></li>
              <li className="flex items-center gap-2"><X className="h-5 w-5 text-slate-500" /><span className="text-slate-500">No bulk updates</span></li>
              <li className="flex items-center gap-2"><X className="h-5 w-5 text-slate-500" /><span className="text-slate-500">No automation</span></li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-blue-400" /><span className="text-slate-300">Support: Email</span></li>
            </ul>
            <Button asChild className="w-full bg-blue-500 hover:bg-blue-600 text-white">
              <Link href="/register">Upgrade</Link>
            </Button>
          </div>
          <div className="p-8 rounded-xl bg-blue-900/50 border-2 border-blue-500 relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">Most Popular</div>
            <h3 className="text-2xl font-semibold text-white mb-2">Pro</h3>
            <p className="text-sm text-slate-400 mb-4">For growing businesses</p>
            <p className="text-4xl font-bold text-white mb-6">$79<span className="text-lg text-slate-400">/mo</span></p>
            <ul className="space-y-3 text-slate-400 mb-8">
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-blue-400" /><span className="text-slate-300">Shopify & CSV import</span></li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-blue-400" /><span className="text-slate-300">Up to 150 products</span></li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-blue-400" /><span className="text-slate-300">5 competitors per product</span></li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-blue-400" /><span className="text-slate-300">Sync frequency: 2x per day</span></li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-blue-400" /><span className="text-slate-300">Alerts: Priority (price + stock changes)</span></li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-blue-400" /><span className="text-slate-300">Bulk Apply (update many products at once)</span></li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-blue-400" /><span className="text-slate-300">Automatic pricing rules</span></li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-blue-400" /><span className="text-slate-300">Competitor out-of-stock alerts</span></li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-blue-400" /><span className="text-slate-300">Support: Priority</span></li>
            </ul>
            <Button asChild className="w-full bg-blue-500 hover:bg-blue-600 text-white">
              <Link href="/register">Get started</Link>
            </Button>
          </div>
          <div className="p-8 rounded-xl bg-slate-900/50 border border-slate-800 relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-slate-700 text-white px-4 py-1 rounded-full text-sm font-medium">Coming Soon</div>
            <h3 className="text-2xl font-semibold text-white mb-2">Scale</h3>
            <p className="text-sm text-slate-400 mb-4">For large operations</p>
            <p className="text-4xl font-bold text-white mb-6">$199<span className="text-lg text-slate-400">/mo</span></p>
            <ul className="space-y-3 text-slate-400 mb-8">
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-blue-400" /><span className="text-slate-300">Shopify & CSV import</span></li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-blue-400" /><span className="text-slate-300">300+ products</span></li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-blue-400" /><span className="text-slate-300">10 competitors per product</span></li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-blue-400" /><span className="text-slate-300">Sync frequency: 4x per day</span></li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-blue-400" /><span className="text-slate-300">Alerts: Fast / Premium</span></li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-blue-400" /><span className="text-slate-300">Advanced automation priority</span></li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-blue-400" /><span className="text-slate-300">Team access & API access</span></li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-blue-400" /><span className="text-slate-300">Dedicated onboarding</span></li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-blue-400" /><span className="text-slate-300">Support: Dedicated</span></li>
            </ul>
            <Button asChild disabled className="w-full bg-slate-700 text-slate-400 cursor-not-allowed">
              <Link href="#">Coming Soon</Link>
            </Button>
          </div>
        </div>
        <p className="text-center text-slate-400 mt-8">Need more than 300 products? <Link href="#" className="text-blue-400 hover:text-blue-300">Contact us</Link> for a custom plan.</p>
      </section>

      {/* FAQ Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 border-t border-slate-800">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">Frequently asked questions</h2>
        </div>
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
            <h3 className="text-lg font-semibold text-white mb-2">Do I need a developer to set this up?</h3>
            <p className="text-slate-400">No, PricePilot is designed to be set up in minutes without any technical knowledge.</p>
        </div>
          <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
            <h3 className="text-lg font-semibold text-white mb-2">Will PricePilot update my Shopify prices automatically?</h3>
            <p className="text-slate-400">Yes, when connected to Shopify, PricePilot can sync price changes back to your store automatically (you control when changes are applied).</p>
              </div>
          <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
            <h3 className="text-lg font-semibold text-white mb-2">What if I use CSV import or a Feed URL instead of Shopify?</h3>
            <p className="text-slate-400">PricePilot works great with CSV imports and feed URLs. You&apos;ll export recommendations and apply them manually or via your own system.</p>
            </div>
          <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
            <h3 className="text-lg font-semibold text-white mb-2">Which platforms do you support?</h3>
            <p className="text-slate-400">Currently, we support Shopify with two-way sync. CSV and feed URL imports work with any e-commerce platform.</p>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 border-t border-slate-800">
        <div className="max-w-3xl mx-auto text-center p-12 rounded-2xl bg-gradient-to-r from-blue-900/50 to-indigo-900/50 border border-blue-500/20">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to stop leaving money on the table?</h2>
          <p className="text-xl text-slate-300 mb-8">Start a 14-day free trial, connect your store in minutes, and see how much profit you&apos;re missing today.</p>
          <Button asChild size="lg" className="bg-blue-500 hover:bg-blue-600 text-white text-lg px-8">
            <Link href="/register">Get started <ArrowRight className="ml-2 h-5 w-5 inline" /></Link>
          </Button>
          <p className="text-sm text-slate-400 mt-4">No credit card required • Cancel anytime</p>
            </div>
      </section>
    </>
  );
}
