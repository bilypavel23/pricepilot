import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Log all cookies for debugging
  const allCookies = request.cookies.getAll();
  const authCookie = allCookies.find(c => c.name.includes('auth-token'));
  console.log("Middleware - All cookies:", allCookies.map(c => ({ name: c.name, hasValue: !!c.value })));
  if (authCookie) {
    console.log("Middleware - Auth cookie found:", {
      name: authCookie.name,
      valueLength: authCookie.value?.length,
      valuePreview: authCookie.value?.substring(0, 100),
    });
  }

  // Create Supabase client with cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookie = request.cookies.get(name);
          const value = cookie?.value;
          if (value && name.includes('auth-token')) {
            console.log(`Middleware - Cookie found: ${name}, length: ${value.length}, preview: ${value.substring(0, 50)}`);
            // Try to parse the cookie value to see if it's valid JSON
            try {
              const parsed = JSON.parse(value);
              console.log(`Middleware - Cookie parsed successfully, type: ${Array.isArray(parsed) ? 'array' : typeof parsed}, length: ${Array.isArray(parsed) ? parsed.length : 'N/A'}`);
            } catch (e) {
              console.log(`Middleware - Cookie is not valid JSON`);
            }
          }
          return value;
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );

  // Try to get session first, then user
  let user = null;
  let userError = null;
  
  try {
    // First try to get session - this reads from cookies
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log("Middleware - Session check:", {
      hasSession: !!session,
      hasAccessToken: !!session?.access_token,
      userId: session?.user?.id,
      sessionError: sessionError?.message,
    });
    
    // If we have a session, use the user from session
    if (session?.user) {
      user = session.user;
      console.log("Middleware - User from session:", { userId: user.id });
    } else {
      // Otherwise try to get user directly
      const userResult = await supabase.auth.getUser();
      user = userResult.data.user;
      userError = userResult.error;
      
      console.log("Middleware - User check:", {
        hasUser: !!user,
        userId: user?.id,
        userError: userError?.message,
      });
    }
  } catch (err: any) {
    console.error("Error getting user in middleware:", err);
    userError = err;
  }

  // Protect /app routes
  if (request.nextUrl.pathname.startsWith("/app")) {
    console.log("Middleware - /app route check:", {
      path: request.nextUrl.pathname,
      hasUser: !!user,
      userId: user?.id,
      error: userError?.message,
      cookieNames: request.cookies.getAll().map(c => c.name),
    });

    if (!user) {
      console.log("No user found, redirecting to sign-in");
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/sign-in";
      redirectUrl.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Redirect authenticated users away from auth pages
  if (request.nextUrl.pathname.startsWith("/sign-in") || request.nextUrl.pathname.startsWith("/sign-up") || request.nextUrl.pathname.startsWith("/register")) {
    console.log("Middleware - auth page check:", {
      path: request.nextUrl.pathname,
      hasUser: !!user,
      userId: user?.id,
    });

    if (user) {
      console.log("User found on auth page, redirecting to dashboard");
      return NextResponse.redirect(new URL("/app/dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

