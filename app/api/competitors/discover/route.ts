import { NextResponse } from "next/server";

/**
 * DEPRECATED: This endpoint is no longer used.
 * 
 * Use POST /api/competitors/[competitorId]/discover instead.
 * 
 * This endpoint is kept for backward compatibility but returns 410 Gone.
 */
export async function POST() {
  return NextResponse.json(
    { 
      error: "This endpoint is deprecated. Use POST /api/competitors/[competitorId]/discover instead.",
      deprecated: true,
    },
    { status: 410 }
  );
}
