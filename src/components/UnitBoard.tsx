"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sbBrowser } from "@/lib/supabase-client";
import { enqueue, flush, pending, type Op } from "@/lib/offline-queue";
import UnitPhotos from "@/components/UnitPhotos";

type Unit = { id: string; number: string; typeName: string };
type P = {
  jobId: string; clientId: string; companyId: string; userId: string; myInitials: string;
  units: Unit[];
  doneBy: Record<string, { by: string; at: string }>;
  roadOut: string[];
  damage: Record<string, { note: string; by: string }>;
  types: { id: string; name: string }[];
  photos: Record<string, { url: string }[]>;
};

export default function UnitBoard(p: P) {
  const router = useRouter();
  const supabase = sbBrowser();
  const [units, setUnits] = useState<Unit[]>(p.units);
  const [done, setDone] = useState(p.doneBy);
  const [road, setRoad] = useState(new Set(p.roadOut));
  const [dmg, setDmg] = useState(p.damage);
  const [qNum, setQNum] = useState("");
  const [qType, setQType] = useState(p.types[0]?.id ?? "");
  const [dmgFor, setDmgFor] = useState<string | null>(null);
  const [dmgTxt, setDmgTxt] = useState("");
  const [queued, setQueued] = useState(0);
  const [online, setOnline] = useState(true);

  const sync = async () => {
    const left = await flush(supabase);
    setQueued(left);
    if (left === 0 && pending() === 0) router.refresh();
  };
  useEffect(() => {
    setOnline(navigator.onLine); setQueued(pending());
    if (pending()) sync();
    const up = () => { setOnline(true); sync(); };
    const down = () => setOnline(false);
    window.addEventListener("online", up); window.addEventListener("offline", down);
    const t = setInterval(() => { if (pending()) sync(); }, 20000);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); clearInterval(t); };
  }, []);

  const perform = (op: Op) => { enqueue(op); setQueued(pending()); sync(); };

  const now = () => new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const toggle = (u: Unit) => {
    if (done[u.id]) {
      const d = { ...done }; delete d[u.id]; setDone(d);
      perform({ t: "uncheck", jobId: p.jobId, unitId: u.id });
    } else {
      setDone({ ...done, [u.id]: { by: p.myInitials, at: now() } });
      setRoad((r) => { const n = new Set(r); n.delete(u.id); return n; });
      perform({ t: "check", jobId: p.jobId, unitId: u.id, companyId: p.companyId, userId: p.userId });
    }
  };
  const flagRoad = (u: Unit) => {
    if (road.has(u.id)) {
      setRoad((r) => { const n = new Set(r); n.delete(u.id); return n; });
      perform({ t: "unflag_road", jobId: p.jobId, unitId: u.id });
    } else {
      setRoad((r) => new Set([...r, u.id]));
      const d = { ...done }; delete d[u.id]; setDone(d);
      perform({ t: "flag", jobId: p.jobId, unitId: u.id, companyId: p.companyId, userId: p.userId, kind: "road_out", note: "" });
    }
  };
  const logDamage = (u: Unit) => {
    const note = dmgTxt.trim();
    if (!note) return;
    setDmg({ ...dmg, [u.id]: { note, by: p.myInitials } });
    setDmgFor(null); setDmgTxt("");
    perform({ t: "flag", jobId: p.jobId, unitId: u.id, companyId: p.companyId, userId: p.userId, kind: "damage", note });
  };
  const quickLog = () => {
    const number = qNum.trim();
    if (!number) return;
    const known = units.find((u) => u.number.toLowerCase() === number.toLowerCase());
    if (known) { if (!done[known.id]) toggle(known); }
    else {
      const temp: Unit = { id: "tmp-" + Date.now(), number, typeName: p.types.find((t) => t.id === qType)?.name ?? "" };
      setUnits([...units, temp]);
      setDone((d) => ({ ...d, [temp.id]: { by: p.myInitials, at: now() } }));
      perform({ t: "quicklog", jobId: p.jobId, clientId: p.clientId, companyId: p.companyId, userId: p.userId, number, typeId: qType || null });
    }
    setQNum("");
  };

  return (
    <div>
      {(!online || queued > 0) && (
        <div style={{ background: online ? "#E9F7EF" : "#FFF4E0", border: `1.5px solid ${online ? "#9BD8B4" : "#E0A83C"}`, borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontWeight: 700, fontSize: 13, color: online ? "#0F3D2E" : "#7A5200" }}>
          {online ? `⇅ Syncing ${queued} logged wash${queued === 1 ? "" : "es"}…` : `⛁ Offline — ${queued} wash${queued === 1 ? "" : "es"} saved on this phone, will sync when signal returns. Keep logging.`}
        </div>
      )}
      <div className="disp dim" style={{ fontSize: 13, marginBottom: 8 }}>Quick log — punch in unit #s as you finish</div>
      <div className="card" style={{ marginBottom: 16, padding: "12px 14px" }}>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <input className="inp mono" value={qNum} onChange={(e) => setQNum(e.target.value)} onKeyDown={(e) => e.key === "Enter" && quickLog()}
            placeholder="Unit # (e.g. 242077)" autoCapitalize="characters" style={{ flex: 2, minWidth: 150, fontWeight: 700 }} />
          <select className="inp" value={qType} onChange={(e) => setQType(e.target.value)} style={{ flex: 1, minWidth: 120 }}>
            {p.types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button className="btn btn-green" style={{ minHeight: 48 }} onClick={quickLog}>✓ Log</button>
        </div>
        <div className="dim" style={{ fontSize: 12, marginTop: 6 }}>Known numbers check off instantly; new ones join the roster. Works with zero signal — only logged units get billed.</div>
      </div>

      <div className="disp dim" style={{ fontSize: 13, marginBottom: 8 }}>Unit checklist</div>
      {units.map((u) => {
        const d = done[u.id];
        const isOut = road.has(u.id);
        const df = dmg[u.id];
        return (
          <div key={u.id} className="card" style={{ marginBottom: 10, border: `2px solid ${d ? "var(--green-d)" : isOut ? "#E0A83C" : "var(--lline)"}`, background: d ? "#E3F3EA" : isOut ? "#FFF4E0" : "#fff" }}>
            <button onClick={() => !isOut && toggle(u)} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}>
              <span className="mono" style={{ fontWeight: 700, fontSize: 19, textDecoration: d ? "line-through" : "none", color: d ? "var(--green-d)" : "var(--ink)" }}>{u.number}</span>
              <span className="dim" style={{ display: "block", fontSize: 13, marginTop: 2 }}>
                {u.typeName || "—"}{d ? ` · washed by ${d.by} ${d.at}` : isOut ? " · OUT ON ROAD" : ""}
              </span>
            </button>
            <div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}>
              {!d && (
                <button className="btn btn-ghost" style={{ minHeight: 40, fontSize: 13, color: isOut ? "#7A5200" : "var(--ink-soft)", borderColor: isOut ? "#E0A83C" : "var(--lline)", background: isOut ? "#E0A83C" : "transparent" }} onClick={() => flagRoad(u)}>
                  {isOut ? "↩ Back in yard" : "⛟ Out on Road"}
                </button>
              )}
              {!u.id.startsWith("tmp-") && <UnitPhotos jobId={p.jobId} unitId={u.id} companyId={p.companyId} initial={p.photos[u.id] ?? []} />}
              {!d && (
                <button className="btn" style={{ minHeight: 40, fontSize: 13, background: "#fff", border: "1px solid var(--lline)", color: "#B3261E" }} onClick={() => { setDmgFor(dmgFor === u.id ? null : u.id); setDmgTxt(""); }}>⚑ Damage</button>
              )}
            </div>
            {dmgFor === u.id && (
              <div className="row" style={{ marginTop: 10 }}>
                <input className="inp" value={dmgTxt} onChange={(e) => setDmgTxt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && logDamage(u)} placeholder="Describe damage (logged pre-wash)…" autoFocus style={{ minHeight: 40 }} />
                <button className="btn" style={{ minHeight: 40, background: "#B3261E", color: "#fff" }} onClick={() => logDamage(u)}>Log</button>
              </div>
            )}
            {df && <div style={{ marginTop: 8, fontSize: 13, color: "#B3261E", fontWeight: 600 }}>⚑ {df.note} — {df.by}</div>}
          </div>
        );
      })}
      {units.length === 0 && <div className="dim">No roster yet — quick-log the first unit number above and it starts one.</div>}
    </div>
  );
}
