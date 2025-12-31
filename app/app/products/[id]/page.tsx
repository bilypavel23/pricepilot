import { getProfile } from "@/lib/getProfile";
import { getOrCreateStore } from "@/lib/store";
import { getProductWithCompetitors } from "@/lib/products/getProductWithCompetitors";
import { getProductActivityEvents } from "@/lib/activity-events/getProductActivityEvents";
import { redirect } from "next/navigation";
import { ProductDetailClient } from "@/components/products/product-detail-client";
import { createClient } from "@/lib/supabase/server";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, profile, entitlements } = await getProfile();

  if (!user) {
    redirect("/login");
  }

  const store = await getOrCreateStore();
  // Use effectivePlan from entitlements (maps free_demo with active trial to pro)
  const effectivePlan = entitlements?.effectivePlan ?? profile?.plan ?? "starter";
  const plan = effectivePlan as string;

  // Load product with competitors
  const productData = await getProductWithCompetitors(id, store.id);

  if (!productData) {
    return (
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-10 lg:py-12">
        <p className="text-muted-foreground mb-4">Product not found</p>
        <a
          href="/app/products"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Back to products
        </a>
      </div>
    );
  }

  // Calculate margin if both cost and price exist
  let margin: number | null = null;
  if (
    productData.product.price != null &&
    productData.product.cost != null &&
    productData.product.price > 0
  ) {
    margin = ((productData.product.price - productData.product.cost) / productData.product.price) * 100;
  }

  // Load recent activity for this product
  const activityEvents = await getProductActivityEvents(store.id, id, 3);

  // Use the unified competitors list (includes both Store and URL competitors from linked view + fallback)
  const allCompetitors = productData.competitors ?? [];
  
  // Compute competitor limit UI using shared helper
  const { getProductCompetitorLimitUI } = await import("@/lib/competitors/productCompetitorLimits");
  const limitUI = getProductCompetitorLimitUI({
    profile,
    productId: id,
    competitorsLinkedCount: allCompetitors.length,
    userCreatedAt: user.created_at,
  });

  // Dev console log for debugging
  if (process.env.NODE_ENV === "development") {
    console.log("[product-detail-page] Competitor limit debug:", {
      plan: profile?.plan,
      trial_active: entitlements?.trialActive,
      trial_ends_at: profile?.trial_ends_at || (user.created_at ? new Date(new Date(user.created_at).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString() : null),
      effectivePlan: entitlements?.effectivePlan,
      max: limitUI.max,
      used: limitUI.used,
      canAdd: limitUI.canAdd,
    });
  }
  
  // Debug log to verify competitors data
  console.log("[product-detail-page] Competitors data:", {
    total: allCompetitors.length,
    competitors: allCompetitors.map(c => ({
      matchId: c.matchId,
      competitorId: c.competitorId,
      competitorName: c.competitorName,
      source: c.source,
      hasPrice: c.competitorPrice != null,
    })),
  });

  return (
    <ProductDetailClient
      product={productData.product}
      competitors={allCompetitors}
      competitorAvg={productData.competitorAvg}
      margin={margin}
      activityEvents={activityEvents}
      plan={plan}
      competitorLimitUI={limitUI}
      store={{
        platform: store.platform,
        shopify_access_token: store.shopify_access_token,
      }}
    />
  );
}
