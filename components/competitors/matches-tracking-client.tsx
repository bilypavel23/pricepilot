"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

type TrackedProduct = {
  store_product_id: string;
  store_product_name: string;
  store_product_sku: string | null;
  store_product_price: number | null;
  competitor_product_id: string;
  competitor_name: string;
  competitor_url: string;
  competitor_price: number | null;
  currency: string;
};

type MatchesTrackingClientProps = {
  competitorId: string;
  competitorName: string;
  trackedProducts: TrackedProduct[];
};

export function MatchesTrackingClient({
  competitorId,
  competitorName,
  trackedProducts,
}: MatchesTrackingClientProps) {
  const router = useRouter();

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10 lg:py-12 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Tracking Products</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {competitorName}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push("/app/competitors")}
        >
          Back to Competitors
        </Button>
      </div>

      {/* Tracked Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tracked Products</CardTitle>
          <CardDescription>
            Products currently being tracked for price monitoring.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trackedProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No tracked products found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {trackedProducts.map((product) => (
                <div
                  key={product.store_product_id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  {/* Left: My Product (fixed) */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Label className="font-medium">{product.store_product_name}</Label>
                      {product.store_product_sku && (
                        <Badge variant="outline" className="text-xs">
                          SKU: {product.store_product_sku}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        Tracking
                      </Badge>
                    </div>
                    {product.store_product_price !== null && (
                      <p className="text-sm text-muted-foreground">
                        ${product.store_product_price.toFixed(2)}
                      </p>
                    )}
                  </div>

                  {/* Right: Competitor Product (confirmed match) */}
                  <div className="w-80 flex-shrink-0">
                    <div className="flex flex-col gap-2">
                      {/* Competitor name */}
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate flex-1 min-w-0">
                          {product.competitor_name}
                        </p>
                      </div>

                      {/* Competitor price */}
                      {product.competitor_price !== null && (
                        <p className="text-sm text-muted-foreground">
                          {product.currency} {product.competitor_price.toFixed(2)}
                        </p>
                      )}

                      {/* View competitor product button */}
                      {product.competitor_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="w-full"
                        >
                          <a
                            href={product.competitor_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View competitor product
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


