import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile, sb } from "@/lib/supabase-server";
import { money, fmtDay, fmtTime } from "@/lib/util";
export const dynamic = "force-dynamic";

async function approveInvoice(id: string) {
  "use server";
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("invoices").update({ approved_at: new Date().toISOString(), approved_by: user.id }).eq("id", id);
  revalidatePath("/portal");
}

export default async function Portal() {
  const { supabase, user, profile } = await requireProfile();
  if (!user) redirect("/login");
  if (!profile || profile.role !== "client" || !profile.client_id) redirect("/");
  const [{ data: client }, { data: company }, { data: invoices }, { data: jobs }] = await Promise.all([
    supabase.from("clients").select("name").eq("id", profile.client_id).single(),
    supabase.from("companies").select("name").single(),
    supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(12),
    supabase.from("jobs").select("id, starts_at, status").order("starts_at", { ascending: false }).limit(15),
  ]);
  const jobIds = (jobs ?? []).map((j) => j.id);
  const { data: checkoffs } = jobIds.length
    ? await supabase.from("unit_checkoffs").select("job_id, unit_id, checked_at").in("job_id", jobIds)
    : { data: [] as any[] };
  const unitIds = [...new Set((checkoffs ?? []).map((c) => c.unit_id))];
  const { data: units } = unitIds.length
    ? await supabase.from("units").select("id, number, asset_types(name)").in("id", unitIds)
    : { data: [] as any[] };
  const uname = new Map((units ?? []).map((u) => [u.id, u]));
  const total = (i: any) => (i.lines as any[]).reduce((s, l) => s + l.qty * l.rate_cents, 0);
  const upcoming = (jobs ?? []).filter((j) => new Date(j.starts_at).getTime() > Date.now()).slice(-3);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "18px 16px 60px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span className="disp" style={{ fontSize: 18 }}>{company?.name ?? "FleetWash OS"}</span>
        <span className="dim" style={{ fontSize: 13 }}>Fleet portal</span>
      </header>
      <h1 className="disp" style={{ fontSize: 24, marginBottom: 16 }}>{client?.name}</h1>

      {upcoming.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="disp dim" style={{ fontSize: 13, marginBottom: 8 }}>Upcoming service</div>
          {upcoming.map((j) => <div key={j.id} style={{ fontWeight: 700, padding: "4px 0" }}>{fmtDay(j.starts_at)} · {fmtTime(j.starts_at)}</div>)}
        </div>
      )}

      <div className="disp dim" style={{ fontSize: 13, marginBottom: 8 }}>Invoices</div>
      {(invoices ?? []).map((inv) => (
        <div key={inv.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span><span className="mono" style={{ fontWeight: 700 }}>{inv.number}</span> <span className="dim" style={{ marginLeft: 8, fontSize: 13 }}>{fmtDay(inv.created_at)} · {(inv.lines as any[]).length} washes</span></span>
            <span className="disp mono" style={{ fontSize: 18, color: inv.status === "paid" ? "var(--green)" : "var(--orange)" }}>{money(total(inv))}</span>
          </div>
          <div className="row" style={{ marginTop: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
            <span className="dim" style={{ fontSize: 13, textTransform: "uppercase", fontWeight: 700 }}>{inv.status}{inv.approved_at ? " · ✓ approved" : ""}</span>
            {!inv.approved_at && (
              <form action={approveInvoice.bind(null, inv.id)}>
                <button className="btn btn-green" style={{ minHeight: 40, fontSize: 13 }}>✓ Approve wash list</button>
              </form>
            )}
          </div>
        </div>
      ))}
      {(invoices ?? []).length === 0 && <div className="dim" style={{ marginBottom: 16 }}>No invoices yet.</div>}

      <div className="disp dim" style={{ fontSize: 13, margin: "18px 0 8px" }}>Recent washes</div>
      {(checkoffs ?? []).slice(0, 25).map((c, i) => {
        const u = uname.get(c.unit_id);
        return (
          <div key={i} className="card" style={{ marginBottom: 6, padding: "10px 14px", display: "flex", justifyContent: "space-between" }}>
            <span className="mono" style={{ fontWeight: 700 }}>{u?.number ?? "—"} <span className="dim" style={{ fontWeight: 400, fontSize: 13 }}>{(u as any)?.asset_types?.name ?? ""}</span></span>
            <span className="dim" style={{ fontSize: 13 }}>{fmtDay(c.checked_at)} {fmtTime(c.checked_at)}</span>
          </div>
        );
      })}
    </div>
  );
}
