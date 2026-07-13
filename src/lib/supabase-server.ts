import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export function sb() {
  const store = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "anon",
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (all: { name: string; value: string; options?: CookieOptions }[]) => { try { all.forEach(({ name, value, options }) => store.set(name, value, options)); } catch {} },
      },
    }
  );
}

export async function requireProfile() {
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null as any };
  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
  return { supabase, user, profile };
}
