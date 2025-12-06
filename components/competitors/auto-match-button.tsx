"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

interface AutoMatchButtonProps {
  competitorId: string;
  onSuccess?: (count: number) => void;
}

export function AutoMatchButton({ competitorId, onSuccess }: AutoMatchButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleAutoMatch = async () => {
    setLoading(true);

    try {
      const response = await fetch(`/api/competitors/${competitorId}/auto-match`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to auto-match products");
      }

      if (onSuccess) {
        onSuccess(data.created);
      }

      router.refresh();
    } catch (error: any) {
      alert(error.message || "Failed to auto-match products");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleAutoMatch}
      disabled={loading}
      variant="outline"
      className="shadow-md"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Matching...
        </>
      ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" />
          Auto-match by name
        </>
      )}
    </Button>
  );
}

