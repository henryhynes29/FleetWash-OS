import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireProfile, sb } from "@/lib/supabase-server";
import { money, fmtDay } from "@/lib/util";
export const dynamic = "force-dynamic";

async function setStatus(id: string, status: string) {
  "use server";
  await sb().from("invoices").update({ status }).eq("id", id);
  revalidatePath(`/office/invoices/${id}`);
}

export default async function InvoiceDetail({ params }: { params: { id: string } }) {
  const { supabase } = await requireProfile();
  const { data: inv } = await supabase.from("invoices").select("*").eq("id", params.id).single();
  if (!inv) return <div>Not found</div>;
  const [{ data: client }, { data: company }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", inv.client_id).single(),
    supabase.from("companies").select("name").single(),
  ]);
  const total = (inv.lines as any[]).reduce((s, l) => s + l.qty * l.rate_cents, 0);
  return (
    <div>
      <div className="row no-print" style={{ justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap" }}>
        <Link href="/office/invoices">← Invoices</Link>
        <span className="row">
          {inv.status === "draft" && <form action={setStatus.bind(null, inv.id, "sent")}><button className="pill">Mark sent</button></form>}
          {inv.status === "sent" && <form action={setStatus.bind(null, inv.id, "paid")}><button className="pill" style={{ borderColor: "var(--green)", color: "var(--green)" }}>Mark paid</button></form>}
          {inv.status === "paid" && client?.contact && (
            <a className="pill" style={{ textDecoration: "none" }}
               href={`mailto:?subject=${encodeURIComponent("Thanks from " + (company?.name ?? "our team") + " — quick favor?")}&body=${encodeURIComponent(`Hi ${client.contact},\n\nThanks for your business! If you're happy with how the fleet is looking, a quick Google review goes a long way for a local crew like ours.\n\nThanks!\n${company?.name ?? ""}`)}`}>
              ★ Request review
            </a>
          )}
        </span>
      </div>
      <div className="print-area" style={{ background: "#fff", color: "#14213D", borderRadius: 12, padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "3px solid #14213D", paddingBottom: 14, marginBottom: 18 }}>
          <div>
            <div className="disp" style={{ fontSize: 22, fontWeight: 700 }}>{company?.name ?? "FleetWash OS"}</div>
            <div style={{ fontSize: 13, color: "#4A5A75" }}>Fleet washing services</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="mono" style={{ fontWeight: 700, fontSize: 16 }}>{inv.number}</div>
            <div style={{ fontSize: 13, color: "#4A5A75" }}>{fmtDay(inv.created_at)}</div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: inv.status === "paid" ? "#1E7F4F" : "#B54708" }}>{inv.status}{inv.approved_at ? " · ✓ client approved" : ""}</div>
          </div>
        </div>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, color: "#4A5A75", fontWeight: 700, textTransform: "uppercase" }}>Bill to</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{client?.name}</div>
          <div style={{ fontSize: 13, color: "#4A5A75" }}>{client?.contact}{client?.contact && client?.phone ? " · " : ""}{client?.phone}<br />{client?.address}<br />Terms: {client?.terms}</div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead><tr style={{ borderBottom: "2px solid #14213D", textAlign: "left" }}>
            <th style={{ padding: "8px 4px" }}>Description</th><th style={{ padding: "8px 4px", textAlign: "right" }}>Amount</th>
          </tr></thead>
          <tbody>
            {(inv.lines as any[]).map((l, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #DDE3EC" }}>
                <td style={{ padding: "8px 4px" }}>{l.desc}</td>
                <td className="mono" style={{ padding: "8px 4px", textAlign: "right" }}>{money(l.qty * l.rate_cents)}</td>
              </tr>
            ))}
            <tr>
              <td style={{ padding: "12px 4px", fontWeight: 700, textAlign: "right" }}>Total</td>
              <td className="mono" style={{ padding: "12px 4px", textAlign: "right", fontWeight: 700, fontSize: 18 }}>{money(total)}</td>
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: 22, fontSize: 12, color: "#4A5A75" }}>This invoice doubles as your proof-of-service record: every line is a field-logged wash with worker attribution on file.</div>
      </div>
    </div>
  );
}
