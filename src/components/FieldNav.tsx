"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Ported from the demo: each field tab with its own line-icon + accent color.
const TABS: { href: string; key: string; label: string; color: string; path: string }[] = [
  { href: "/field",            key: "home",       label: "Home",     color: "#2E86AB", path: "M3 11.5 12 4l9 7.5M5.5 10v9h13v-9" },
  { href: "/field/hours",      key: "hours",      label: "Clock",    color: "#E8892B", path: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2" },
  { href: "/field/map",        key: "map",        label: "Map",      color: "#0EA5A5", path: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14" },
  { href: "/field/sched",      key: "sched",      label: "Team",     color: "#7C5CD6", path: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.5 19c0-2.8 2.5-4.5 5.5-4.5s5.5 1.7 5.5 4.5M14 15c2.6.2 5.5 1.6 5.5 4.5" },
  { href: "/field/companies",  key: "companies",  label: "Accounts", color: "#1E9E5A", path: "M5 20V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15M15 20V9h3a1 1 0 0 1 1 1v10M3 20h18M8 8h1M8 12h1M11 8h1M11 12h1" },
  { href: "/field/feed",       key: "feed",       label: "Feed",     color: "#3B82D6", path: "M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H8l-4 3V6a1 1 0 0 1 1-1ZM8 9h8M8 12h5" },
  { href: "/field/complaints", key: "complaints", label: "Flags",    color: "#E23B3B", path: "M5 21V4M5 4c3-2 6 2 9 0s5-1 5-1v9s-2 1-5 1-6-2-9 0" },
  { href: "/field/standings",  key: "standings",  label: "Ranks",    color: "#E5A50A", path: "M8 4h8v3a4 4 0 0 1-8 0V4ZM8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3M9 20h6M12 15v5M9.5 20l.5-3h4l.5 3" },
];

export default function FieldNav() {
  const pathname = usePathname();
  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      background: "rgba(255,255,255,0.96)", backdropFilter: "blur(12px)",
      borderTop: "1px solid var(--lline)", boxShadow: "0 -4px 20px rgba(16,24,40,0.08)",
      display: "flex", overflowX: "auto",
      padding: "8px 6px calc(8px + env(safe-area-inset-bottom))", zIndex: 20,
    }}>
      {TABS.map((t) => {
        const active = t.href === "/field" ? pathname === "/field" : pathname.startsWith(t.href);
        return (
          <Link key={t.key} href={t.href} style={{
            flex: "1 0 auto", minWidth: 62, padding: 2, textDecoration: "none",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          }}>
            <span style={{
              display: "grid", placeItems: "center", width: 46, height: 34, borderRadius: 12,
              background: active ? `linear-gradient(145deg, ${t.color}, ${t.color}CC)` : "transparent",
              boxShadow: active ? `0 4px 12px ${t.color}55` : "none",
              transform: active ? "translateY(-1px)" : "none", transition: "all .18s ease",
            }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none"
                stroke={active ? "#fff" : "#94A2B8"} strokeWidth={active ? 2.3 : 1.9}
                strokeLinecap="round" strokeLinejoin="round">
                <path d={t.path} />
              </svg>
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: active ? "var(--orange-l)" : "var(--ink-soft)" }}>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
