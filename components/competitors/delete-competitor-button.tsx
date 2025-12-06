"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DeleteCompetitorButton({ competitorId }: { competitorId: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Do you really want to delete this competitor store?")) return;

    try {
      setIsLoading(true);

      const res = await fetch(`/api/competitors/${competitorId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        let message = `Failed to delete competitor (status ${res.status})`;
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          // ignore JSON parse errors
        }
        alert(message);
        return;
      }

      router.refresh();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
      onClick={handleDelete}
      disabled={isLoading}
    >
      {isLoading ? "Deleting…" : "Delete"}
    </Button>
  );
}

