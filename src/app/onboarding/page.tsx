import { redirect } from "next/navigation";
import { requireProfile, sb } from "@/lib/supabase-server";
export const dynamic = "force-dynamic";

async function createCompany(formData: FormData) {
  "use server";
  const supabase = sb();
  const { error } = await supabase.rpc("create_company", {
    p_name: String(formData.get("company") || "").trim(),
    p_initials: String(formData.get("initials") || "").trim().toUpperCase(),
    p_display: String(formData.get("name") || "").trim(),
  });
  if (error) throw new Error(error.message);
  redirect("/office");
}

export default async function Onboarding() {
  const { user, profile } = await requireProfile();
  if (!user) redirect("/login");
  if (profile) redirect("/");
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <form action={createCompany} className="card" style={{ width: "100%", maxWidth: 420 }}>
        <div className="disp" style={{ fontSize: 20, marginBottom: 4 }}>Set up your company</div>
        <div className="dim" style={{ fontSize: 14, marginBottom: 16 }}>You'll be the owner account. Crew joins later via invite links.</div>
        <input className="inp" name="company" placeholder="Company name (e.g. Mobile Wash Co)" required style={{ marginBottom: 10 }} />
        <input className="inp" name="name" placeholder="Your full name" required style={{ marginBottom: 10 }} />
        <input className="inp" name="initials" placeholder="Your initials (e.g. HH)" maxLength={3} required style={{ marginBottom: 14 }} />
        <button className="btn btn-primary" style={{ width: "100%" }}>Create company →</button>
      </form>
    </main>
  );
}
