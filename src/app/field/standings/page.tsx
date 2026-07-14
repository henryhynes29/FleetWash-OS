import { requireProfile } from "@/lib/supabase-server";
export const dynamic = "force-dynamic";

export default async function Standings() {
  const { supabase } = await requireProfile();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const [{ data: profiles }, { data: checkoffs }] = await Promise.all([
    supabase.from("profiles").select("user_id, initials, display_name, role").neq("role", "client"),
    supabase.from("unit_checkoffs").select("checked_by, checked_at").gte("checked_at", weekAgo),
  ]);

  const board = (profiles ?? [])
    .map((p) => ({ ...p, u: (checkoffs ?? []).filter((c) => c.checked_by === p.user_id).length }))
    .sort((a, b) => b.u - a.u);
  const max = Math.max(1, ...board.map((b) => b.u));
  const total = (checkoffs ?? []).length;
  const medal = ["🥇", "🥈", "🥉"];

  return (
    <div>
      <h1 className="disp" style={{ fontSize: 22, marginBottom: 4 }}>Standings</h1>
      <div className="dim" style={{ fontSize: 13, marginBottom: 14 }}>
        Trucks washed · rolling 7 days · {total} total across the crew.
      </div>

      {board.length === 0 && (
        <div className="card dim" style={{ textAlign: "center" }}>No wash activity yet this week.</div>
      )}

      {board.map((b, i) => (
        <div key={b.user_id} className="card" style={{ marginBottom: 10, padding: "12px 14px", borderLeft: i === 0 && b.u > 0 ? "5px solid var(--orange)" : undefined }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>
              <span style={{ marginRight: 8 }}>{medal[i] ?? `#${i + 1}`}</span>
              {b.display_name || b.initials} <span className="dim" style={{ fontWeight: 400 }}>({b.initials})</span>
            </span>
            <span className="mono" style={{ fontWeight: 700, fontSize: 15 }}>{b.u} <span className="dim" style={{ fontSize: 12 }}>trucks</span></span>
          </div>
          <div style={{ height: 10, background: "var(--lline)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(b.u / max) * 100}%`, background: i === 0 && b.u > 0 ? "var(--orange)" : "var(--green-d)", borderRadius: 99 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
