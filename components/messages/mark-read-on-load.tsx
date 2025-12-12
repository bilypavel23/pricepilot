"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function MarkReadOnLoad() {
  const router = useRouter();

  useEffect(() => {
    const markAsRead = async () => {
      try {
        const res = await fetch("/api/announcements/mark-read", {
          method: "POST",
        });
        
        if (res.ok) {
          // Refresh to update unread count in messages dropdown
          router.refresh();
        }
      } catch (e) {
        console.error("Failed to mark announcements as read:", e);
      }
    };

    // Mark as read immediately when component mounts
    markAsRead();
  }, [router]);

  return null;
}

