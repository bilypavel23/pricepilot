"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConnectStoreModal } from "@/components/integrations/connect-store-modal";

interface StoreConnectionCardProps {
  store?: {
    platform?: string;
    shop_domain?: string;
  };
}

export function StoreConnectionCard({ store }: StoreConnectionCardProps) {
  const router = useRouter();
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleImportProducts = async () => {
    setIsImporting(true);
    try {
      const res = await fetch("/api/shopify/products/import", {
        method: "POST",
      });
      
      // Check if response has content before parsing JSON
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        alert(text || "Failed to import products");
        return;
      }
      
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to import products");
      } else {
        alert(`Successfully imported ${data.imported || 0} products`);
        router.refresh();
      }
    } catch (error) {
      console.error("Import error:", error);
      alert("Failed to import products");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <Card className="mt-6 rounded-2xl bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <CardHeader>
          <CardTitle>Store Connection</CardTitle>
        </CardHeader>
        <CardContent>
          {store?.platform ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Connected platform:</p>
                <p className="font-semibold capitalize">{store.platform}</p>
              </div>
              {store.shop_domain && (
                <div>
                  <p className="text-sm text-muted-foreground">Domain:</p>
                  <p className="font-semibold">{store.shop_domain}</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={() => setConnectModalOpen(true)} variant="outline">
                  Reconnect Store
                </Button>
                {store.platform === "shopify" && (
                  <Button 
                    onClick={handleImportProducts} 
                    disabled={isImporting}
                    variant="default"
                  >
                    {isImporting ? "Importing..." : "Import products now"}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Connect your store to automatically sync products and inventory.
              </p>
              <Button onClick={() => setConnectModalOpen(true)}>
                Connect Store
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ConnectStoreModal open={connectModalOpen} onOpenChange={setConnectModalOpen} />
    </>
  );
}



