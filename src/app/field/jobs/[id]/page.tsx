import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireProfile, sb } from "@/lib/supabase-server";
import { fmtDay, fmtRange } from "@/lib/util";
import UnitBoard from "@/components/UnitBoard";
import DoneNudge from "@/components/DoneNudge";
import SignaturePad from "@/components/SignaturePad";
export const dynamic = "force-dynamic";

async function setStatus(jobId: string, status: string) {
  "use server";
  await sb().from("jobs").update({ status }).eq("id", jobId);
  revalidatePath(`/field/jobs/${jobId}`);
}

async function ackIntel(jobId: string) {
  "use server";
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: p } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
  await supabase.from("intel_acks").upsert({ job_id: jobId, user_id: user.id, company_id: p!.company_id });
  revalidatePath(`/field/jobs/${jobId}`);
}

export default async function JobDetail({ params }: { params: { id: string } }) {
  const { supabase, user, profile } = await requireProfile();
  const { data: job } = await supabase.from("jobs").select("*").eq("id", params.id).single();
  if (!job) redirect("/field");
  const [{ data: client }, { data: units }, { data: checkoffs }, { data: flags }, { data: profiles }, { data: types }, { data: photoRows }, { data: settings }, { data: acks }, { data: sig }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", job.client_id).single(),
    supabase.from("units").select("*, asset_types(name)").in("id", job.unit_ids.length ? job.unit_ids : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("unit_checkoffs").select("*").eq("job_id", job.id),
    supabase.from("unit_flags").select("*").eq("job_id", job.id),
    supabase.from("profiles").select("user_id, initials"),
    supabase.from("asset_types").select("id, name").order("sort"),
    supabase.from("wash_photos").select("unit_id, storage_path").eq("job_id", job.id),
    supabase.from("company_settings").select("baseline_loadout").single(),
    supabase.from("intel_acks").select("user_id").eq("job_id", job.id),
    supabase.from("signatures").select("*").eq("job_id", job.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const who = new Map((profiles ?? []).map((p) => [p.user_id, p.initials]));

  const doneBy: Record<string, { by: string; at: string }> = {};
  (checkoffs ?? []).forEach((c) => { doneBy[c.unit_id] = { by: who.get(c.checked_by) ?? "?", at: new Date(c.checked_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) }; });
  const roadOut = (flags ?? []).filter((f) => f.kind === "road_out").map((f) => f.unit_id);
  const damage: Record<string, { note: string; by: string }> = {};
  (flags ?? []).filter((f) => f.kind === "damage").forEach((f) => { damage[f.unit_id] = { note: f.note, by: who.get(f.created_by) ?? "?" }; });

  const photos: Record<string, { url: string }[]> = {};
  for (const row of (photoRows ?? []).slice(0, 40)) {
    const { data: signed } = await supabase.storage.from("wash-photos").createSignedUrl(row.storage_path, 3600);
    if (signed) photos[row.unit_id] = [...(photos[row.unit_id] ?? []), { url: signed.signedUrl }];
  }
  let sigView: { url: string; name: string } | null = null;
  if (sig) {
    const { data: signed } = await supabase.storage.from("wash-photos").createSignedUrl(sig.storage_path, 3600);
    if (signed) sigView = { url: signed.signedUrl, name: sig.signer_name };
  }
  const loadout = [...new Set([...((settings?.baseline_loadout ?? []) as string[]), ...((client?.chems ?? []) as string[])])];
  const iAcked = (acks ?? []).some((a) => a.user_id === user!.id);
  const ackedBy = (acks ?? []).map((a) => who.get(a.user_id) ?? "?");

  return (
    <div>
      <Link href="/field" style={{ color: "var(--orange-l)", fontWeight: 700 }}>← Back</Link>
      <h1 className="disp" style={{ fontSize: 22, margin: "8px 0 2px" }}>{client?.name}</h1>
      <div className="dim" style={{ fontSize: 14 }}>{fmtDay(job.starts_at)} · {fmtRange(job.starts_at, job.duration_min)}</div>
      {client?.address && (
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(client.address)}`} target="_blank"
           style={{ color: "var(--orange-l)", fontWeight: 700, fontSize: 14, display: "inline-block", marginTop: 4 }}>🧭 {client.address}</a>
      )}
      {(client?.specialty || client?.complaints) && (
        <div style={{ background: "#FFF7ED", border: "1px solid #F3D9B8", borderLeft: "5px solid var(--orange-l)", borderRadius: 12, padding: "12px 14px", margin: "12px 0" }}>
          <div className="disp" style={{ fontSize: 12, color: "var(--orange-l)", marginBottom: 6 }}>Location intel</div>
          {client.specialty && <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{client.specialty}</div>}
          {client.complaints && <div style={{ fontSize: 13, color: "#B3261E", fontWeight: 600, marginTop: 6 }}>⚠ Watch for: {client.complaints}</div>}
          <form action={ackIntel.bind(null, job.id)} style={{ marginTop: 10 }}>
            <button className="btn" disabled={iAcked} style={{ minHeight: 40, fontSize: 13, background: iAcked ? "#E3F3EA" : "var(--ink)", color: iAcked ? "var(--green-d)" : "#fff" }}>
              {iAcked ? "✓ You've read this" : "✓ I've read the instructions"}
            </button>
            {ackedBy.length > 0 && <span className="dim" style={{ fontSize: 12, marginLeft: 10 }}>Read by: {ackedBy.join(", ")}</span>}
          </form>
        </div>
      )}
      {loadout.length > 0 && (
        <div className="card" style={{ margin: "12px 0", padding: "10px 14px" }}>
          <span className="disp dim" style={{ fontSize: 12 }}>This stop needs: </span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{loadout.join(" · ")}</span>
        </div>
      )}
      <div className="row" style={{ margin: "12px 0 16px", flexWrap: "wrap" }}>
        {["enroute", "washing"].map((s) => (
          <form key={s} action={setStatus.bind(null, job.id, s)}>
            <button className="btn" style={{ minHeight: 42, fontSize: 14, background: job.status === s ? "var(--ink)" : "#E7ECF5", color: job.status === s ? "#fff" : "var(--ink)" }}>{s === "enroute" ? "En Route" : "Washing"}</button>
          </form>
        ))}
        <DoneNudge zeroLogged={(checkoffs ?? []).length === 0} isDone={job.status === "done"} action={setStatus.bind(null, job.id, "done")} />
      </div>
      <UnitBoard
        jobId={job.id} clientId={job.client_id} companyId={profile.company_id} userId={user!.id} myInitials={profile.initials}
        units={(units ?? []).map((u) => ({ id: u.id, number: u.number, typeName: (u as any).asset_types?.name ?? "" }))}
        doneBy={doneBy} roadOut={roadOut} damage={damage}
        types={(types ?? [])} photos={photos}
      />
      <SignaturePad jobId={job.id} companyId={profile.company_id} existing={sigView} />
    </div>
  );
}
