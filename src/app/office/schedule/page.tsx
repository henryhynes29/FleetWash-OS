import { revalidatePath } from "next/cache";
import { requireProfile, sb } from "@/lib/supabase-server";
import { materializeRecurring } from "@/lib/recurring";
import { fmtRange, txtOn, type Truck } from "@/lib/util";
export const dynamic = "force-dynamic";

async function createJob(formData: FormData) {
  "use server";
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: p } = await supabase.from("profiles").select("company_id").eq("user_id", user!.id).single();
  const starts = new Date(`${formData.get("date")}T${formData.get("time")}`).toISOString();
  const rec = Number(formData.get("repeat")) || null;
  const { data: created } = await supabase.from("jobs").insert({
    company_id: p!.company_id,
    client_id: String(formData.get("client")),
    starts_at: starts,
    duration_min: Number(formData.get("duration")) || null,
    truck_id: String(formData.get("truck")),
    worker_ids: formData.getAll("workers").map(String),
    unit_ids: [],
    recurrence_days: rec,
  }).select("id").single();
  if (rec && created) await supabase.from("jobs").update({ series_id: created.id }).eq("id", created.id);
  revalidatePath("/office/schedule");
}

async function assign(jobId: string, userId: string, on: boolean) {
  "use server";
  const supabase = sb();
  const { data: j } = await supabase.from("jobs").select("worker_ids").eq("id", jobId).single();
  const set = new Set<string>(j?.worker_ids ?? []);
  on ? set.delete(userId) : set.add(userId);
  await supabase.from("jobs").update({ worker_ids: [...set] }).eq("id", jobId);
  revalidatePath("/office/schedule");
}

function availOn(av: any, dt: Date) {
  if (!av?.days) return true;
  if (!av.days[dt.getDay()]) return false;
  const hm = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
  return (!av.from || hm >= av.from) && (!av.to || hm <= av.to);
}

export default async function Schedule({ searchParams }: { searchParams: { d?: string } }) {
  const { supabase } = await requireProfile();
  await materializeRecurring(supabase);
  const off = Number(searchParams.d ?? 0);
  const day = new Date(); day.setDate(day.getDate() + off); day.setHours(0, 0, 0, 0);
  const end = new Date(day); end.setDate(end.getDate() + 1);
  const [{ data: jobs }, { data: clients }, { data: profiles }, { data: settings }, { data: timeoff }] = await Promise.all([
    supabase.from("jobs").select("*").gte("starts_at", day.toISOString()).lt("starts_at", end.toISOString()).neq("status", "invoiced").order("starts_at"),
    supabase.from("clients").select("id, name").eq("kind", "client").order("name"),
    supabase.from("profiles").select("user_id, initials, display_name, availability"),
    supabase.from("company_settings").select("trucks").single(),
    supabase.from("timeoff").select("*"),
  ]);
  const trucks: Truck[] = settings?.trucks ?? [];
  const dayISO = day.toISOString().slice(0, 10);
  const offToday = new Set((timeoff ?? []).filter((t) => t.start_date <= dayISO && dayISO <= t.end_date).map((t) => t.user_id));
  const cname = new Map((clients ?? []).map((c) => [c.id, c.name]));

  return (
    <div>
      <h1 className="disp" style={{ fontSize: 24, marginBottom: 12 }}>Scheduling</h1>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 16 }}>
        {Array.from({ length: 14 }, (_, i) => {
          const d = new Date(); d.setDate(d.getDate() + i);
          return <a key={i} href={`/office/schedule?d=${i}`} className={`pill ${i === off ? "on" : ""}`} style={{ whiteSpace: "nowrap" }}>{d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</a>;
        })}
      </div>
      {(jobs ?? []).map((j) => {
        const t = trucks.find((x) => x.id === j.truck_id) ?? trucks[0];
        const jd = new Date(j.starts_at);
        const fillable = (profiles ?? []).filter((p) => !offToday.has(p.user_id) && availOn(p.availability, jd));
        return (
          <div key={j.id} className="card" style={{ marginBottom: 10, borderLeft: `6px solid ${t?.color ?? "#888"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700 }}>{cname.get(j.client_id)}</span>
              <span className="dim" style={{ fontSize: 13 }}>{fmtRange(j.starts_at, j.duration_min)} · <span style={{ background: t?.color, color: txtOn(t?.color ?? "#888"), borderRadius: 5, padding: "0 7px", fontSize: 11, fontWeight: 700 }}>{t?.name}</span></span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {fillable.map((p) => {
                const on = (j.worker_ids as string[]).includes(p.user_id);
                return (
                  <form key={p.user_id} action={assign.bind(null, j.id, p.user_id, on)}>
                    <button className="pill" style={on ? { background: "var(--orange)", color: "#1A0D00", borderColor: "var(--orange)" } : {}}>{on ? "✓ " : "+ "}{p.initials}</button>
                  </form>
                );
              })}
              {fillable.length === 0 && <span style={{ color: "var(--red)", fontWeight: 700, fontSize: 13 }}>Nobody available for this slot.</span>}
            </div>
          </div>
        );
      })}
      {(jobs ?? []).length === 0 && <div className="dim" style={{ marginBottom: 14 }}>Nothing scheduled this day.</div>}
      <form action={createJob} className="card" style={{ marginTop: 16 }}>
        <div className="disp dim" style={{ fontSize: 13, marginBottom: 10 }}>+ Schedule job</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
          <select className="inp" name="client" required>{(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <input className="inp" type="date" name="date" defaultValue={dayISO} required />
          <input className="inp" type="time" name="time" defaultValue="09:00" required />
          <input className="inp" type="number" name="duration" placeholder="Duration (min)" />
          <select className="inp" name="truck">{trucks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <select className="inp" name="repeat">
            <option value="">Doesn&apos;t repeat</option>
            <option value="7">Weekly</option><option value="14">Bi-weekly</option>
            <option value="21">Every 3 weeks</option><option value="28">Every 4 weeks</option>
            <option value="60">Every 60 days</option>
          </select>
          <select className="inp" name="repeat">
            <option value="">Doesn&apos;t repeat</option>
            <option value="7">Weekly</option><option value="14">Bi-weekly</option>
            <option value="21">Every 3 weeks</option><option value="28">Every 4 weeks</option><option value="60">Every 60 days</option>
          </select>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 10 }}>Schedule</button>
      </form>
    </div>
  );
}
