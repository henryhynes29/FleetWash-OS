import { requireProfile } from "@/lib/supabase-server";
import { money, fmtDay } from "@/lib/util";
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { supabase } = await requireProfile();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const [{ count: todayCt }, { data: doneJobs }, { data: invoices }, { data: notes }] = await Promise.all([
    supabase.from("jobs").select("id", { count: "exact", head: true }).gte("starts_at", start.toISOString()),
    supabase.from("jobs").select("id, client_id").eq("status", "done"),
    supabase.from("invoices").select("status, lines"),
    supabase.from("notes").select("*").order("created_at", { ascending: false }).limit(3),
  ]);
  const { count: washCt } = await supabase.from("unit_checkoffs").select("*", { count: "exact", head: true });
  const doneIds = (doneJobs ?? []).map((j) => j.id);
  const { data: doneChecks } = doneIds.length
    ? await supabase.from("unit_checkoffs").select("job_id").in("job_id", doneIds)
    : { data: [] as { job_id: string }[] };
  const logged = new Set((doneChecks ?? []).map((c) => c.job_id));
  const zeroDone = (doneJobs ?? []).filter((j) => !logged.has(j.id));
  const outstanding = (invoices ?? []).filter((i) => i.status === "sent")
    .reduce((s, i) => s + (i.lines as any[]).reduce((a, l) => a + l.qty * l.rate_cents, 0), 0);

  return (
    <div>
      <h1 className="disp" style={{ fontSize: 24, marginBottom: 16 }}>Dashboard</h1>
      {zeroDone.length > 0 && (
        <div className="card" style={{ border: "1.5px solid var(--red)", marginBottom: 14 }}>
          <div style={{ color: "var(--red)", fontWeight: 700 }}>⚠ {zeroDone.length} finished job{zeroDone.length === 1 ? "" : "s"} with no units logged — billing $0</div>
          <div className="dim" style={{ fontSize: 13, marginTop: 4 }}>Get the unit numbers from the crew before generating invoices.</div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 20 }}>
        <div className="card"><div className="dim" style={{ fontSize: 13 }}>Jobs today</div><div className="disp" style={{ fontSize: 26, marginTop: 4 }}>{todayCt ?? 0}</div></div>
        <div className="card" style={{ borderColor: (doneJobs ?? []).length ? "var(--orange)" : "var(--line)" }}><div className="dim" style={{ fontSize: 13 }}>Jobs ready to invoice</div><div className="disp" style={{ fontSize: 26, marginTop: 4, color: (doneJobs ?? []).length ? "var(--orange)" : "inherit" }}>{(doneJobs ?? []).length}</div></div>
        <div className="card"><div className="dim" style={{ fontSize: 13 }}>Outstanding</div><div className="disp" style={{ fontSize: 26, marginTop: 4 }}>{money(outstanding)}</div></div>
        <div className="card"><div className="dim" style={{ fontSize: 13 }}>Washes recorded (all time)</div><div className="disp" style={{ fontSize: 26, marginTop: 4, color: "var(--green)" }}>{washCt ?? 0}</div></div>
      </div>
      <div className="disp dim" style={{ fontSize: 13, marginBottom: 8 }}>Latest field notes</div>
      {(notes ?? []).map((n) => (
        <div key={n.id} className="card" style={{ marginBottom: 8 }}>
          <div style={{ color: "var(--orange)", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>{n.category}</div>
          <div style={{ marginTop: 3, fontSize: 14 }}>{n.body}</div>
          <div className="dim" style={{ fontSize: 12, marginTop: 5 }}>{fmtDay(n.created_at)}</div>
        </div>
      ))}
    </div>
  );
}
