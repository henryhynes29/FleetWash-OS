import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/supabase-server";
export const dynamic = "force-dynamic";
export default async function Home() {
  const { user, profile } = await requireProfile();
  if (!user) redirect("/login");
  if (!profile) redirect("/onboarding");
  redirect(profile.role === "owner" ? "/office" : profile.role === "client" ? "/portal" : "/field");
}
