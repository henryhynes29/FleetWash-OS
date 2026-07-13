import { revalidatePath } from "next/cache";
import { requireProfile, sb } from "@/lib/supabase-server";
import { fmtDay, fmtTime } from "@/lib/util";
export const dynamic = "force-dynamic";

const CATS = ["Gate/Access", "Damage", "Chem/Supplies", "Equipment"];

async function addNote(formData: FormData) {
  "use server";
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const body = String(formData.get("body") || "").trim();
  if (!body) return;
  const { data: p } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
  await supabase.from("notes").insert({ company_id: p!.company_id, author_id: user.id, category: String(formData.get("cat") || CATS[0]), body });
  revalidatePath("/field/notes");
}

export default async function Notes() {
  const { supabase } = await requireProfile();
  const [{ data: notes }, { data: profiles }] = await Promise.all([
    supabase.from("notes").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("profiles").select("user_id, initials"),
  ]);
  const who = new Map((profiles ?? []).map((p) => [p.user_id, p.initials]));
  return (
    <div>
      <h1 className="disp" style={{ fontSize: 24, marginBottom: 14 }}>Notes</h1>
      <form action={addNote} className="card" style={{ marginBottom: 14 }}>
        <select className="inp" name="cat" style={{ marginBottom: 8 }}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
        <textarea className="inp" name="body" rows={2} placeholder="Gate codes, damage, supplies — the whole team can search this later" style={{ paddingTop: 10 }} />
        <button className="btn btn-primary" style={{ marginTop: 8, minHeight: 42, fontSize: 14 }}>Post note</button>
      </form>
      {(notes ?? []).map((n) => (
        <div key={n.id} className="card" style={{ marginBottom: 8, borderLeft: "5px solid var(--orange-l)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--orange-l)", textTransform: "uppercase" }}>{n.category}</div>
          <div style={{ marginTop: 4, fontSize: 15 }}>{n.body}</div>
          <div className="dim" style={{ fontSize: 12, marginTop: 6 }}>{who.get(n.author_id) ?? "?"} · {fmtDay(n.created_at)} {fmtTime(n.created_at)}</div>
        </div>
      ))}
    </div>
  );
}
