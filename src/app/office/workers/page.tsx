import { revalidatePath } from "next/cache";
import { requireProfile, sb } from "@/lib/supabase-server";
import { fmtDay, fmtTime } from "@/lib/util";
import LiveMap from "@/components/LiveMap";
export const dynamic = "force-dynamic";

async function fixEntry(id: string, formData: FormData) {
  "use server";
  const patch: any = {};
  const ci = String(formData.get("in") || ""), co = String(formData.get("out") || "");
  if (ci) patch.clock_in = new Date(ci).toISOString();
  if (co) patch.clock_out = new Date(co).toISOString();
  if (Object.keys(patch).length) await sb().from("timesheet").update(patch).eq("id", id);
  revalidatePath("/office/workers");
}

export default async function Workers() {
  const { supabase } = await requireProfile();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const [{ data: profiles }, { data: entries }, { data: checkoffs }] = await Promise.all([
    supabase.from("profiles").select("*").order("initials"),
    supabase.from("timesheet").select("*").gte("clock_in", weekAgo).order("clock_in", { ascending: false }),
    supabase.from("unit_checkoffs").select("checked_by").gte("checked_at", weekAgo),
  ]);
  const hrs = (e: any) => e.clock_out ? (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000 : 0;
  const byUser = (uid: string) => (entries ?? []).filter((e) => e.user_id === uid);
  const unitsBy = (uid: string) => (checkoffs ?? []).filter((c) => c.checked_by === uid).length;

  return (
    <div>
      <h1 className="disp" style={{ fontSize: 24, marginBottom: 12 }}>Workers</h1>
      <div className="disp dim" style={{ fontSize: 13, marginBottom: 8 }}>Live map — clocked-in crew</div>
      <div style={{ marginBottom: 18 }}><LiveMap /></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span className="disp dim" style={{ fontSize: 13 }}>Rolling 7 days</span>
        <a className="pill" href="/office/workers/payroll" style={{ borderColor: "var(--green)", color: "var(--green)", textDecoration: "none" }}>⬇ Payroll CSV</a>
      </div>
      {(profiles ?? []).map((p) => {
        const mine = byUser(p.user_id);
        const open = mine.find((e) => !e.clock_out);
        const total = mine.reduce((s, e) => s + hrs(e), 0);
        return (
          <div key={p.user_id} className="card" style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700 }}>
                {open && <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: "var(--green)", marginRight: 8 }} />}
                {p.display_name} <span className="dim">({p.initials})</span>
              </span>
              <span className="mono dim" style={{ fontSize: 14 }}>{total.toFixed(1)} hr · {unitsBy(p.user_id)} units{open ? " · ON CLOCK" : ""}</span>
            </div>
          </div>
        );
      })}
      <div className="disp dim" style={{ fontSize: 13, margin: "18px 0 8px" }}>Timesheet — tap a field to correct, then Save</div>
      {(entries ?? []).slice(0, 25).map((e) => {
        const p = (profiles ?? []).find((x) => x.user_id === e.user_id);
        const toLocal = (iso: string | null) => iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
        return (
          <form key={e.id} action={fixEntry.bind(null, e.id)} className="card row" style={{ marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, minWidth: 46 }}>{p?.initials ?? "?"}</span>
            <span className="dim" style={{ fontSize: 13, minWidth: 90 }}>{fmtDay(e.clock_in)}</span>
            <input className="inp" type="datetime-local" name="in" defaultValue={toLocal(e.clock_in)} style={{ minHeight: 40, flex: 1, minWidth: 170 }} />
            <input className="inp" type="datetime-local" name="out" defaultValue={toLocal(e.clock_out)} style={{ minHeight: 40, flex: 1, minWidth: 170 }} />
            <span className="mono dim" style={{ fontSize: 13 }}>{e.clock_out ? hrs(e).toFixed(2) + " hr" : "open"}</span>
            <button className="pill">Save</button>
          </form>
        );
      })}
    </div>
  );
}
