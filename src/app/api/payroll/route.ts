import { sb } from "@/lib/supabase-server";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("user_id", user.id).single();
  if (me?.role !== "owner") return new Response("forbidden", { status: 403 });
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const [{ data: sheet }, { data: profiles }] = await Promise.all([
    supabase.from("timesheet").select("*").gte("clock_in", weekAgo).not("clock_out", "is", null).order("clock_in"),
    supabase.from("profiles").select("user_id, initials, display_name, hourly_cents"),
  ]);
  const who = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const rows = [["Worker", "Name", "Date", "In", "Out", "Hours", "Rate", "Gross"]];
  const totals = new Map<string, number>();
  (sheet ?? []).forEach((e) => {
    const p = who.get(e.user_id);
    const hrs = (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000;
    const gross = hrs * ((p?.hourly_cents ?? 0) / 100);
    rows.push([
      p?.initials ?? "?", p?.display_name ?? "", new Date(e.clock_in).toLocaleDateString(),
      new Date(e.clock_in).toLocaleTimeString(), new Date(e.clock_out).toLocaleTimeString(),
      hrs.toFixed(2), ((p?.hourly_cents ?? 0) / 100).toFixed(2), gross.toFixed(2),
    ]);
    totals.set(p?.initials ?? "?", (totals.get(p?.initials ?? "?") ?? 0) + gross);
  });
  rows.push([]);
  totals.forEach((g, w) => rows.push([w + " TOTAL", "", "", "", "", "", "", g.toFixed(2)]));
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="payroll-week.csv"' } });
}
