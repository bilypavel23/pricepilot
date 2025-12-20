import { createClient } from "@/lib/supabase/server";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  created_by: string | null;
  created_at: string;
};

export async function getAnnouncements(): Promise<Announcement[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching announcements:", error);
    return [];
  }

  return data || [];
}





