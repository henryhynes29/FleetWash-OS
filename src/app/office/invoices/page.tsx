import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireProfile, sb } from "@/lib/supabase-server";
import { money, fmtDay } from "@/lib/util";
export const dynamic = "force-dynamic";

async function generateInvoice(clientId: string) {
  "use server";
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: p } = await supabase.from("profiles").select("company_id").eq("user_id", user!.id).single();
  const { data: jobs } = await supabase.from("jobs").select("id, unit_ids, starts_at").eq("client_id", clientId).eq("status", "done");
  if (!jobs?.length) return;
  const { data: checkoffs } = await supabase.from("unit_checkoffs").select("job_id, unit_id").in("job_id", jobs.map((j) => j.id));
  const lines: any[] = [];
  for (const j of jobs) {
    const billed = (checkoffs ?? []).filter((c) => c.job_id === j.id).map((c) => c.unit_id);
    const ids = billed.length ? billed : (j.unit_ids as string[]); // fallback: no checkoffs -> full ticket
    for (const uid of ids) {
      const { data: u } = await supabase.from("units").select("number, asset_type_id, asset_types(name)").eq("id", uid).single();
      if (!u) continue;
      const { data: rate } = await supabase.rpc("resolve_rate", { p_client: clientId, p_asset_type: u.asset_type_id });
      lines.push({ desc: `${(u as any).asset_types?.name ?? "Unit"} wash — ${u.number} (${new Date(j.starts_at).toLocaleDateString("en-US")})`, qty: 1, rate_cents: rate ?? 0 });
    }
  }
  const { count } = await supabase.from("invoices").select("id", { count: "exact", head: true });
  await supabase.from("invoices").insert({
    company_id: p!.company_id, client_id: clientId, number: `INV-${1000 + (count ?? 0) + 1}`, lines, job_ids: jobs.map((j) => j.id),
  });
  await supabase.from("jobs").update({ status: "invoiced" }).in("id", jobs.map((j) => j.id));
  revalidatePath("/office/invoices");
}

async function setStatus(id: string, status: string) {
  "use server";
  await sb().from("invoices").update({ status }).eq("id", id);
  revalidatePath("/office/invoices");
}

export default async function Invoices() {
  const { supabase } = await requireProfile();
  const [{ data: invoices }, { data: clients }, { data: doneJobs }] = await Promise.all([
    supabase.from("invoices").select("*").order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name"),
    supabase.from("jobs").select("client_id").eq("status", "done"),
  ]);
  const cname = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const readyClients = [...new Set((doneJobs ?? []).map((j) => j.client_id))];
  const total = (i: any) => (i.lines as any[]).reduce((s, l) => s + l.qty * l.rate_cents, 0);
  return (
    <div>
      <h1 className="disp" style={{ fontSize: 24, marginBottom: 12 }}>Invoices</h1>
      {readyClients.length > 0 && (
        <div className="card" style={{ borderColor: "var(--orange)", marginBottom: 16 }}>
          <div className="disp dim" style={{ fontSize: 13, marginBottom: 10 }}>Ready to invoice — one click per client</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {readyClients.map((cid) => (
              <form key={cid} action={generateInvoice.bind(null, cid)}>
                <button className="btn btn-primary" style={{ minHeight: 42, fontSize: 14 }}>⚡ {cname.get(cid)}</button>
              </form>
            ))}
          </div>
          <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>Lines auto-build from checked-off units at each client&apos;s resolved rate (deal price → base rate).</div>
        </div>
      )}
      {(invoices ?? []).map((inv) => (
        <div key={inv.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span><a href={`/office/invoices/${inv.id}`} className="mono" style={{ fontWeight: 700, textDecoration: "underline" }}>{inv.number}</a> <span className="dim" style={{ marginLeft: 8 }}>{cname.get(inv.client_id)}</span></span>
            <span className="disp mono" style={{ fontSize: 18, color: inv.status === "paid" ? "var(--green)" : "var(--orange)" }}>{money(total(inv))}</span>
          </div>
          <div className="dim" style={{ fontSize: 13, marginTop: 4 }}>{fmtDay(inv.created_at)} · {(inv.lines as any[]).length} lines · <b style={{ textTransform: "uppercase" }}>{inv.status}</b></div>
          <div className="row" style={{ marginTop: 8 }}>
            {inv.status === "draft" && <form action={setStatus.bind(null, inv.id, "sent")}><button className="pill">Mark sent</button></form>}
            {inv.status === "sent" && <form action={setStatus.bind(null, inv.id, "paid")}><button className="pill" style={{ borderColor: "var(--green)", color: "var(--green)" }}>Mark paid</button></form>}
          </div>
        </div>
      ))}
    </div>
  );
}
