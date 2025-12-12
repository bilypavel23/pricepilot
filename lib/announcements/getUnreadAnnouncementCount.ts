import { createClient } from "@/lib/supabase/server";

export async function getUnreadAnnouncementCount(): Promise<number> {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return 0;
  }

  // Use SQL to count unread announcements efficiently
  // Count announcements where there is NO row in announcement_reads
  const { data, error } = await supabase.rpc('get_unread_announcement_count', {
    user_id_param: user.id
  });

  // If RPC doesn't exist, fall back to manual counting
  if (error) {
    // Fallback: Get all announcements and check which are unread
    const { data: announcements, error: announcementsError } = await supabase
      .from("announcements")
      .select("id");

    if (announcementsError || !announcements || announcements.length === 0) {
      return 0;
    }

    // Get read announcements for this user
    const { data: reads, error: readsError } = await supabase
      .from("announcement_reads")
      .select("announcement_id")
      .eq("user_id", user.id);

    if (readsError) {
      console.error("Error fetching announcement reads:", readsError);
      return 0;
    }

    const readAnnouncementIds = new Set(
      (reads || []).map((r) => r.announcement_id)
    );

    // Count unread announcements
    return announcements.filter(
      (a) => !readAnnouncementIds.has(a.id)
    ).length;
  }

  return data || 0;
}

