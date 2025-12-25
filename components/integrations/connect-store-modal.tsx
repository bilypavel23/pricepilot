"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ConnectStoreModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectStoreModal({ open, onOpenChange }: ConnectStoreModalProps) {
  const router = useRouter();
  const [platform, setPlatform] = useState<string>("");
  const [shopDomain, setShopDomain] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    if (platform === "shopify") {
      if (!shopDomain) {
        alert("Please enter your shop domain");
        return;
      }

      // Validate shop domain format
      if (!shopDomain.includes(".myshopify.com")) {
        alert("Please enter a valid Shopify domain (e.g., myshop.myshopify.com)");
        return;
      }

      setIsLoading(true);
      try {
        // Redirect to OAuth start route
        window.location.href = `/api/integrations/shopify/start?shop_domain=${encodeURIComponent(shopDomain)}`;
      } catch (error) {
        console.error("Error connecting store:", error);
        alert("Failed to connect store. Please try again.");
        setIsLoading(false);
      }
    } else if (platform === "woocommerce") {
      alert("WooCommerce integration coming soon!");
    } else if (platform === "csv") {
      // Redirect to existing CSV import page
      router.push("/app/products?import=csv");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Store</DialogTitle>
          <DialogDescription>
            Connect your store to automatically sync products and inventory.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Step 1: Select Platform */}
          <div className="space-y-2">
            <Label htmlFor="platform">Platform</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger id="platform">
                <SelectValue placeholder="Select a platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shopify">Shopify</SelectItem>
                <SelectItem value="woocommerce" disabled>
                  WooCommerce (Coming Soon)
                </SelectItem>
                <SelectItem value="csv">CSV Import</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Step 2: Shopify Domain Input */}
          {platform === "shopify" && (
            <div className="space-y-2">
              <Label htmlFor="shop-domain">Shop Domain</Label>
              <Input
                id="shop-domain"
                type="text"
                placeholder="myshop.myshopify.com"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter your Shopify store domain (e.g., myshop.myshopify.com)
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleConnect} disabled={!platform || isLoading}>
              {platform === "shopify" ? "Connect Shopify" : platform === "csv" ? "Continue" : "Connect"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

