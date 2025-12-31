import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const { email, password, fullName, termsAccepted } = await req.json();

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: "Email, password, and full name are required" },
        { status: 400 }
      );
    }

    // Validate terms acceptance - return 400 before calling signUp
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
    // Profile will be created automatically by DB trigger (handle_new_user)
    // Pass metadata including terms_accepted for the trigger to use
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        data: {
          full_name: fullName,
          plan: "free_demo",
          terms_accepted: true,
        },
      },
    });

    // Log signUp result
    console.log("signUp result", { 
      userId: data?.user?.id, 
      email: data?.user?.email,
      error: signUpError 
    });

    if (signUpError) {
      console.error("signUp error:", signUpError);
      return NextResponse.json({ error: signUpError.message }, { status: 400 });
    }

    // Return success - profile will be created by DB trigger
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

