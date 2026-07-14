import { requireProfile, sb } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { fmtDay } from "@/lib/util";
export const dynamic = "force-dynamic";

async function setResolved(id: string, resolved: boolean) {
  "use server";
  await sb().from("complaints").update({ resolved }).eq("id", id);
  revalidatePath("/field/complaints");
}

export default async function FieldComplaints() {
  const { supabase } = await requireProfile();
  const [{ data: complaints }, { data: clients }] = await Promise.all([
    supabase.from("complaints").select("*").order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name"),
  ]);
  const cmap = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const list = complaints ?? [];
  const open = list.filter((c) => !c.resolved);
  const resolved = list.filter((c) => c.resolved);

  const Card = ({ c }: { c: any }) => (
    <div className="card" style={{ marginBottom: 10, borderLeft: c.resolved ? "5px solid var(--green-d)" : "5px solid var(--orange)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontWeight: 700 }}>{c.client_id ? cmap.get(c.client_id) ?? "—" : "General"}</span>
        <span className="dim" style={{ fontSize: 12 }}>{fmtDay(c.created_at)}</span>
      </div>
      <div style={{ fontSize: 14, marginBottom: 10 }}>{c.body}</div>
      <form action={setResolved.bind(null, c.id, !c.resolved)}>
        <button className="pill" style={c.resolved ? {} : { borderColor: "var(--green-d)", color: "var(--green-d)" }}>
          {c.resolved ? "↩ Reopen" : "✓ Mark resolved"}
        </button>
      </form>
    </div>
  );

  return (
    <div>
      <h1 className="disp" style={{ fontSize: 22, marginBottom: 4 }}>Complaints</h1>
      <div className="dim" style={{ fontSize: 13, marginBottom: 14 }}>Client watch-outs and issues. Resolve them as you clear them.</div>

      <div className="disp dim" style={{ fontSize: 13, marginBottom: 8 }}>Open · {open.length}</div>
      {open.length === 0 && <div className="card dim" style={{ marginBottom: 16 }}>Nothing open — all clear.</div>}
      {open.map((c) => <Card key={c.id} c={c} />)}

      {resolved.length > 0 && (
        <>
          <div className="disp dim" style={{ fontSize: 13, margin: "18px 0 8px" }}>Resolved · {resolved.length}</div>
          {resolved.map((c) => <Card key={c.id} c={c} />)}
        </>
      )}
    </div>
  );
}
