"use client";
import { useState } from "react";

export default function DoneNudge({ zeroLogged, isDone, action }: { zeroLogged: boolean; isDone: boolean; action: () => Promise<void> }) {
  const [confirm, setConfirm] = useState(false);
  if (isDone) return <button className="btn" style={{ minHeight: 42, fontSize: 14, background: "var(--ink)", color: "#fff" }} disabled>Done</button>;
  if (confirm) return (
    <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ fontWeight: 700, fontSize: 13, color: "#B3261E" }}>No units logged — bills $0.</span>
      <button className="btn" style={{ minHeight: 40, fontSize: 13, background: "var(--ink)", color: "#fff" }} onClick={() => setConfirm(false)}>Keep logging</button>
      <button className="btn btn-ghost" style={{ minHeight: 40, fontSize: 13 }} onClick={async () => { await action(); setConfirm(false); }}>Done anyway</button>
    </span>
  );
  return (
    <button className="btn" style={{ minHeight: 42, fontSize: 14, background: "#E7ECF5", color: "var(--ink)" }}
      onClick={async () => { if (zeroLogged) setConfirm(true); else await action(); }}>Done</button>
  );
}
