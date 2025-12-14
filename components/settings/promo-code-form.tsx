"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

export function PromoCodeForm() {
  const router = useRouter();
  const [promoCode, setPromoCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleApply = async () => {
    setError(null);
    setSuccess(null);

    if (!promoCode.trim()) {
      setError("Please enter a promo code");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/promo/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to apply promo code");
        return;
      }

      setSuccess("Promo code applied.");
      setPromoCode("");
      // Refresh the page to update Current plan badge
      router.refresh();
    } catch (err: any) {
      console.error("Error applying promo code:", err);
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Enter promo code"
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          disabled={loading}
          className="flex-1 dark:bg-[#0f1117] dark:border-white/10"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading && promoCode.trim()) {
              handleApply();
            }
          }}
        />
        <Button
          onClick={handleApply}
          disabled={loading || !promoCode.trim()}
          className="dark:bg-blue-600 dark:hover:bg-blue-700"
        >
          {loading ? "Applying..." : "Apply"}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-500 dark:text-green-400">{success}</p>
      )}
    </div>
  );
}


