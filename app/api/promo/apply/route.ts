import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
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

    // Parse request body
    const { code } = await req.json();

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Promo code is required" },
        { status: 400 }
      );
    }

    // Normalize: trim + uppercase
    const normalizedCode = code.trim().toUpperCase();

    // Validate promo code
    if (normalizedCode !== "TESTER") {
      return NextResponse.json(
        { error: "Invalid promo code." },
        { status: 400 }
      );
    }

    // Update user profile
    // Try to update with promo_code and promo_applied_at first
    // If columns don't exist, Supabase will return an error, then we'll retry with just plan
    const updateData: any = {
      plan: "PRO",
      promo_code: normalizedCode,
      promo_applied_at: new Date().toISOString(),
    };

    let { error: updateError } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id);

    // If error is about missing columns, retry with just plan update
    if (updateError) {
      const errorMessage = updateError.message || "";
      if (
        errorMessage.includes("column") &&
        (errorMessage.includes("does not exist") ||
          errorMessage.includes("promo_code") ||
          errorMessage.includes("promo_applied_at"))
      ) {
        // Retry with just plan update (columns don't exist)
        const { error: retryError } = await supabase
          .from("profiles")
          .update({ plan: "PRO" })
          .eq("id", user.id);

        if (retryError) {
          console.error("Error updating profile:", retryError);
          return NextResponse.json(
            { error: "Failed to apply promo code" },
            { status: 500 }
          );
        }
      } else {
        // Different error, return it
        console.error("Error updating profile:", updateError);
        return NextResponse.json(
          { error: "Failed to apply promo code" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      plan: "PRO",
    });
  } catch (err: any) {
    console.error("Error applying promo code:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

