import { NextResponse } from "next/server";
import { getUnreadAnnouncementCount } from "@/lib/announcements/getUnreadAnnouncementCount";

export async function GET() {
  try {
    const count = await getUnreadAnnouncementCount();
    return NextResponse.json({ count });
  } catch (err: any) {
    console.error("Error getting unread count:", err);
    return NextResponse.json({ count: 0 });
  }
}




