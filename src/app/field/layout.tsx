import Link from "next/link";
import { requireProfile } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import PositionBeacon from "@/components/PositionBeacon";
export const dynamic = "force-dynamic";

export default async function FieldLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireProfile();
  if (!user) redirect("/login");
  if (!profile) redirect("/onboarding");
  const { data: open } = await (await import("@/lib/supabase-server")).sb()
    .from("timesheet").select("id").eq("user_id", user.id).is("clock_out", null).maybeSingle();
  return (
    <div className="field-surface">
      <PositionBeacon userId={user.id} companyId={profile.company_id} clockedIn={!!open} />
      <header style={{ background: "var(--navy)", color: "#fff", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="disp" style={{ fontSize: 17 }}>FleetWash <span style={{ color: "var(--orange)" }}>OS</span></span>
        <span style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 13 }}>
          <span style={{ color: "var(--dim)", fontWeight: 700 }}>{profile.initials} · {profile.display_name}</span>
          {profile.role === "owner" && <Link href="/office" style={{ border: "1.5px solid var(--orange)", borderRadius: 8, padding: "4px 10px", fontWeight: 700, fontSize: 12 }}>OFFICE →</Link>}
        </span>
      </header>
      <main style={{ padding: "18px 16px 92px", maxWidth: 560, margin: "0 auto" }}>{children}</main>
      <nav className="tabbar">
        <Link href="/field">⌂<span>Home</span></Link>
        <Link href="/field/jobs">▤<span>Jobs</span></Link>
        <Link href="/field/hours">◷<span>Hours</span></Link>
        <Link href="/field/notes">✎<span>Notes</span></Link>
      </nav>
    </div>
  );
}
