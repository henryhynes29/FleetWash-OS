"use client";
import { useEffect, useMemo, useState } from "react";
import { sbBrowser } from "@/lib/supabase-client";

type Client = {
  id: string; name: string; address: string; contact: string; phone: string;
  arrival: string; frequency: string; fleet_notes: string; specialty: string;
  complaints: string; wash_time: string; washers: string; chems: string[];
  requires_training: boolean; kind: string;
};

export default function FieldCompanies() {
  const [rows, setRows] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    sbBrowser().from("clients").select("*").then(({ data }) => setRows((data ?? []) as Client[]));
  }, []);

  const companies = useMemo(() => rows
    .filter((c) => c.kind !== "refill")
    .filter((c) => {
      if (!q.trim()) return true;
      const hay = (c.name + " " + (c.address || "") + " " + (c.specialty || "")).toLowerCase();
      return hay.includes(q.toLowerCase());
    })
    .sort((a, b) => a.name.localeCompare(b.name)), [rows, q]);

  const Row = ({ label, value }: { label: string; value: string }) => value ? (
    <div style={{ display: "flex", gap: 10, padding: "5px 0", fontSize: 13.5 }}>
      <span style={{ width: 74, flexShrink: 0, color: "var(--ink-soft)", fontWeight: 700 }}>{label}</span>
      <span>{value}</span>
    </div>
  ) : null;

  return (
    <div>
      <h1 className="disp" style={{ fontSize: 24, marginBottom: 2 }}>Accounts</h1>
      <div className="dim" style={{ fontSize: 13, marginBottom: 12 }}>
        Every account we wash — pull one up for access notes, chems, and complaints before you roll in. {companies.length} shown.
      </div>
      <input className="inp" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Search company, city, or note…" style={{ marginBottom: 12 }} />

      {companies.length === 0 && <div className="card dim" style={{ textAlign: "center" }}>No company matches that search.</div>}

      {companies.map((c) => {
        const open = openId === c.id;
        const flags = (c.complaints || "").split("\n").filter((x) => x.trim() && x.trim() !== "N/A");
        const chems = (c.chems || []).filter(Boolean);
        return (
          <div key={c.id} className="card" style={{ marginBottom: 8, padding: 0, overflow: "hidden" }}>
            <button onClick={() => setOpenId(open ? null : c.id)} style={{
              width: "100%", background: "none", border: "none", textAlign: "left", cursor: "pointer",
              padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, color: "inherit", font: "inherit",
            }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 15, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                <span className="dim" style={{ fontSize: 12 }}>{c.address || "—"}</span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                {c.requires_training && <span style={{ fontSize: 11, fontWeight: 800, color: "#8C1D18", background: "#FDECEA", border: "1px solid #F3B7B2", borderRadius: 6, padding: "2px 6px" }}>TRAINING</span>}
                {flags.length > 0 && <span style={{ fontSize: 13 }}>⚑</span>}
                <span className="dim" style={{ fontSize: 13 }}>{open ? "▲" : "▼"}</span>
              </span>
            </button>
            {open && (
              <div style={{ padding: "0 14px 14px", borderTop: "1px solid var(--lline)" }}>
                <div style={{ paddingTop: 8 }}>
                  <Row label="Arrival" value={c.arrival} />
                  <Row label="Frequency" value={c.frequency} />
                  <Row label="Fleet" value={c.fleet_notes} />
                  <Row label="Contact" value={[c.contact, c.phone].filter(Boolean).join(" · ")} />
                  <Row label="Wash time" value={c.wash_time} />
                  <Row label="Washers" value={c.washers} />
                </div>
                {c.requires_training && (
                  <div style={{ background: "#FDECEA", border: "1px solid #F3B7B2", borderRadius: 10, padding: "9px 12px", marginTop: 10, fontSize: 13, color: "#8C1D18" }}>
                    ⚠ Requires training — notify management if you're sent untrained.
                  </div>
                )}
                {chems.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div className="disp dim" style={{ fontSize: 12, marginBottom: 5 }}>Special gear / chems</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {chems.map((ch) => <span key={ch} style={{ fontSize: 12.5, fontWeight: 700, color: "#0F3D2E", background: "#E4F5EC", border: "1px solid #B9E3CC", borderRadius: 999, padding: "3px 10px" }}>{ch}</span>)}
                    </div>
                  </div>
                )}
                {c.specialty && (
                  <div style={{ marginTop: 10 }}>
                    <div className="disp dim" style={{ fontSize: 12, marginBottom: 4 }}>Access & how-to</div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.4, whiteSpace: "pre-line" }}>{c.specialty}</div>
                  </div>
                )}
                {flags.length > 0 && (
                  <div style={{ marginTop: 10, background: "#FBF3DC", border: "1px solid #E8D9A8", borderRadius: 10, padding: "9px 12px" }}>
                    <div className="disp" style={{ fontSize: 12, color: "#B4820A", marginBottom: 4 }}>⚑ Complaints — get these right</div>
                    {flags.map((f, i) => <div key={i} style={{ fontSize: 13.5, padding: "2px 0", whiteSpace: "pre-line" }}>{f.trim()}</div>)}
                  </div>
                )}
                {c.address && (
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c.address)}`} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 12, fontWeight: 700, fontSize: 13.5 }}>🧭 Navigate to {c.name}</a>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
