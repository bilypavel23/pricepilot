import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Create Supabase client with cookies using @supabase/ssr
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Get user from session - check both user and error
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthPage = path === "/sign-in" || path === "/sign-up" || path === "/register" || path === "/login";
  const isAppPage = path.startsWith("/app");

  // Only consider user authenticated if we have a valid user with id AND no error
  const isAuthenticated = !!(user && user.id && !authError);

  // If there's an auth error (invalid/expired session), clear cookies
  if (authError && !user) {
    // Clear auth cookies by setting them to empty with maxAge 0
    const authCookieNames = request.cookies.getAll()
      .map(c => c.name)
      .filter(name => name.includes('auth') || name.includes('supabase'));
    
    authCookieNames.forEach(name => {
      response.cookies.set(name, '', { maxAge: 0, path: '/' });
    });
  }

  // Protect /app routes - redirect to login if not authenticated
  if (isAppPage && !isAuthenticated) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", path);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect authenticated users away from auth pages
  // Only redirect if we're absolutely sure the user is authenticated
  if (isAuthPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/app/dashboard", request.url));
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

