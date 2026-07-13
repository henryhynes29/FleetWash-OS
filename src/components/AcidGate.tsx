"use client";
import { useState } from "react";

const ITEMS = [
  "Acid-resistant PPE verified — face shield, heavy rubber gloves, apron",
  "Viton pump & downstream injector seals inspected",
  "Neutralizer / baking soda loaded on rig",
];

export default function AcidGate({ hazardNames, ackAction }: { hazardNames: string[]; ackAction: () => Promise<void> }) {
  const [checks, setChecks] = useState([false, false, false]);
  const [gone, setGone] = useState(false);
  if (gone || hazardNames.length === 0) return null;
  const all = checks.every(Boolean);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,14,22,0.96)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <div style={{ background: "var(--card)", border: "2px solid var(--orange)", borderRadius: 18, padding: 22, width: "100%", maxWidth: 440, color: "var(--text)" }}>
        <div className="disp" style={{ color: "var(--orange)", fontSize: 19, lineHeight: 1.25 }}>⚠️ High-Hazard Acid / Corrosive Detected</div>
        <div style={{ fontSize: 14, margin: "10px 0 16px" }}>
          {hazardNames.join(" and ")} on your route today require{hazardNames.length === 1 ? "s" : ""} acid / brightener. Verify before Field Mode opens:
        </div>
        {ITEMS.map((label, i) => (
          <label key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "var(--navy)", border: `1.5px solid ${checks[i] ? "var(--green)" : "var(--line)"}`, borderRadius: 12, padding: "13px 14px", marginBottom: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={checks[i]} onChange={() => setChecks(checks.map((v, j) => (j === i ? !v : v)))} style={{ width: 24, height: 24, accentColor: "var(--green)", flexShrink: 0 }} />
            <span style={{ color: checks[i] ? "var(--green)" : "var(--text)", fontWeight: 600, fontSize: 14 }}>{label}</span>
          </label>
        ))}
        <button disabled={!all} onClick={async () => { await ackAction(); setGone(true); }} className="btn" style={{ width: "100%", background: all ? "var(--green-d)" : "var(--line)", color: all ? "#fff" : "var(--dim)" }}>
          {all ? "✓ Confirm Safe & Open Field Mode" : "Check all items to continue"}
        </button>
      </div>
    </div>
  );
}
