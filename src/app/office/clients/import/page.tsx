"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sbBrowser } from "@/lib/supabase-client";

const FIELDS = ["name","contact","phone","address","terms","arrival","frequency","fleet_notes","specialty","complaints","wash_time","washers","chems","skip"] as const;
type Field = typeof FIELDS[number];

function guess(header: string): Field {
  const h = header.toLowerCase();
  if (/name|company|client|account/.test(h)) return "name";
  if (/contact|poc|manager/.test(h)) return "contact";
  if (/phone|tel|cell/.test(h)) return "phone";
  if (/address|location|addr|city/.test(h)) return "address";
  if (/term/.test(h)) return "terms";
  if (/arriv|window/.test(h)) return "arrival";
  if (/freq|schedule|recurr/.test(h)) return "frequency";
  if (/fleet|vehicle|unit|truck/.test(h)) return "fleet_notes";
  if (/special|note|procedure|gate|instruction|detail/.test(h)) return "specialty";
  if (/complain|issue|watch/.test(h)) return "complaints";
  if (/time|duration/.test(h)) return "wash_time";
  if (/washer|crew|worker/.test(h)) return "washers";
  if (/chem|soap|supplies|gear/.test(h)) return "chems";
  return "skip";
}

// small CSV parser: quotes, escaped quotes, newlines-in-quotes
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

export default function ImportClients() {
  const [rows, setRows] = useState<string[][]>([]);
  const [map, setMap] = useState<Field[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const router = useRouter();

  const load = (text: string) => {
    const parsed = parseCSV(text);
    if (parsed.length < 2) { setResult("Need a header row plus at least one data row."); return; }
    setRows(parsed);
    setMap(parsed[0].map((h) => guess(h)));
    setResult("");
  };

  const runImport = async () => {
    setBusy(true); setResult("");
    try {
      const supabase = sbBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data: p } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
      const { data: existing } = await supabase.from("clients").select("name");
      const have = new Set((existing ?? []).map((c) => c.name.trim().toLowerCase()));

      const idx = (f: Field) => map.indexOf(f);
      const records = rows.slice(1).map((r) => {
        const get = (f: Field) => (idx(f) >= 0 ? (r[idx(f)] ?? "").trim() : "");
        return {
          company_id: p!.company_id,
          name: get("name"), contact: get("contact"), phone: get("phone"), address: get("address"),
          terms: get("terms") || "Net 30", arrival: get("arrival"), frequency: get("frequency"),
          fleet_notes: get("fleet_notes"), specialty: get("specialty"), complaints: get("complaints"),
          wash_time: get("wash_time"), washers: get("washers"),
          chems: get("chems") ? get("chems").split(/[;,]/).map((x) => x.trim()).filter(Boolean) : [],
        };
      }).filter((r) => r.name);

      const fresh = records.filter((r) => !have.has(r.name.toLowerCase()));
      const dupes = records.length - fresh.length;
      let inserted = 0;
      for (let i = 0; i < fresh.length; i += 50) {
        const batch = fresh.slice(i, i + 50);
        const { error } = await supabase.from("clients").insert(batch);
        if (error) throw error;
        inserted += batch.length;
      }
      setResult(`✓ Imported ${inserted} client${inserted === 1 ? "" : "s"}${dupes ? ` · skipped ${dupes} already in the book` : ""}${records.length !== rows.length - 1 ? ` · skipped ${rows.length - 1 - records.length} rows with no name` : ""}`);
      setTimeout(() => router.push("/office/clients"), 1600);
    } catch (e: any) {
      setResult("Import failed: " + (e?.message ?? String(e)));
    } finally { setBusy(false); }
  };

  return (
    <div>
      <Link href="/office/clients">← Clients</Link>
      <h1 className="disp" style={{ fontSize: 24, margin: "8px 0 4px" }}>Import clients</h1>
      <div className="dim" style={{ fontSize: 14, marginBottom: 14 }}>Paste or upload any CSV — columns get auto-detected, you fix anything it guessed wrong, one click loads the whole book. Duplicate names are skipped, so re-running is safe.</div>

      {rows.length === 0 && (
        <div className="card">
          <textarea className="inp" rows={7} placeholder={"Paste CSV here…\nname,address,specialty\nKwik Trip,2617 Tower Ave,Gate code 45059#"}
            style={{ paddingTop: 10, fontFamily: "monospace", fontSize: 13 }}
            onChange={(e) => { if (e.target.value.trim().length > 10) load(e.target.value); }} />
          <div className="dim" style={{ margin: "10px 0", textAlign: "center" }}>— or —</div>
          <input type="file" accept=".csv,text/csv" className="inp" style={{ paddingTop: 12 }}
            onChange={async (e) => { const f = e.target.files?.[0]; if (f) load(await f.text()); }} />
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="disp dim" style={{ fontSize: 13, margin: "4px 0 8px" }}>{rows.length - 1} rows detected — check the column mapping</div>
          <div className="card" style={{ overflowX: "auto", marginBottom: 14 }}>
            <table style={{ borderCollapse: "collapse", fontSize: 13, minWidth: 600 }}>
              <thead>
                <tr>
                  {rows[0].map((h, i) => (
                    <th key={i} style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                      <div className="dim" style={{ fontWeight: 400, marginBottom: 4 }}>{h}</div>
                      <select className="inp" value={map[i]} onChange={(e) => setMap(map.map((m, j) => (j === i ? (e.target.value as Field) : m)))}
                        style={{ minHeight: 36, fontSize: 12, padding: "0 8px", borderColor: map[i] === "skip" ? "var(--line)" : "var(--orange)" }}>
                        {FIELDS.map((f) => <option key={f} value={f}>{f === "skip" ? "— skip —" : f}</option>)}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1, 5).map((r, i) => (
                  <tr key={i}>{r.map((c, j) => <td key={j} className="dim" style={{ padding: "5px 8px", borderBottom: "1px solid var(--line)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
            {rows.length > 5 && <div className="dim" style={{ fontSize: 12, marginTop: 6 }}>…and {rows.length - 5} more rows</div>}
          </div>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={runImport} disabled={busy || !map.includes("name")}>
              {busy ? "Importing…" : `Import ${rows.length - 1} clients`}
            </button>
            <button className="btn btn-ghost" onClick={() => { setRows([]); setResult(""); }}>Start over</button>
          </div>
          {!map.includes("name") && <div style={{ color: "var(--red)", fontWeight: 700, fontSize: 13, marginTop: 8 }}>Map one column to "name" to enable import.</div>}
        </>
      )}
      {result && <div style={{ marginTop: 12, fontWeight: 700, color: result.startsWith("✓") ? "var(--green)" : "var(--red)" }}>{result}</div>}
    </div>
  );
}
