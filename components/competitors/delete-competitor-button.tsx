"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  competitorId: string;
  competitorName?: string;
}

export function DeleteCompetitorButton({ competitorId, competitorName }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    const label = competitorName ?? "this competitor store";
    if (!confirm(`Do you really want to delete ${label}?`)) return;

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

