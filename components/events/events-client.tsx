"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Bell, RefreshCw, Activity, LucideIcon } from "lucide-react";

interface ActivityEvent {
  id: string;
  store_id: string;
  type: string;
  title: string;
  meta: any;
  created_at: string;
}

interface EventsClientProps {
  events: ActivityEvent[];
  currentPage: number;
  hasMore: boolean;
}

// Helper to format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays === 0) {
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins < 1 ? "Just now" : `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    }
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

// Helper to get icon for event type
function getEventIcon(type: string): LucideIcon {
  switch (type) {
    case "price_updated":
      return ArrowUpDown;
    case "products_sync":
      return RefreshCw;
    case "competitor_sync":
      return Bell;
    default:
      return Activity;
  }
}

export function EventsClient({
  events,
  currentPage,
  hasMore,
}: EventsClientProps) {
  const router = useRouter();

  const handleNextPage = () => {
    router.push(`/app/events?page=${currentPage + 1}`);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      router.push(`/app/events?page=${currentPage - 1}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 lg:px-8 py-10 lg:py-12 space-y-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Event Log</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Full history of activity in your store
        </p>
      </div>

      {/* Events List */}
      <Card className="rounded-2xl bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Activity History</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length > 0 ? (
            <>
              <div className="space-y-4">
                {events.map((event) => {
                  const Icon = getEventIcon(event.type);
                  
                  // Extract meta preview if available
                  let metaPreview = null;
                  if (event.meta) {
                    if (event.meta.count !== undefined) {
                      metaPreview = `${event.meta.count} items`;
                    } else if (event.meta.oldPrice !== undefined && event.meta.newPrice !== undefined) {
                      metaPreview = `$${event.meta.oldPrice} → $${event.meta.newPrice}`;
                    }
                  }

                  return (
                    <div key={event.id} className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full bg-slate-100 dark:bg-slate-800 p-2">
                        <Icon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {event.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {formatRelativeTime(event.created_at)}
                          </p>
                          {metaPreview && (
                            <>
                              <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {metaPreview}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className="dark:bg-slate-800 dark:border-slate-700"
                >
                  Previous
                </Button>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Page {currentPage}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={!hasMore}
                  className="dark:bg-slate-800 dark:border-slate-700"
                >
                  Next
                </Button>
              </div>
            </>
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No events yet.
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Apply a price or run a sync to see activity here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Back to Dashboard */}
      <div className="text-center">
        <Link
          href="/app/dashboard"
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

