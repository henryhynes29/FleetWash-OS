import { requireProfile } from "@/lib/supabase-server";
import { money } from "@/lib/util";
export const dynamic = "force-dynamic";

export default async function FieldMetrics() {
  const { supabase } = await requireProfile();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const [{ data: invoices }, { data: checkoffs }, { data: jobs }] = await Promise.all([
    supabase.from("invoices").select("lines, created_at").gte("created_at", weekAgo),
    supabase.from("unit_checkoffs").select("checked_by").gte("checked_at", weekAgo),
    supabase.from("jobs").select("status, starts_at").gte("starts_at", weekAgo),
  ]);

  const gross = (invoices ?? []).reduce(
    (s, i) => s + (i.lines as any[]).reduce((a, l) => a + l.qty * l.rate_cents, 0), 0);
  const trucks = (checkoffs ?? []).length;
  const jobsList = jobs ?? [];
  const done = jobsList.filter((j) => j.status === "done" || j.status === "invoiced").length;
  const scheduled = jobsList.length;

  const Stat = ({ label, val, sub, color }: { label: string; val: string; sub?: string; color?: string }) => (
    <div className="card" style={{ marginBottom: 10 }}>
      <div className="disp dim" style={{ fontSize: 12 }}>{label}</div>
      <div className="disp mono" style={{ fontSize: 30, color: color ?? "var(--ink)", marginTop: 2 }}>{val}</div>
      {sub && <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div>
      <h1 className="disp" style={{ fontSize: 22, marginBottom: 4 }}>This Week</h1>
      <div className="dim" style={{ fontSize: 13, marginBottom: 14 }}>Rolling 7 days across the whole crew.</div>
      <Stat label="Trucks washed" val={String(trucks)} sub="units checked off" color="var(--orange-l)" />
      <Stat label="Jobs completed" val={`${done}`} sub={`${scheduled} on the board this week`} color="var(--green-d)" />
      <Stat label="Revenue invoiced" val={money(gross)} sub="billed in the last 7 days" color="var(--green-d)" />
    </div>
  );
}
