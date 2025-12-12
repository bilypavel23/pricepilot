import { getProfile } from "@/lib/getProfile";
import { getOrCreateStore } from "@/lib/store";
import { getActivityEvents } from "@/lib/activity-events/getActivityEvents";
import { redirect } from "next/navigation";
import { EventsClient } from "@/components/events/events-client";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { user } = await getProfile();

  if (!user) {
    redirect("/login");
  }

  const store = await getOrCreateStore();
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const pageSize = 50;
  const offset = (page - 1) * pageSize;

  // Load events with pagination
  let events: any[] = [];
  let hasMore = false;
  try {
    // Load one extra to check if there are more pages
    const loadedEvents = await getActivityEvents(store.id, pageSize + 1, offset);
    hasMore = loadedEvents.length > pageSize;
    events = loadedEvents.slice(0, pageSize);
  } catch (err: any) {
    console.warn("Could not load activity events:", err?.message || err);
    events = [];
  }

  return (
    <EventsClient
      events={events}
      currentPage={page}
      hasMore={hasMore}
    />
  );
}

