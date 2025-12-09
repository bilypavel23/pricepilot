"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddCompetitorModal } from "./add-competitor-modal";

export function CompetitorsClient({ 
  isDemo, 
  storeId, 
  used, 
  limit 
}: { 
  isDemo: boolean; 
  storeId: string;
  used: number;
  limit: number;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const router = useRouter();
  const isFull = used >= limit;

  return (
    <>
      <Button
        onClick={() => {
          if (isDemo || isFull) {
            // TODO: Show toast
            return;
          }
          setShowAddModal(true);
        }}
        disabled={isDemo || isFull}
        className={cn("shadow-md", (isDemo || isFull) && "opacity-50 cursor-not-allowed")}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add competitor
      </Button>

      {showAddModal && (
        <AddCompetitorModal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          storeId={storeId}
          onSuccess={() => {
            setShowAddModal(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}




