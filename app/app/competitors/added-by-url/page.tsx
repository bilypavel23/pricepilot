import { getProfile } from "@/lib/getProfile";
import { getOrCreateStore } from "@/lib/store";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, ExternalLink, ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { AddedByUrlMatchesClient } from "@/components/competitors/added-by-url-matches-client";

export default async function AddedByUrlPage() {
  const { user } = await getProfile();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-8 py-10 lg:py-12 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/app/competitors"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Competitors
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Added by URL</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Competitors added via product URLs, grouped by domain. These don&apos;t count toward your store limit.
        </p>
      </div>

      {/* Matches Table */}
      <Card>
        <CardHeader>
          <CardTitle>Product Matches</CardTitle>
          <CardDescription>
            Links between your products and competitor URLs added via product detail pages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddedByUrlMatchesClient />
        </CardContent>
      </Card>
    </div>
  );
}
