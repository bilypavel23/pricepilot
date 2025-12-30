import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getProfile() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
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
          } catch (err) {
            // Ignore cookie setting errors in getProfile
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
            // Ignore cookie removal errors
          }
        },
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  console.log("getProfile - user check:", { 
    hasUser: !!user, 
    userId: user?.id,
    error: userError?.message 
  });

  if (userError || !user) {
    return { user: null, profile: null };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Error fetching profile:", profileError);
    return { user, profile: null };
  }

  return { user, profile };
}

