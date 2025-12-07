"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddCompetitorModal } from "./add-competitor-modal";

export function CompetitorsClient({ isDemo, storeId }: { isDemo: boolean; storeId: string }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button
        onClick={() => {
          if (isDemo) {
            // TODO: Show toast
            return;
          }
          setShowAddModal(true);
        }}
        disabled={isDemo}
        className={cn("shadow-md", isDemo && "opacity-50 cursor-not-allowed")}
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



