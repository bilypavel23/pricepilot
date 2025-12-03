import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { email, password, access_token, refresh_token } = await req.json();

    console.log("API signin called with email:", email, "has tokens:", !!access_token);

    // If we have tokens from client-side sign in, just set cookies
    if (access_token && refresh_token) {
      const cookieStore = cookies();
      
      // Create response that we'll modify
      let response = NextResponse.next();
      
      // Create supabase client that will set cookies in response
      const supabaseWithResponse = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set(name: string, value: string, options: any) {
              // Set cookie directly in response
              response.cookies.set({
                name,
                value,
                httpOnly: options?.httpOnly ?? true,
                secure: options?.secure ?? (process.env.NODE_ENV === "production"),
                sameSite: (options?.sameSite as any) ?? "lax",
                path: options?.path ?? "/",
                maxAge: options?.maxAge ?? 60 * 60 * 24 * 7,
              });
              console.log(`Cookie set callback: ${name} (length: ${value.length})`);
            },
            remove(name: string, options: any) {
              response.cookies.set({
                name,
                value: "",
                maxAge: 0,
                path: "/",
              });
            },
          },
        }
      );

      // Set session - this should trigger cookie callbacks
      const { data: { user }, error } = await supabaseWithResponse.auth.setSession({
        access_token,
        refresh_token,
      });

      console.log("setSession result:", { 
        hasUser: !!user, 
        userId: user?.id,
        error: error?.message
      });

      if (error) {
        console.error("Error setting session:", error);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // Create JSON response and copy cookies from response
      const jsonResponse = NextResponse.json({ success: true, user });
      
      // Copy all cookies from response to jsonResponse
      response.cookies.getAll().forEach((cookie) => {
        jsonResponse.cookies.set(cookie);
      });

      console.log("Cookies after setSession:", jsonResponse.cookies.getAll().map(c => ({ name: c.name, hasValue: !!c.value })));

      return jsonResponse;
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Create Supabase client with cookies
    const cookieStore = cookies();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set({
                name,
                value,
                ...options,
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
              });
              console.log(`Cookie set: ${name}`);
            } catch (err) {
              console.error(`Error setting cookie ${name}:`, err);
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({
                name,
                value: "",
                ...options,
                maxAge: 0,
                path: "/",
              });
            } catch (err) {
              console.error(`Error removing cookie ${name}:`, err);
            }
          },
        },
      }
    );

    console.log("Calling supabase.auth.signInWithPassword...");
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log("Sign in response:", { 
      hasError: !!error, 
      hasSession: !!data?.session,
      userId: data?.user?.id 
    });

    if (error) {
      console.error("Sign in error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data.session) {
      console.error("No session in response");
      return NextResponse.json(
        { error: "No session received" },
        { status: 400 }
      );
    }

    // Create response with cookies
    const response = NextResponse.json({ 
      success: true, 
      user: data.user 
    });

    // Explicitly set auth cookies
    const sessionCookie = `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split("//")[1]?.split(".")[0]}-auth-token`;
    response.cookies.set({
      name: sessionCookie,
      value: data.session.access_token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    console.log("Sign in successful, returning response");
    return response;
  } catch (err: any) {
    console.error("Sign in exception:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

