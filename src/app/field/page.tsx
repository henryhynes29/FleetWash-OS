import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireProfile, sb } from "@/lib/supabase-server";
import { materializeRecurring } from "@/lib/recurring";
import { fmtRange, txtOn, type Truck } from "@/lib/util";
import AcidGate from "@/components/AcidGate";
export const dynamic = "force-dynamic";

const HAZ = /acid|brighten|ctc/i;

async function ackHazard() {
  "use server";
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: p } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
  await supabase.from("hazard_acks").upsert({ user_id: user.id, company_id: p!.company_id, day: new Date().toISOString().slice(0, 10) });
  revalidatePath("/field");
}

export default async function FieldHome() {
  const { supabase, user, profile } = await requireProfile();
  await materializeRecurring(supabase);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const [{ data: jobs }, { data: clients }, { data: settings }, { data: ack }] = await Promise.all([
    supabase.from("jobs").select("*").gte("starts_at", start.toISOString()).lt("starts_at", end.toISOString()).neq("status", "invoiced").order("starts_at"),
    supabase.from("clients").select("id, name, address, chems, specialty, kind"),
    supabase.from("company_settings").select("*").single(),
    supabase.from("hazard_acks").select("day").eq("user_id", user!.id).eq("day", new Date().toISOString().slice(0, 10)).maybeSingle(),
  ]);
  const cmap = new Map((clients ?? []).map((c) => [c.id, c]));
  const trucks: Truck[] = settings?.trucks ?? [];
  const truckOf = (id: string) => trucks.find((t) => t.id === id) ?? trucks[0] ?? { id, name: id, color: "#888" };
  const mine = (jobs ?? []).filter((j) => (j.worker_ids as string[]).includes(user!.id));
  const team = (jobs ?? []).filter((j) => !(j.worker_ids as string[]).includes(user!.id));

  // Individual load-out: union of chems across MY jobs today
  const chems = new Map<string, string[]>();
  (settings?.baseline_loadout ?? []).forEach((c: string) => chems.set(c, ["every wash day"]));
  mine.forEach((j) => {
    const cl = cmap.get(j.client_id);
    ((cl?.chems ?? []) as string[]).forEach((c) => chems.set(c, [...(chems.get(c) ?? []), cl!.name]));
  });

  // Acid gate: hazard on MY route, not yet acked today
  const hazardNames = ack ? [] : [...new Set(mine
    .map((j) => cmap.get(j.client_id))
    .filter((c) => c && (((c.chems ?? []) as string[]).some((x) => HAZ.test(x)) || HAZ.test(c.specialty ?? "")))
    .map((c) => c!.name))];

  const JobCard = ({ j }: { j: any }) => {
    const c = cmap.get(j.client_id);
    const t = truckOf(j.truck_id);
    return (
      <Link href={`/field/jobs/${j.id}`} style={{ color: "inherit", display: "block" }}>
        <div className="card" style={{ borderLeft: `6px solid ${t.color}`, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="disp" style={{ fontSize: 16 }}>{c?.name ?? "—"}</span>
            <span style={{ background: t.color, color: txtOn(t.color), borderRadius: 6, padding: "1px 9px", fontSize: 11, fontWeight: 700 }} className="disp">{t.name}</span>
          </div>
          <div className="dim" style={{ fontSize: 14, marginTop: 4 }}>{fmtRange(j.starts_at, j.duration_min)} · {c?.address ?? ""}</div>
        </div>
      </Link>
    );
  };

  return (
    <div>
      <AcidGate hazardNames={hazardNames} ackAction={ackHazard} />
      {mine.length > 0 && (
        <div className="card" style={{ borderTop: "6px solid var(--orange-l)", boxShadow: "0 4px 14px rgba(16,24,40,0.08)", marginBottom: 16 }}>
          <div className="disp" style={{ fontSize: 18 }}>My Load-Out</div>
          <div className="dim" style={{ fontSize: 13, margin: "2px 0 10px" }}>Everything for your {mine.length} stop{mine.length === 1 ? "" : "s"} today — load before you roll.</div>
          {[...chems.entries()].map(([item, sources]) => (
            <div key={item} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: "1px solid var(--lline)" }}>
              <span style={{ fontWeight: 700 }}>{item}</span>
              <span className="dim" style={{ fontSize: 12, textAlign: "right" }}>{[...new Set(sources)].join(", ")}</span>
            </div>
          ))}
        </div>
      )}
      <h1 className="disp" style={{ fontSize: 22, marginBottom: 10 }}>My Jobs Today</h1>
      {mine.length === 0 && <div className="dim" style={{ marginBottom: 12 }}>Nothing assigned to you today.</div>}
      {mine.map((j) => <JobCard key={j.id} j={j} />)}
      {team.length > 0 && (
        <>
          <h2 className="disp dim" style={{ fontSize: 14, margin: "16px 0 8px" }}>Rest of the board</h2>
          {team.map((j) => <JobCard key={j.id} j={j} />)}
        </>
      )}
      {(clients ?? []).filter((c) => c.kind === "refill").map((c) => (
        <div key={c.id} className="card" style={{ marginTop: 8, background: "#EAF3FB" }}>
          <div style={{ fontWeight: 700 }}>💧 {c.name}</div>
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c.address ?? c.name)}`} target="_blank" style={{ fontSize: 13, fontWeight: 700 }}>🧭 {c.address}</a>
          {c.specialty && <div className="dim" style={{ fontSize: 13, marginTop: 4 }}>{c.specialty}</div>}
        </div>
      ))}
    </div>
  );
}
