"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Product {
  id: string;
  name: string;
  sku: string;
}

interface CompetitorProduct {
  id: string;
  name: string;
  sku: string | null;
}

interface ManualMatchFormProps {
  myProducts: Product[];
  competitorProducts: CompetitorProduct[];
  onSuccess?: () => void;
}

export function ManualMatchForm({
  myProducts,
  competitorProducts,
  onSuccess,
}: ManualMatchFormProps) {
  const router = useRouter();
  const [productId, setProductId] = useState<string>("");
  const [competitorProductId, setCompetitorProductId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productId || !competitorProductId) {
      setError("Please select both products");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/product-matches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          competitorProductId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create match");
      }

      // Reset form
      setProductId("");
      setCompetitorProductId("");
      setError(null);

      if (onSuccess) {
        onSuccess();
      }

      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to create match");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manual match</CardTitle>
        <CardDescription>Manually create a match between your product and a competitor product.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="my-product">Select your product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger id="my-product">
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {myProducts.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} (SKU: {product.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="competitor-product">Select competitor product</Label>
            <Select value={competitorProductId} onValueChange={setCompetitorProductId}>
              <SelectTrigger id="competitor-product">
                <SelectValue placeholder="Select a competitor product" />
              </SelectTrigger>
              <SelectContent>
                {competitorProducts.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} (SKU: {product.sku || "N/A"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" disabled={loading || !productId || !competitorProductId}>
            {loading ? "Creating..." : "Create match"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}


