import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPlanConfig, PlanId } from "./plan";

export async function getProfile() {
  const cookieStore = cookies();
  
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

  if (userError || !user) {
    return { user: null, profile: null, planConfig: getPlanConfig(null) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Error fetching profile:", profileError);
    return { user, profile: null, planConfig: getPlanConfig(null) };
  }

  const planConfig = getPlanConfig((profile?.plan as PlanId) || null);

  return { user, profile, planConfig };
}

