"use client";
import { useEffect, useState } from "react";
import { sbBrowser } from "@/lib/supabase-client";

type Pt = { user_id: string; lat: number; lng: number; updated_at: string; initials: string; name: string };

export default function LiveMap() {
  const [pts, setPts] = useState<Pt[]>([]);
  useEffect(() => {
    const supabase = sbBrowser();
    const load = async () => {
      const [{ data: pos }, { data: profs }] = await Promise.all([
        supabase.from("positions").select("*"),
        supabase.from("profiles").select("user_id, initials, display_name"),
      ]);
      const who = new Map((profs ?? []).map((p) => [p.user_id, p]));
      setPts((pos ?? []).map((p) => ({ ...p, initials: who.get(p.user_id)?.initials ?? "?", name: who.get(p.user_id)?.display_name ?? "" })));
    };
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  if (pts.length === 0) {
    return <div className="card" style={{ textAlign: "center", color: "var(--dim)", padding: "30px 16px" }}>◎ Nobody's on the clock — pins appear the moment someone punches in.</div>;
  }
  const lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng);
  let minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const padLat = Math.max((maxLat - minLat) * 0.3, 0.012), padLng = Math.max((maxLng - minLng) * 0.3, 0.018);
  minLat -= padLat; maxLat += padLat; minLng -= padLng; maxLng += padLng;
  const ago = (iso: string) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)}h ago`; };
  return (
    <div>
      <div style={{ position: "relative", height: 260, borderRadius: 16, overflow: "hidden",
        backgroundImage: "repeating-linear-gradient(0deg, rgba(159,176,204,0.07) 0 1px, transparent 1px 40px), repeating-linear-gradient(90deg, rgba(159,176,204,0.07) 0 1px, transparent 1px 40px), linear-gradient(150deg, #0C1322 0%, #14213D 55%, #1B2F55 130%)" }}>
        <div className="disp" style={{ position: "absolute", top: 10, left: 12, color: "var(--green)", fontSize: 11, fontWeight: 700 }}>● LIVE · {pts.length} ON CLOCK</div>
        {pts.map((p) => (
          <div key={p.user_id} title={`${p.name} · ${ago(p.updated_at)}`} style={{
            position: "absolute",
            left: `${((p.lng - minLng) / (maxLng - minLng)) * 100}%`,
            top: `${(1 - (p.lat - minLat) / (maxLat - minLat)) * 100}%`,
            transform: "translate(-50%,-50%)", width: 44, height: 44, borderRadius: "50%",
            border: "3px solid var(--green)", background: "var(--navy)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13,
            boxShadow: "0 0 0 6px rgba(67,217,138,0.15)",
          }} className="disp">{p.initials}</div>
        ))}
      </div>
      {pts.map((p) => (
        <div key={p.user_id} className="card" style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px" }}>
          <span style={{ fontWeight: 700 }}>{p.name} <span className="dim" style={{ fontSize: 12 }}>({p.initials}) · updated {ago(p.updated_at)}</span></span>
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`} target="_blank" style={{ fontWeight: 700, fontSize: 13 }}>🧭 Navigate to</a>
        </div>
      ))}
    </div>
  );
}
