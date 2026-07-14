import { requireProfile, sb } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { fmtDay } from "@/lib/util";
export const dynamic = "force-dynamic";

async function postNote(formData: FormData) {
  "use server";
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const body = String(formData.get("body") || "").trim();
  const category = String(formData.get("category") || "Gate/Access");
  if (!body) return;
  const { data: p } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
  await supabase.from("notes").insert({ company_id: p!.company_id, category, body, author_id: user.id });
  revalidatePath("/field/feed");
}

export default async function FieldFeed() {
  const { supabase } = await requireProfile();
  const [{ data: notes }, { data: profiles }] = await Promise.all([
    supabase.from("notes").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("profiles").select("user_id, initials, display_name"),
  ]);
  const who = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  return (
    <div>
      <h1 className="disp" style={{ fontSize: 24, marginBottom: 2 }}>Team Feed</h1>
      <div className="dim" style={{ fontSize: 13, marginBottom: 14 }}>Gate codes, access notes, and heads-ups the whole crew can see.</div>

      <form action={postNote} className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ marginBottom: 8 }}>
          <select name="category" className="inp" style={{ maxWidth: 160 }}>
            <option>Gate/Access</option>
            <option>Hazard</option>
            <option>Equipment</option>
            <option>General</option>
          </select>
        </div>
        <textarea name="body" className="inp" rows={2} placeholder="Post a note for the crew…" style={{ paddingTop: 10, marginBottom: 8 }} />
        <button className="btn btn-primary" style={{ width: "100%" }}>Post to feed</button>
      </form>

      {(notes ?? []).length === 0 && <div className="card dim" style={{ textAlign: "center" }}>No posts yet — be the first.</div>}

      {(notes ?? []).map((n) => {
        const a = who.get(n.author_id);
        return (
          <div key={n.id} className="card" style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span className="disp" style={{ fontSize: 12, color: "var(--orange-l)" }}>{n.category}</span>
              <span className="dim" style={{ fontSize: 12 }}>{fmtDay(n.created_at)}</span>
            </div>
            <div style={{ fontSize: 14 }}>{n.body}</div>
            <div className="dim" style={{ fontSize: 12, marginTop: 6 }}>— {a?.display_name || a?.initials || "crew"}</div>
          </div>
        );
      })}
    </div>
  );
}
