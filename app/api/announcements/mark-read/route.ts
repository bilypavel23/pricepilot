import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all announcements
    const { data: announcements, error: announcementsError } = await supabase
      .from("announcements")
      .select("id");

    if (announcementsError) {
      return NextResponse.json(
        { error: "Failed to fetch announcements" },
        { status: 500 }
      );
    }

    if (!announcements || announcements.length === 0) {
      return NextResponse.json({ success: true, marked: 0 });
    }

    // Get already read announcements for this user
    const { data: existingReads, error: readsError } = await supabase
      .from("announcement_reads")
      .select("announcement_id")
      .eq("user_id", user.id);

    if (readsError) {
      return NextResponse.json(
        { error: "Failed to fetch existing reads" },
        { status: 500 }
      );
    }

    const readAnnouncementIds = new Set(
      (existingReads || []).map((r) => r.announcement_id)
    );

    // Find unread announcements
    const unreadAnnouncements = announcements.filter(
      (a) => !readAnnouncementIds.has(a.id)
    );

    if (unreadAnnouncements.length === 0) {
      return NextResponse.json({ success: true, marked: 0 });
    }

    // Insert reads for all unread announcements using upsert to ignore duplicates
    const readsToInsert = unreadAnnouncements.map((a) => ({
      announcement_id: a.id,
      user_id: user.id,
    }));

    // Use upsert with onConflict to ignore duplicates
    const { error: insertError } = await supabase
      .from("announcement_reads")
      .upsert(readsToInsert, {
        onConflict: "announcement_id,user_id",
        ignoreDuplicates: true,
      });

    if (insertError) {
      console.error("Error inserting reads:", insertError);
      // Still return success if it's just a duplicate error
      if (!insertError.message.includes("duplicate") && !insertError.message.includes("unique")) {
        return NextResponse.json(
          { error: "Failed to mark announcements as read" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      marked: unreadAnnouncements.length,
    });
  } catch (err: any) {
    console.error("Error marking announcements as read:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

