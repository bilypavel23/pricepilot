import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          req.cookies.set({
            name,
            value,
            ...options,
          });
          res.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          req.cookies.set({
            name,
            value: "",
            ...options,
          });
          res.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );

  // Log cookies for debugging
  const cookies = req.cookies.getAll();
  const authCookie = cookies.find(c => c.name.includes('auth-token'));
  console.log("Middleware - Cookies:", {
    totalCookies: cookies.length,
    cookieNames: cookies.map(c => c.name),
    hasAuthCookie: !!authCookie,
    authCookieName: authCookie?.name,
    authCookieLength: authCookie?.value?.length,
  });

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  console.log("Middleware - Session check:", {
    path: req.nextUrl.pathname,
    hasSession: !!session,
    userId: session?.user?.id,
    sessionError: sessionError?.message,
  });

  const path = req.nextUrl.pathname;

  const isAuthPage = path === "/sign-in" || path === "/login" || path === "/register" || path === "/sign-up" || path === "/forgot-password" || path === "/reset-password";
  const isAppPage = path.startsWith("/app");

  // pokud jde na /app a není přihlášený → na login
  if (!session && isAppPage) {
    console.log("Middleware - No session, redirecting to login");
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  // pokud JE přihlášený a jde na sign-in / login / sign-up → pošli ho na /app
  // (ale ne z reset-password, tam může být i přihlášený kvůli reset linku)
  if (session && isAuthPage && path !== "/reset-password") {
    console.log("Middleware - Session found, redirecting to dashboard");
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/app/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: ["/app/:path*", "/sign-in", "/login", "/sign-up", "/register", "/forgot-password", "/reset-password"],
};
