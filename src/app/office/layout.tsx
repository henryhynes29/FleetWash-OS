import Link from "next/link";
export const dynamic = "force-dynamic";
export default function OfficeLayout({ children }: { children: React.ReactNode }) {
  const tabs = [["/office", "Dashboard"], ["/office/schedule", "Scheduling"], ["/office/workers", "Workers"], ["/office/metrics", "Metrics"], ["/office/clients", "Clients"], ["/office/invoices", "Invoices"], ["/office/workers", "Workers"], ["/office/metrics", "Metrics"], ["/office/settings", "Settings"]];
  return (
    <div>
      <header style={{ borderBottom: "1px solid var(--line)", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "var(--navy)", zIndex: 10 }}>
        <span className="disp" style={{ fontSize: 17 }}>FleetWash <span style={{ color: "var(--orange)" }}>OS</span> <span className="dim" style={{ fontSize: 12, marginLeft: 6 }}>OFFICE</span></span>
        <Link href="/field" style={{ border: "1.5px solid var(--orange)", borderRadius: 8, padding: "4px 10px", fontWeight: 700, fontSize: 12 }}>← FIELD</Link>
      </header>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>
        {tabs.map(([href, label]) => <Link key={href} href={href} className="pill" style={{ whiteSpace: "nowrap" }}>{label}</Link>)}
      </div>
      <main style={{ padding: "18px 16px 60px", maxWidth: 1100, margin: "0 auto" }}>{children}</main>
    </div>
  );
}
