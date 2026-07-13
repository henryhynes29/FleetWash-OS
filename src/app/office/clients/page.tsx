import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireProfile, sb } from "@/lib/supabase-server";
export const dynamic = "force-dynamic";

async function addClient(formData: FormData) {
  "use server";
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: p } = await supabase.from("profiles").select("company_id").eq("user_id", user!.id).single();
  await supabase.from("clients").insert({
    company_id: p!.company_id,
    name: String(formData.get("name") || "").trim(),
    contact: String(formData.get("contact") || ""),
    phone: String(formData.get("phone") || ""),
    address: String(formData.get("address") || ""),
  });
  revalidatePath("/office/clients");
}

export default async function Clients({ searchParams }: { searchParams: { q?: string } }) {
  const { supabase } = await requireProfile();
  const q = (searchParams.q ?? "").toLowerCase();
  const { data: clients } = await supabase.from("clients").select("*").order("name");
  const list = (clients ?? []).filter((c) => (c.name + " " + c.contact + " " + c.address + " " + c.specialty).toLowerCase().includes(q));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h1 className="disp" style={{ fontSize: 24 }}>Clients</h1>
        <Link className="pill" href="/office/clients/import" style={{ textDecoration: "none", borderColor: "var(--green)", color: "var(--green)" }}>⇪ Import CSV</Link>
      </div>
      <form style={{ marginBottom: 12 }}>
        <input className="inp" name="q" defaultValue={searchParams.q ?? ""} placeholder="Search clients, contacts, specialty…" />
      </form>
      {list.map((c) => (
        <Link key={c.id} href={`/office/clients/${c.id}`} style={{ color: "inherit", display: "block" }}>
          <div className="card" style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="disp" style={{ fontSize: 16 }}>{c.name}{c.kind === "refill" ? " 💧" : ""}</span>
              <span className="dim" style={{ fontSize: 13 }}>{c.frequency || "as scheduled"}</span>
            </div>
            <div className="dim" style={{ fontSize: 13, marginTop: 4 }}>{c.address}</div>
          </div>
        </Link>
      ))}
      <form action={addClient} className="card" style={{ marginTop: 14 }}>
        <div className="disp dim" style={{ fontSize: 13, marginBottom: 10 }}>+ Add client</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
          <input className="inp" name="name" placeholder="Company name *" required />
          <input className="inp" name="contact" placeholder="Contact" />
          <input className="inp" name="phone" placeholder="Phone" />
          <input className="inp" name="address" placeholder="Address" />
        </div>
        <button className="btn btn-primary" style={{ marginTop: 10 }}>Save client</button>
      </form>
      <div className="dim" style={{ fontSize: 13, marginTop: 14 }}>Whole book to load? Use <Link href="/office/clients/import">⇪ Import CSV</Link> — paste the spreadsheet, map columns, done.</div>
    </div>
  );
}
