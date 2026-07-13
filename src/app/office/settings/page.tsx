import { revalidatePath } from "next/cache";
import { requireProfile, sb } from "@/lib/supabase-server";
import { money } from "@/lib/util";
export const dynamic = "force-dynamic";

async function createInvite(formData: FormData) {
  "use server";
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: p } = await supabase.from("profiles").select("company_id").eq("user_id", user!.id).single();
  const clientId = String(formData.get("client_id") || "");
  await supabase.from("invites").insert({
    company_id: p!.company_id, created_by: user!.id,
    role: clientId ? "client" : "worker",
    client_id: clientId || null,
    initials: String(formData.get("initials") || "").toUpperCase() || null,
    display_name: String(formData.get("name") || "") || null,
  });
  revalidatePath("/office/settings");
}
async function updateRate(userId: string, formData: FormData) {
  "use server";
  await sb().from("profiles").update({ hourly_cents: Math.round(Number(formData.get("rate")) * 100) || 0 }).eq("user_id", userId);
  revalidatePath("/office/settings");
}
async function addAssetType(formData: FormData) {
  "use server";
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: p } = await supabase.from("profiles").select("company_id").eq("user_id", user!.id).single();
  const { data: t } = await supabase.from("asset_types").insert({ company_id: p!.company_id, name: String(formData.get("name") || "").trim() }).select().single();
  if (t) await supabase.from("rate_matrix").insert({ company_id: p!.company_id, asset_type_id: t.id, rate_cents: Math.round(Number(formData.get("rate")) * 100) || 0 });
  revalidatePath("/office/settings");
}

export default async function Settings() {
  const { supabase } = await requireProfile();
  const [{ data: profiles }, { data: invites }, { data: types }, { data: rates }, { data: clients }] = await Promise.all([
    supabase.from("profiles").select("*").order("initials"),
    supabase.from("invites").select("*").is("redeemed_by", null).gt("expires_at", new Date().toISOString()),
    supabase.from("asset_types").select("*").order("sort"),
    supabase.from("rate_matrix").select("*"),
    supabase.from("clients").select("id, name").eq("kind", "client").order("name"),
  ]);
  const rateOf = new Map((rates ?? []).map((r) => [r.asset_type_id, r.rate_cents]));
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return (
    <div>
      <h1 className="disp" style={{ fontSize: 24, marginBottom: 16 }}>Settings</h1>

      <div className="disp dim" style={{ fontSize: 13, marginBottom: 8 }}>Employees</div>
      <div className="card" style={{ marginBottom: 16 }}>
        {(profiles ?? []).map((p) => (
          <div key={p.user_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
            <span><b>{p.initials}</b> · {p.display_name} <span className="dim" style={{ fontSize: 12 }}>{p.role}</span></span>
            <form action={updateRate.bind(null, p.user_id)} className="row">
              <span className="dim">$</span>
              <input className="inp mono" name="rate" defaultValue={(p.hourly_cents / 100).toFixed(2)} style={{ width: 90, textAlign: "right", minHeight: 40 }} />
              <span className="dim">/hr</span>
              <button className="pill">Save</button>
            </form>
          </div>
        ))}
        <form action={createInvite} className="row" style={{ marginTop: 12, flexWrap: "wrap" }}>
          <input className="inp" name="name" placeholder="New hire full name" style={{ flex: 1, minWidth: 160 }} />
          <input className="inp" name="initials" placeholder="Initials" maxLength={3} style={{ width: 90 }} />
          <select className="inp" name="client_id" style={{ minWidth: 170, flex: 1 }}>
            <option value="">Crew member (field access)</option>
            {(clients ?? []).map((c) => <option key={c.id} value={c.id}>Fleet manager — {c.name}</option>)}
          </select>
          <button className="btn btn-green" style={{ minHeight: 44, fontSize: 14 }}>Create invite link</button>
        </form>
        {(invites ?? []).map((i) => (
          <div key={i.id} className="mono" style={{ fontSize: 12, color: "var(--green)", marginTop: 8, wordBreak: "break-all" }}>
            {i.display_name || i.initials || "invite"} → {site}/join/{i.id}
          </div>
        ))}
        <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>Text the link to the new hire — they sign in with email and land in your company as a worker.</div>
      </div>

      <div className="disp dim" style={{ fontSize: 13, marginBottom: 8 }}>Asset types &amp; base rates</div>
      <div className="card">
        {(types ?? []).map((t) => (
          <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
            <span style={{ fontWeight: 700 }}>{t.name}</span>
            <span className="mono">{money(rateOf.get(t.id) ?? 0)}</span>
          </div>
        ))}
        <form action={addAssetType} className="row" style={{ marginTop: 12, flexWrap: "wrap" }}>
          <input className="inp" name="name" placeholder="Asset type (e.g. 53' Reefer)" required style={{ flex: 1, minWidth: 160 }} />
          <input className="inp mono" name="rate" placeholder="Rate $" style={{ width: 110 }} />
          <button className="btn btn-ghost">Add</button>
        </form>
        <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>Client-specific deal pricing overrides these — set on each client page (v1.1) or directly in <span className="mono">client_rate_overrides</span>.</div>
      </div>
    </div>
  );
}
