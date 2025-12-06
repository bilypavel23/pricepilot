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

interface AddCompetitorModalProps {
  open: boolean;
  onClose: () => void;
  storeId: string;
  onSuccess: () => void;
}

export function AddCompetitorModal({ open, onClose, storeId, onSuccess }: AddCompetitorModalProps) {
  const router = useRouter();
  const [storeName, setStoreName] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim() || !storeUrl.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/competitors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: storeName.trim(),
          url: storeUrl.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to add competitor");
        setLoading(false);
        return;
      }

      setStoreName("");
      setStoreUrl("");
      onClose();
      router.refresh();
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to add competitor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add competitor store</DialogTitle>
          <DialogDescription>
            Add a competitor's shop URL and we'll scan it for overlapping products.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="store-name">Store name</Label>
            <Input
              id="store-name"
              name="store-name"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="e.g., TechStore"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="store-url">Store URL</Label>
            <Input
              id="store-url"
              name="store-url"
              type="url"
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
              placeholder="https://competitor-shop.com"
              required
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={!storeName.trim() || !storeUrl.trim() || loading}
              className="flex-1"
            >
              {loading ? "Saving..." : "Save competitor"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

