import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const { email, password, fullName, termsAccepted } = await req.json();

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: "Email, password, and full name are required" },
        { status: 400 }
      );
    }

    // Validate terms acceptance
    if (termsAccepted !== true) {
      return NextResponse.json(
        { error: "You must agree to the Terms of Service and Privacy Policy to continue." },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const requestUrl = new URL(req.url);
    const origin = req.headers.get("origin") || requestUrl.origin;

    // Sign up user
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        data: {
          full_name: fullName,
          plan: "free_demo",
        },
      },
    });

    // Log signUp result
    console.log("signUp result", { data, error: signUpError });

    if (signUpError) {
      console.error("signUp error:", signUpError);
      return NextResponse.json({ error: signUpError.message }, { status: 400 });
    }

    // Verify we have a user id
    const userId = data?.user?.id ?? data?.session?.user?.id;
    if (!userId) {
      console.error("Missing user id after signUp", { data });
      return NextResponse.json(
        { error: "Missing user id after signUp" },
        { status: 500 }
      );
    }

    // Get the user's metadata from signup
    const userMetadata = data.user?.user_metadata || {};
    const profileFullName = userMetadata.full_name || fullName;
    const profilePlan = userMetadata.plan || "free_demo";
    const termsAcceptedAt = new Date().toISOString();

    // Insert/upsert profile with terms acceptance using admin client
    // Always include terms_accepted: true and terms_accepted_at when checkbox is checked
    // Note: Trial is computed in app code (lib/billing/trial.ts) from user.created_at, not stored in DB
    // Retry in case profile hasn't been created yet by trigger
    let profileUpserted = false;
    
    for (let attempt = 0; attempt < 5; attempt++) {
      const profilePayload = {
        id: userId,
        full_name: profileFullName,
        plan: profilePlan,
        terms_accepted: true,
        terms_accepted_at: termsAcceptedAt,
      };

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert(profilePayload, {
          onConflict: "id"
        });

      if (!profileError) {
        profileUpserted = true;
        break;
      }

      // If profile doesn't exist yet and upsert failed, wait and retry
      // This can happen if the trigger hasn't run yet or foreign key constraints
      if (profileError.code === "PGRST116" || profileError.message?.includes("No rows") || 
          profileError.message?.includes("violates foreign key") || 
          profileError.message?.includes("does not exist")) {
        await new Promise(resolve => setTimeout(resolve, 200));
        continue;
      }

      // For other errors, log the full error and return it
      console.error("profiles insert error", JSON.stringify(profileError, null, 2));
      console.error("profilePayload:", JSON.stringify(profilePayload, null, 2));
      
      return NextResponse.json(
        { 
          error: profileError.message || "Database error saving new user",
          details: profileError.details,
          hint: profileError.hint,
        },
        { status: 500 }
      );
    }

    if (!profileUpserted) {
      console.error("Signup profile upsert failed after retries", {
        userId: userId,
        attempts: 5,
      });
      return NextResponse.json(
        { error: "Database error saving new user. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Account created. Please check your email and click the verification link to activate your account.",
    });
  } catch (err: any) {
    console.error("Signup exception:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

