"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import {
  Sparkles,
  TrendingUp,
  BarChart3,
  Zap,
  Shield,
  CheckCircle2,
  LineChart,
  Store,
  FileSpreadsheet,
  Link as LinkIcon,
  Layers,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Image from "next/image";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  const [activeImageSrc, setActiveImageSrc] = useState<string | null>(null);
  
  // Preview navigation state
  const previews = [
    { id: "dashboard", label: "Dashboard overview", image: "/landing/preview-dashboard.png", alt: "Dashboard overview showing market overview, margin health, and next actions", caption: "Market overview, margin health, and next actions" },
    { id: "products", label: "Products table", image: "/landing/preview-products.png", alt: "Products table showing full catalog with price, cost, margin, inventory", caption: "Full catalog with price, cost, margin, inventory" },
    { id: "recommendations", label: "Recommendations", image: "/landing/preview-recommendations.png", alt: "Recommendations showing safe suggestions and bulk apply workflow", caption: "Safe suggestions and bulk apply workflow" },
  ];
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeImageSrc) {
        setActiveImageSrc(null);
      }
    };

    if (activeImageSrc) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [activeImageSrc]);

  const handleImageClick = (src: string) => {
    setActiveImageSrc(src);
  };

  const handleCloseModal = () => {
    setActiveImageSrc(null);
  };

  // Preview navigation functions
  const goToPrevious = () => {
    setActivePreviewIndex((prev) => (prev === 0 ? previews.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setActivePreviewIndex((prev) => (prev === previews.length - 1 ? 0 : prev + 1));
  };

  const handlePreviewTabChange = (value: string) => {
    const index = previews.findIndex((p) => p.id === value);
    if (index !== -1) {
      setActivePreviewIndex(index);
    }
  };

  // Keyboard navigation for preview section
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle arrow keys when not in a modal
      if (activeImageSrc) return;
      
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActivePreviewIndex((prev) => (prev === 0 ? previews.length - 1 : prev - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setActivePreviewIndex((prev) => (prev === previews.length - 1 ? 0 : prev + 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeImageSrc, previews.length]);

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
        <div className="mx-auto max-w-[900px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/50 px-4 py-1.5 text-xs sm:text-sm text-slate-300 mb-4">
            <span>⚡</span>
            <span>AI-Powered Price Optimization for e-commerce</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-6">
            Stop Guessing Your Prices.
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Let AI Show You Where You're Leaving Money on the Table.
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg sm:text-xl text-gray-300 leading-relaxed mb-8">
            Track competitors, understand your margins, and apply data-backed price recommendations — without losing customers.
          </p>
          
          {/* Benefit Pill Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-8 max-w-4xl mx-auto">
            <div className="flex items-start gap-3 px-4 py-3 rounded-full border border-slate-800 bg-slate-900/50 backdrop-blur-sm w-full min-h-[52px]">
              <TrendingUp className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <span className="text-xs sm:text-sm text-slate-300 leading-tight break-words line-clamp-2">See competitor prices without manual tracking</span>
            </div>
            <div className="flex items-start gap-3 px-4 py-3 rounded-full border border-slate-800 bg-slate-900/50 backdrop-blur-sm w-full min-h-[52px]">
              <BarChart3 className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <span className="text-xs sm:text-sm text-slate-300 leading-tight break-words line-clamp-2">See margin impact before you apply changes</span>
            </div>
            <div className="flex items-start gap-3 px-4 py-3 rounded-full border border-slate-800 bg-slate-900/50 backdrop-blur-sm w-full min-h-[52px]">
              <Zap className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <span className="text-xs sm:text-sm text-slate-300 leading-tight break-words line-clamp-2">Bulk apply safe recommendations in one click</span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-2.5">
            <Button
              asChild
              className="px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center gap-2 shadow-md transition"
            >
              <Link href="/register">
                Get started
                <span>→</span>
              </Link>
            </Button>
            <p className="text-xs text-gray-400 text-center">
              No credit card required
            </p>
          </div>
        </div>
      </section>

      {/* Live Product Preview Section */}
      <section id="preview" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Live product preview (real screenshots)
          </h2>
          <p className="text-lg text-slate-400">
            See the dashboard, product catalog, and AI recommendations in action.
          </p>
        </div>
        <div className="max-w-5xl mx-auto">
          <Tabs 
            value={previews[activePreviewIndex].id} 
            onValueChange={handlePreviewTabChange}
            className="w-full"
          >
            <div className="flex justify-center mb-8">
              <TabsList>
                <TabsTrigger value="dashboard">Dashboard overview</TabsTrigger>
                <TabsTrigger value="products">Products table</TabsTrigger>
                <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
              </TabsList>
            </div>
            
            {/* Preview container with arrows */}
            <div className="relative group">
              {/* Left Arrow */}
              <button
                onClick={goToPrevious}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 md:-translate-x-16 z-10 
                         w-10 h-10 md:w-12 md:h-12 rounded-full 
                         bg-black/60 backdrop-blur-md border border-white/20
                         flex items-center justify-center
                         text-white hover:text-blue-400
                         opacity-0 group-hover:opacity-100 transition-all duration-200
                         hover:bg-black/80 hover:border-white/30 hover:scale-110
                         shadow-xl"
                aria-label="Previous preview"
              >
                <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
              </button>

              {/* Right Arrow */}
              <button
                onClick={goToNext}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 md:translate-x-16 z-10
                         w-10 h-10 md:w-12 md:h-12 rounded-full
                         bg-black/60 backdrop-blur-md border border-white/20
                         flex items-center justify-center
                         text-white hover:text-blue-400
                         opacity-0 group-hover:opacity-100 transition-all duration-200
                         hover:bg-black/80 hover:border-white/30 hover:scale-110
                         shadow-xl"
                aria-label="Next preview"
              >
                <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
              </button>

              {/* Preview Content */}
              <div className="transition-opacity duration-300">
                {previews.map((preview, index) => (
                  <TabsContent key={preview.id} value={preview.id}>
                    <div className="space-y-4">
                      <div 
                        onClick={() => handleImageClick(preview.image)}
                        className="relative w-full aspect-video rounded-lg overflow-hidden border border-white/10 bg-[#111726] shadow-[0_0_40px_rgba(0,0,0,0.45)] cursor-zoom-in transition-transform hover:scale-[1.02]"
                      >
                        <Image
                          src={preview.image}
                          alt={preview.alt}
                          fill
                          className="object-contain transition-opacity duration-300"
                          priority={index === 0}
                        />
                      </div>
                      <p className="text-center text-sm text-slate-400">
                        {preview.caption}
                      </p>
                    </div>
                  </TabsContent>
                ))}
              </div>
            </div>
          </Tabs>
        </div>
      </section>

      {/* Works with your stack Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Works with your stack
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
          {[
            {
              icon: Store,
              label: "Shopify",
              description: "Two-way sync (apply changes to your store)",
            },
            {
              icon: FileSpreadsheet,
              label: "CSV Import",
              description: "Upload catalog + prices in minutes",
            },
            {
              icon: LinkIcon,
              label: "Feed URL",
              description: "Auto-refresh your catalog from a link",
              helper: "Ideal for suppliers & large catalogs",
            },
            {
              icon: Layers,
              label: "Bulk Actions",
              description: "Apply safe changes across products",
            },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <Card
                key={idx}
                className="border-slate-800 bg-slate-900/50 hover:bg-slate-900/70 hover:-translate-y-1 transition-all duration-200"
              >
                <CardContent className="p-6 text-center">
                  <div className="mb-4 flex justify-center">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <Icon className="h-6 w-6 text-blue-400" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{item.label}</h3>
                  <p className="text-sm text-slate-400">{item.description}</p>
                  {(item as any).helper && (
                    <p className="text-xs text-slate-500 mt-1.5">{(item as any).helper}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Feature Grid Section */}
      <section id="features" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Everything you need to grow profit – not just revenue
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-400">
            Powerful features to automate competitor tracking, protect your margins, and make better pricing decisions.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Sparkles,
              title: "AI Price Recommendations",
              description: "Get clear, data-backed price suggestions based on competitor prices, demand signals, and your target margins.",
            },
            {
              icon: TrendingUp,
              title: "Competitor Tracking",
              description: "Monitor competitor stores automatically, see when they change prices, and react before it hurts your margins.",
            },
            {
              icon: BarChart3,
              title: "Margin Analytics",
              description: "Understand which products drive profit, which leak margin, and where small price tweaks have the biggest impact.",
            },
            {
              icon: Zap,
              title: "Auto-Sync Products",
              description: "Connect feeds or your store once and keep your product catalog in sync automatically.",
            },
            {
              icon: CheckCircle2,
              title: "Bulk Actions",
              description: "Apply safe recommendations in bulk with one click to update hundreds of products at once.",
            },
            {
              icon: Shield,
              title: "Risk Assessment",
              description: "See risk scores before applying changes so you can protect brand positioning and avoid underpricing.",
            },
          ].map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <Card
                key={idx}
                className="border-slate-800 bg-slate-900/50 hover:bg-slate-900/70 hover:border-slate-700 hover:-translate-y-1 transition-all duration-200"
              >
                <CardContent className="p-6">
                  <div className="mb-4 w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Dashboard Highlight Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6">
            <div className="inline-block rounded-full bg-blue-500/10 px-4 py-1.5 text-xs font-medium text-blue-400">
              Pricing health at a glance
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              See exactly where you're winning – and where you're leaking margin
            </h2>
            <p className="text-lg text-slate-400 leading-relaxed">
              PricePilot turns raw competitor prices and cost data into a simple, actionable view. Instantly see which products are underpriced, which are overpriced, and where a small change can unlock more profit.
            </p>
            <ul className="space-y-3">
              {[
                "Track total revenue and margins in real time",
                "Spot products that need pricing attention right away",
                "Compare your prices vs competitor averages in one view",
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <Card className="border-slate-800 bg-slate-900/50 p-6">
              <div className="aspect-video rounded-lg relative overflow-hidden">
                <Image
                  src="/landing/landing-graph.png"
                  alt="PricePilot dashboard preview"
                  fill
                  className="object-cover rounded-lg"
                />
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            How PricePilot works in 3 simple steps
          </h2>
          <p className="text-lg text-slate-400">Get set up in minutes – not weeks.</p>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              step: "1",
              title: "Connect your store",
              description: "Connect Shopify for automatic two-way sync, or import products via CSV or a feed URL. We'll keep your catalog and margins up to date.",
            },
            {
              step: "2",
              title: "Add competitors",
              description: "Paste competitor store URLs and let PricePilot match overlapping products automatically. Review matches once and start tracking price changes.",
              disclaimer: "Amazon-style marketplaces may be limited due to anti-scraping protections.",
            },
            {
              step: "3",
              title: "Review & apply prices",
              description: "Get AI price suggestions, preview margin impact, and apply safe changes in bulk. If Shopify is connected, updates sync back to your store.",
            },
          ].map((item, idx) => (
            <div key={idx} className="text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-lg">
                {item.step}
              </div>
              <h3 className="text-xl font-semibold text-white">{item.title}</h3>
              <p className="text-slate-400 leading-relaxed">{item.description}</p>
              {(item as any).disclaimer && (
                <p className="text-xs text-slate-500 mt-2">{(item as any).disclaimer}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Simple, transparent pricing</h2>
          <p className="text-lg text-slate-400">Choose the plan that fits your store – and upgrade only when you grow.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          {[
            {
              name: "Starter",
              price: "$29",
              period: "/mo",
              description: "Perfect for small stores",
              clarifier: "Best for testing PricePilot on a small catalog.",
              features: [
                "Shopify & CSV import",
                "Up to 50 products",
                "2 competitors per product",
                "Sync frequency: 1× per day",
                "Alerts: Basic (price changes only)",
                "Manual price updates",
                "No bulk updates",
                "No automation",
                "Support: Email",
              ],
            },
            {
              name: "Pro",
              price: "$79",
              period: "/mo",
              description: "For growing businesses",
              clarifier: "Most stores upgrade to Pro within 7 days.",
              features: [
                "Shopify & CSV import",
                "Up to 200 products",
                "5 competitors per product",
                "Sync frequency: 2× per day",
                "Alerts: Priority (price + stock changes)",
                "Bulk Apply (update many products at once)",
                "Automatic pricing rules",
                "Competitor out-of-stock alerts",
                "Support: Priority",
              ],
              popular: true,
            },
            {
              name: "Scale",
              price: "$199",
              period: "/mo",
              description: "For large operations",
              features: [
                "Shopify & CSV import",
                "Up to 400+ products",
                "10 competitors per product",
                "Sync frequency: 4× per day",
                "Alerts: Fast / Premium",
                "Advanced automation priority",
                "Team access & API access",
                "Dedicated onboarding",
                "Support: Dedicated",
              ],
              comingSoon: true,
            },
          ].map((plan, idx) => (
            <Card
              key={idx}
              className={cn(
                "border-slate-800 bg-slate-900/50 hover:bg-slate-900/70 hover:-translate-y-1 transition-all duration-200",
                plan.popular && "ring-2 ring-blue-500"
              )}
            >
              <CardContent className="p-6">
                <div className="mb-4 text-center space-y-2">
                  {plan.popular && (
                    <span className="inline-block rounded-full bg-blue-500 px-3 py-1 text-xs font-medium text-white">
                      Most Popular
                    </span>
                  )}
                  {(plan as any).comingSoon && (
                    <span className="inline-block rounded-full bg-slate-700 px-3 py-1 text-xs font-medium text-slate-300">
                      Coming Soon
                    </span>
                  )}
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">{plan.name}</h3>
                <p className="text-sm text-slate-400 mb-1">{plan.description}</p>
                {(plan as any).clarifier && (
                  <p className="text-xs text-slate-500 mb-6">{(plan as any).clarifier}</p>
                )}
                <div className={cn((plan as any).clarifier ? "" : "mb-6")}>
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-slate-400">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, fIdx) => (
                    <li key={fIdx} className="flex items-start gap-2 text-sm text-slate-300">
                      <CheckCircle2 className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  disabled={(plan as any).comingSoon}
                  className={cn(
                    "w-full rounded-full px-6 py-3 font-medium transition",
                    (plan as any).comingSoon
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed opacity-60"
                      : plan.popular
                      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                      : "bg-slate-800 hover:bg-slate-700 text-white"
                  )}
                >
                  <Link href={(plan as any).comingSoon ? "#" : "/register"}>
                    {(plan as any).comingSoon ? "Coming Soon" : "Get started"}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-center text-sm text-slate-500 mt-8">
          Need more than 400 products?{" "}
          <Link href="#" className="text-blue-400 hover:text-blue-300">
            Contact us for a custom plan.
          </Link>
        </p>
      </section>

      {/* Why teams use PricePilot Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-8 text-center">
            Why teams use PricePilot
          </h2>
          <ul className="space-y-4">
            {[
              "Stop underpricing without killing conversions",
              "Protect margin with clear impact previews",
              "React faster to competitor price changes",
            ].map((item, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <span className="text-lg text-slate-300">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Frequently asked questions</h2>
        </div>
        <Accordion>
          <AccordionItem
            question="Do I need a developer to set this up?"
            answer="No. You can get started in minutes. Connect Shopify for automatic two-way sync, or import products via CSV or a feed URL and start tracking competitors right away."
          />
          <AccordionItem
            question="Will PricePilot update my Shopify prices automatically?"
            answer="Yes — if you connect Shopify. When you apply changes in PricePilot, we push updated prices back to your Shopify store automatically. You stay in control — nothing changes until you click apply."
          />
          <AccordionItem
            question="What if I use CSV import or a Feed URL instead of Shopify?"
            answer="PricePilot still works for analysis, competitor tracking, and recommendations. But price changes won't sync back automatically. If you want the updated prices in your store, you'll need to export/apply them manually."
          />
          <AccordionItem
            question="If I change prices in my store, will PricePilot stay up to date?"
            answer="Shopify: Yes — your catalog stays synced automatically. CSV / Feed URL: You'll need to re-upload your CSV or refresh the feed link so PricePilot can pull the latest changes."
          />
          <AccordionItem
            question="Will PricePilot change prices automatically?"
            answer="By default, you review and approve each change. Auto-apply options will be available on higher tiers later."
          />
          <AccordionItem
            question="Which platforms do you support?"
            answer="Shopify is supported with two-way sync (apply changes directly to your store). We also support any store that can export a CSV or provide a product feed URL. Platform-specific integrations will expand over time."
          />
          <AccordionItem
            question="Can I cancel anytime?"
            answer="Yes. There are no long-term contracts and you can cancel your subscription at any time."
          />
        </Accordion>
      </section>

      {/* Final CTA Banner */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
        <div className="max-w-3xl mx-auto">
          <div className="w-full rounded-2xl text-center bg-[#111726] shadow-[0_20px_30px_rgba(0,0,0,0.3)] relative overflow-hidden" style={{ boxShadow: '0 20px 30px rgba(0,0,0,0.3)' }}>
            {/* Subtle inner highlight at edges */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: 'radial-gradient(ellipse at top, rgba(255,255,255,0.05) 0%, transparent 50%), radial-gradient(ellipse at bottom, rgba(255,255,255,0.03) 0%, transparent 50%)'
            }} />
            <div className="relative px-16 sm:px-20 py-12 sm:py-16">
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-4">
                Ready to stop leaving money on the table?
              </h2>
              <p className="text-[#AEB7C0] leading-relaxed max-w-2xl mx-auto mb-6">
                Start a 14-day free trial, connect your store in minutes, and see how much profit you're missing today.
              </p>
              <div className="mb-7">
                <Button
                  asChild
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium px-8 py-3 rounded-full shadow-md shadow-blue-600/20 inline-flex items-center gap-2 transition"
                >
                  <Link href="/register">
                    Get started
                    <span>→</span>
                  </Link>
                </Button>
              </div>
              <p className="text-[#AEB7C0] text-sm">
                No credit card required • Cancel anytime
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Image Lightbox Modal */}
      {activeImageSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={handleCloseModal}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-200" />
          
          {/* Modal Content */}
          <div
            className="relative z-10 max-h-[90vh] max-w-[90vw] transition-all duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={handleCloseModal}
              className="absolute -top-12 right-0 text-white hover:text-slate-300 transition-colors p-2 rounded-full hover:bg-white/10 z-20"
              aria-label="Close preview"
            >
              <X className="h-6 w-6" />
            </button>
            
            {/* Image */}
            <div className="relative rounded-lg overflow-hidden shadow-2xl border border-white/10 bg-[#111726]">
              <Image
                src={activeImageSrc}
                alt="Preview screenshot"
                width={1200}
                height={800}
                className="max-h-[90vh] max-w-[90vw] object-contain"
                priority
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
