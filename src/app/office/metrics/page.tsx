import { requireProfile } from "@/lib/supabase-server";
import { money } from "@/lib/util";
export const dynamic = "force-dynamic";

const CHEM_PER_UNIT_CENTS = 200;

export default async function Metrics() {
  const { supabase } = await requireProfile();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const [{ data: invoices }, { data: entries }, { data: profiles }, { data: checkoffs }] = await Promise.all([
    supabase.from("invoices").select("lines, created_at").gte("created_at", weekAgo),
    supabase.from("timesheet").select("*").gte("clock_in", weekAgo).not("clock_out", "is", null),
    supabase.from("profiles").select("user_id, initials, display_name, hourly_cents"),
    supabase.from("unit_checkoffs").select("checked_by, checked_at").gte("checked_at", weekAgo),
  ]);
  const gross = (invoices ?? []).reduce((s, i) => s + (i.lines as any[]).reduce((a, l) => a + l.qty * l.rate_cents, 0), 0);
  const who = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const labor = (entries ?? []).reduce((s, e) => {
    const hrs = (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000;
    return s + hrs * (who.get(e.user_id)?.hourly_cents ?? 0);
  }, 0);
  const units = (checkoffs ?? []).length;
  const chem = units * CHEM_PER_UNIT_CENTS;
  const net = gross - labor - chem;
  const pct = gross > 0 ? Math.round((net / gross) * 100) : 0;
  const health = pct >= 45 ? { label: "HEALTHY", color: "var(--green)" } : pct >= 25 ? { label: "WATCH", color: "#F0C36D" } : { label: "LOW MARGIN", color: "var(--red)" };

  const board = (profiles ?? []).map((p) => {
    const u = (checkoffs ?? []).filter((c) => c.checked_by === p.user_id).length;
    const hrs = (entries ?? []).filter((e) => e.user_id === p.user_id)
      .reduce((s, e) => s + (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000, 0);
    return { ...p, u, hrs, rate: hrs > 0 ? u / hrs : 0 };
  }).sort((a, b) => b.u - a.u);
  const max = Math.max(1, ...board.map((b) => b.u));
  const fastest = board.filter((b) => b.u > 0 && b.hrs > 0).sort((a, b) => b.rate - a.rate)[0];

  const Row = ({ label, val, color }: { label: string; val: string; color?: string }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid var(--line)", fontSize: 15 }}>
      <span className="dim" style={{ fontWeight: 600 }}>{label}</span>
      <span className="mono" style={{ fontWeight: 700, color: color ?? "var(--text)" }}>{val}</span>
    </div>
  );

  return (
    <div>
      <h1 className="disp" style={{ fontSize: 24, marginBottom: 16 }}>Metrics — rolling 7 days</h1>
      <div className="disp dim" style={{ fontSize: 13, marginBottom: 8 }}>Job profit / loss</div>
      <div className="card" style={{ borderLeft: `5px solid ${health.color}`, marginBottom: 18 }}>
        <Row label="Gross revenue (invoiced)" val={money(gross)} color="var(--green)" />
        <Row label={`Labor cost (${(entries ?? []).length} shifts)`} val={"−" + money(labor)} color="var(--red)" />
        <Row label={`Est. chemical burn (${units} units × $2.00)`} val={"−" + money(chem)} color="var(--red)" />
        <div style={{ marginTop: 12, background: "var(--navy)", border: `2px solid ${health.color}`, borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="disp" style={{ color: health.color, fontSize: 14 }}>Net margin · {health.label}</span>
          <span className="disp mono" style={{ color: health.color, fontSize: 24 }}>{money(net)} <span style={{ fontSize: 14 }}>({pct}%)</span></span>
        </div>
        <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>Labor is straight-time here; the payroll engine applies overtime when you run payroll.</div>
      </div>
      {fastest && (
        <div className="card" style={{ borderColor: "var(--orange)", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span><span className="disp" style={{ color: "var(--orange)" }}>♛ Fastest washer</span> <b style={{ marginLeft: 8 }}>{fastest.display_name}</b></span>
          <span className="mono dim">{fastest.rate.toFixed(2)} units/hr</span>
        </div>
      )}
      <div className="disp dim" style={{ fontSize: 13, marginBottom: 8 }}>Units washed — leaderboard</div>
      {board.map((b) => (
        <div key={b.user_id} className="card" style={{ marginBottom: 8, padding: "10px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontWeight: 700 }}>{b.initials} <span className="dim" style={{ fontWeight: 400 }}>{b.display_name}</span></span>
            <span className="mono dim" style={{ fontSize: 13 }}>{b.u} units · {b.hrs.toFixed(1)} hr</span>
          </div>
          <div style={{ height: 8, background: "var(--navy)", borderRadius: 99 }}>
            <div style={{ height: "100%", width: `${(b.u / max) * 100}%`, background: "var(--orange)", borderRadius: 99 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
