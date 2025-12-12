import { getAnnouncements } from "@/lib/announcements/getAnnouncements";
import { getProfile } from "@/lib/getProfile";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkReadOnLoad } from "@/components/messages/mark-read-on-load";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default async function AnnouncementsPage() {
  const { user } = await getProfile();

  if (!user) {
    redirect("/login");
  }

  const announcements = await getAnnouncements();

  return (
    <>
      <MarkReadOnLoad />
      <div className="max-w-4xl mx-auto px-6 lg:px-8 py-10 lg:py-12 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Product Updates</h1>
          <p className="text-muted-foreground">
            Stay up to date with new features and improvements
          </p>
        </div>

        {announcements.length === 0 ? (
          <Card className="dark:bg-slate-900 dark:border-slate-700">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No updates yet. Check back later for new features and improvements.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <Card key={announcement.id} className="dark:bg-slate-900 dark:border-slate-700">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-xl">{announcement.title}</CardTitle>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                      {new Date(announcement.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {announcement.body}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
