import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireProfile, sb } from "@/lib/supabase-server";
export const dynamic = "force-dynamic";

async function updateClient(id: string, formData: FormData) {
  "use server";
  const fields = ["contact","phone","address","terms","arrival","frequency","fleet_notes","specialty","complaints","wash_time","washers"] as const;
  const patch: Record<string, string> = {};
  fields.forEach((f) => { patch[f] = String(formData.get(f) ?? ""); });
  await sb().from("clients").update(patch).eq("id", id);
  revalidatePath(`/office/clients/${id}`);
}
async function toggleChem(id: string, chem: string, on: boolean) {
  "use server";
  const supabase = sb();
  const { data: c } = await supabase.from("clients").select("chems").eq("id", id).single();
  const set = new Set<string>((c?.chems ?? []) as string[]);
  on ? set.delete(chem) : set.add(chem);
  await supabase.from("clients").update({ chems: [...set] }).eq("id", id);
  revalidatePath(`/office/clients/${id}`);
}
async function setOverride(clientId: string, assetTypeId: string, formData: FormData) {
  "use server";
  const supabase = sb();
  const raw = String(formData.get("rate") ?? "").trim();
  if (raw === "") {
    await supabase.from("client_rate_overrides").delete().match({ client_id: clientId, asset_type_id: assetTypeId });
  } else {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: p } = await supabase.from("profiles").select("company_id").eq("user_id", user!.id).single();
    await supabase.from("client_rate_overrides").upsert({
      company_id: p!.company_id, client_id: clientId, asset_type_id: assetTypeId,
      rate_cents: Math.round(parseFloat(raw) * 100) || 0,
    });
  }
  revalidatePath(`/office/clients/${clientId}`);
}

async function addUnit(id: string, formData: FormData) {
  "use server";
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: p } = await supabase.from("profiles").select("company_id").eq("user_id", user!.id).single();
  await supabase.from("units").insert({
    company_id: p!.company_id, client_id: id,
    number: String(formData.get("number") || "").trim(),
    asset_type_id: String(formData.get("type")) || null,
  });
  revalidatePath(`/office/clients/${id}`);
}

export default async function ClientDetail({ params }: { params: { id: string } }) {
  const { supabase } = await requireProfile();
  const [{ data: c }, { data: units }, { data: types }, { data: settings }, { data: base }, { data: ovr }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", params.id).single(),
    supabase.from("units").select("*, asset_types(name)").eq("client_id", params.id),
    supabase.from("asset_types").select("*").order("sort"),
    supabase.from("company_settings").select("chem_catalog").single(),
    supabase.from("rate_matrix").select("*"),
    supabase.from("client_rate_overrides").select("*").eq("client_id", params.id),
  ]);
  const baseOf = new Map((base ?? []).map((r) => [r.asset_type_id, r.rate_cents]));
  const ovrOf = new Map((ovr ?? []).map((r) => [r.asset_type_id, r.rate_cents]));
  if (!c) return <div>Not found</div>;
  const catalog = (settings?.chem_catalog ?? []) as string[];
  const upd = updateClient.bind(null, c.id);
  return (
    <div>
      <Link href="/office/clients">← All clients</Link>
      <h1 className="disp" style={{ fontSize: 24, margin: "8px 0 12px" }}>{c.name}</h1>
      <form action={upd} className="card" style={{ marginBottom: 16 }}>
        <div className="disp dim" style={{ fontSize: 13, marginBottom: 10 }}>Location card</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8 }}>
          <input className="inp" name="contact" defaultValue={c.contact} placeholder="Contact" />
          <input className="inp" name="phone" defaultValue={c.phone} placeholder="Phone" />
          <input className="inp" name="address" defaultValue={c.address} placeholder="Address" />
          <input className="inp" name="terms" defaultValue={c.terms} placeholder="Terms" />
          <input className="inp" name="arrival" defaultValue={c.arrival} placeholder="Arrival window" />
          <input className="inp" name="frequency" defaultValue={c.frequency} placeholder="Frequency" />
          <input className="inp" name="wash_time" defaultValue={c.wash_time} placeholder="Wash time" />
          <input className="inp" name="washers" defaultValue={c.washers} placeholder="Washers needed" />
        </div>
        <textarea className="inp" name="fleet_notes" defaultValue={c.fleet_notes} placeholder="Fleet" rows={2} style={{ marginTop: 8, paddingTop: 10 }} />
        <textarea className="inp" name="specialty" defaultValue={c.specialty} placeholder="Specialty info — gate codes, procedures (crew sees this on every job)" rows={3} style={{ marginTop: 8, paddingTop: 10 }} />
        <textarea className="inp" name="complaints" defaultValue={c.complaints} placeholder="Common complaints" rows={2} style={{ marginTop: 8, paddingTop: 10 }} />
        <button className="btn btn-primary" style={{ marginTop: 10 }}>Save</button>
      </form>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="disp dim" style={{ fontSize: 13, marginBottom: 10 }}>Required chems &amp; gear → crew load-out</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {catalog.map((chem) => {
            const on = ((c.chems ?? []) as string[]).includes(chem);
            return (
              <form key={chem} action={toggleChem.bind(null, c.id, chem, on)}>
                <button className="pill" style={on ? { background: "var(--orange)", color: "#1A0D00", borderColor: "var(--orange)" } : {}}>{on ? "✓ " : ""}{chem}</button>
              </form>
            );
          })}
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="disp dim" style={{ fontSize: 13, marginBottom: 4 }}>Client pricing</div>
        <div className="dim" style={{ fontSize: 13, marginBottom: 8 }}>Blank = your base rate. Enter a number to lock a deal price for this client only.</div>
        {(types ?? []).map((t) => {
          const has = ovrOf.has(t.id);
          return (
            <form key={t.id} action={setOverride.bind(null, params.id, t.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid var(--line)" }}>
              <span style={{ fontWeight: 700 }}>{t.name}
                <span style={{ fontSize: 12, marginLeft: 8, color: has ? "var(--orange)" : "var(--dim)", fontWeight: 700 }}>
                  {has ? "DEAL PRICE" : `base $${((baseOf.get(t.id) ?? 0) / 100).toFixed(2)}`}
                </span>
              </span>
              <span className="row">
                <span className="dim">$</span>
                <input className="inp mono" name="rate" defaultValue={has ? ((ovrOf.get(t.id) ?? 0) / 100).toFixed(2) : ""} placeholder={((baseOf.get(t.id) ?? 0) / 100).toFixed(2)} style={{ width: 100, textAlign: "right", minHeight: 40, borderColor: has ? "var(--orange)" : "var(--line)" }} />
                <button className="pill">Save</button>
              </span>
            </form>
          );
        })}
      </div>
      <div className="card">
        <div className="disp dim" style={{ fontSize: 13, marginBottom: 10 }}>Unit roster</div>
        {(units ?? []).map((u) => (
          <div key={u.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
            <span className="mono" style={{ fontWeight: 700 }}>{u.number}</span>
            <span className="dim">{(u as any).asset_types?.name ?? "—"}</span>
          </div>
        ))}
        <form action={addUnit.bind(null, c.id)} className="row" style={{ marginTop: 10, flexWrap: "wrap" }}>
          <input className="inp" name="number" placeholder="Unit #" required style={{ flex: 1, minWidth: 140 }} />
          <select className="inp" name="type" style={{ flex: 1, minWidth: 140 }}>
            {(types ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button className="btn btn-ghost">Add unit</button>
        </form>
      </div>
    </div>
  );
}
