import Link from "next/link";
import { requireProfile } from "@/lib/supabase-server";
import { fmtRange, txtOn, type Truck } from "@/lib/util";
export const dynamic = "force-dynamic";

export default async function FieldSchedule() {
  const { supabase, user } = await requireProfile();
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 7);

  const [{ data: jobs }, { data: clients }, { data: settings }, { data: profiles }] = await Promise.all([
    supabase.from("jobs").select("*").gte("starts_at", start.toISOString()).lt("starts_at", end.toISOString()).neq("status", "invoiced").order("starts_at"),
    supabase.from("clients").select("id, name, address"),
    supabase.from("company_settings").select("trucks").single(),
    supabase.from("profiles").select("user_id, initials"),
  ]);

  const cmap = new Map((clients ?? []).map((c) => [c.id, c]));
  const imap = new Map((profiles ?? []).map((p) => [p.user_id, p.initials]));
  const trucks: Truck[] = (settings?.trucks as Truck[]) ?? [];
  const truckOf = (id: string) => trucks.find((t) => t.id === id) ?? { id, name: id, color: "#888" };

  // group by calendar day
  const days = new Map<string, any[]>();
  (jobs ?? []).forEach((j) => {
    const key = new Date(j.starts_at).toDateString();
    (days.get(key) ?? days.set(key, []).get(key)!).push(j);
  });

  const dayLabel = (key: string) => {
    const d = new Date(key);
    const isToday = d.toDateString() === now.toDateString();
    return (isToday ? "Today · " : "") + d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  };

  return (
    <div>
      <h1 className="disp" style={{ fontSize: 24, marginBottom: 2 }}>Team Schedule</h1>
      <div className="dim" style={{ fontSize: 13, marginBottom: 14 }}>The whole crew's board — next 7 days.</div>

      {(jobs ?? []).length === 0 && <div className="card dim" style={{ textAlign: "center" }}>Nothing scheduled this week.</div>}

      {[...days.entries()].map(([key, list]) => (
        <div key={key} style={{ marginBottom: 16 }}>
          <div className="disp dim" style={{ fontSize: 13, margin: "0 2px 8px" }}>{dayLabel(key)} · {list.length} stop{list.length === 1 ? "" : "s"}</div>
          {list.map((j) => {
            const c = cmap.get(j.client_id);
            const t = truckOf(j.truck_id);
            const crew = (j.worker_ids as string[]).map((id) => imap.get(id) ?? "?");
            const mine = (j.worker_ids as string[]).includes(user!.id);
            return (
              <Link key={j.id} href={`/field/jobs/${j.id}`} style={{ color: "inherit", display: "block" }}>
                <div className="card" style={{ borderLeft: `6px solid ${t.color}`, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="disp" style={{ fontSize: 16 }}>{c?.name ?? "—"}</span>
                    <span className="disp" style={{ background: t.color, color: txtOn(t.color), borderRadius: 6, padding: "1px 9px", fontSize: 11, fontWeight: 700 }}>{t.name}</span>
                  </div>
                  <div className="dim" style={{ fontSize: 14, marginTop: 4 }}>{fmtRange(j.starts_at, j.duration_min)} · {c?.address ?? ""}</div>
                  <div style={{ fontSize: 12, marginTop: 6, fontWeight: 700, color: mine ? "var(--orange-l)" : "var(--ink-soft)" }}>
                    {crew.length ? (mine ? "You" + (crew.length > 1 ? " +" + (crew.length - 1) : "") : "Crew: " + crew.join(", ")) : "Unassigned"}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}
