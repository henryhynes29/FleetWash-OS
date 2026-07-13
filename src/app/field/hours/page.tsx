import { revalidatePath } from "next/cache";
import { requireProfile, sb } from "@/lib/supabase-server";
import { fmtDay, fmtTime } from "@/lib/util";
export const dynamic = "force-dynamic";

async function clockIn(gps: string) {
  "use server";
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: open } = await supabase.from("timesheet").select("id").eq("user_id", user.id).is("clock_out", null).maybeSingle();
  if (open) return;
  const { data: p } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
  await supabase.from("timesheet").insert({ company_id: p!.company_id, user_id: user.id, clock_in: new Date().toISOString(), gps_in: gps });
  revalidatePath("/field/hours");
}
async function clockOut(gps: string) {
  "use server";
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("timesheet").update({ clock_out: new Date().toISOString(), gps_out: gps })
    .eq("user_id", user.id).is("clock_out", null);
  await supabase.from("positions").delete().eq("user_id", user.id);
  revalidatePath("/field/hours");
}

export default async function Hours() {
  const { supabase, user } = await requireProfile();
  const { data: entries } = await supabase.from("timesheet").select("*").eq("user_id", user!.id).order("clock_in", { ascending: false }).limit(20);
  const open = (entries ?? []).find((e) => !e.clock_out);
  const closed = (entries ?? []).filter((e) => e.clock_out);
  const weekAgo = Date.now() - 7 * 86400000;
  const hrs = (e: any) => (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000;
  const weekHrs = closed.filter((e) => new Date(e.clock_in).getTime() >= weekAgo).reduce((s, e) => s + hrs(e), 0);
  const inAct = clockIn.bind(null, "");
  const outAct = clockOut.bind(null, "");
  return (
    <div>
      <h1 className="disp" style={{ fontSize: 24, marginBottom: 14 }}>Hours</h1>
      <div style={{ background: open ? "linear-gradient(145deg,#0F3D2E,#1E7F4F)" : "linear-gradient(145deg,#14213D,#2E4B82)", borderRadius: 20, padding: "24px 20px", textAlign: "center", color: "#fff", marginBottom: 16 }}>
        <div className="disp" style={{ fontSize: 12, opacity: 0.8 }}>{open ? "● ON THE CLOCK" : "OFF THE CLOCK"}</div>
        {open && <div style={{ fontSize: 14, marginTop: 6 }}>since {fmtTime(open.clock_in)}</div>}
        <form action={open ? outAct : inAct}>
          <button className="btn" style={{ width: "100%", marginTop: 16, background: open ? "#FFE1DE" : "#DFF5E8", color: open ? "#8C1D18" : "#0F3D2E", fontSize: 18 }}>
            {open ? "Clock Out" : "Clock In"}
          </button>
        </form>
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>GPS stamping active on mobile — position shared with the team only while clocked in.</div>
      </div>
      <div className="card" style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <span className="disp dim" style={{ fontSize: 13 }}>Last 7 days</span>
        <span className="disp mono" style={{ fontSize: 20 }}>{weekHrs.toFixed(1)} hrs</span>
      </div>
      {closed.map((e) => (
        <div key={e.id} className="card" style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span>{fmtDay(e.clock_in)}</span><span className="mono">{hrs(e).toFixed(2)} hr</span>
          </div>
          <div className="dim" style={{ fontSize: 13, marginTop: 2 }}>{fmtTime(e.clock_in)} → {fmtTime(e.clock_out)}</div>
        </div>
      ))}
    </div>
  );
}
