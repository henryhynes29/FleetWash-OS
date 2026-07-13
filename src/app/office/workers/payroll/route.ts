import { sb } from "@/lib/supabase-server";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = sb();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const [{ data: profiles }, { data: entries }] = await Promise.all([
    supabase.from("profiles").select("user_id, initials, display_name, hourly_cents"),
    supabase.from("timesheet").select("*").gte("clock_in", weekAgo).not("clock_out", "is", null).order("clock_in"),
  ]);
  const who = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const rows = [["Worker", "Initials", "Date", "In", "Out", "Hours", "Rate", "Gross"]];
  const totals = new Map<string, number>();
  for (const e of entries ?? []) {
    const p = who.get(e.user_id);
    const hrs = (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000;
    const rate = (p?.hourly_cents ?? 0) / 100;
    rows.push([p?.display_name ?? "?", p?.initials ?? "?", new Date(e.clock_in).toLocaleDateString("en-US"),
      new Date(e.clock_in).toLocaleTimeString("en-US"), new Date(e.clock_out).toLocaleTimeString("en-US"),
      hrs.toFixed(2), rate.toFixed(2), (hrs * rate).toFixed(2)]);
    totals.set(p?.initials ?? "?", (totals.get(p?.initials ?? "?") ?? 0) + hrs * rate);
  }
  rows.push([]);
  totals.forEach((g, w) => rows.push([`${w} TOTAL`, "", "", "", "", "", "", g.toFixed(2)]));
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="payroll-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
