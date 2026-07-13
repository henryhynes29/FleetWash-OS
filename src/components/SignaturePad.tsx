"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sbBrowser } from "@/lib/supabase-client";

export default function SignaturePad({ jobId, companyId, existing }: { jobId: string; companyId: string; existing: { url: string; name: string } | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [drew, setDrew] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const drawing = useRef(false);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvasRef.current!.width / r.width), y: (e.clientY - r.top) * (canvasRef.current!.height / r.height) };
  };
  const start = (e: React.PointerEvent) => { drawing.current = true; const c = canvasRef.current!.getContext("2d")!; const { x, y } = pos(e); c.beginPath(); c.moveTo(x, y); };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const c = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    c.lineWidth = 2.5; c.lineCap = "round"; c.strokeStyle = "#14213D";
    c.lineTo(x, y); c.stroke(); setDrew(true);
  };
  const clear = () => { const cv = canvasRef.current!; cv.getContext("2d")!.clearRect(0, 0, cv.width, cv.height); setDrew(false); };

  const save = async () => {
    if (!drew) return;
    setBusy(true);
    try {
      const supabase = sbBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const blob: Blob = await new Promise((res, rej) => canvasRef.current!.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/png"));
      const path = `${companyId}/signatures/${jobId}-${Date.now()}.png`;
      const { error } = await supabase.storage.from("wash-photos").upload(path, blob, { contentType: "image/png" });
      if (error) throw error;
      await supabase.from("signatures").insert({ company_id: companyId, job_id: jobId, signer_name: name.trim(), storage_path: path, captured_by: user.id });
      setOpen(false);
      router.refresh();
    } catch (e) { console.error(e); } finally { setBusy(false); }
  };

  if (existing) {
    return (
      <div className="card" style={{ marginTop: 16, borderColor: "var(--green-d)", background: "#F4FBF7" }}>
        <div className="disp dim" style={{ fontSize: 12, marginBottom: 6 }}>Signed on site{existing.name ? ` — ${existing.name}` : ""}</div>
        <img src={existing.url} alt={`Signature${existing.name ? " of " + existing.name : ""}`} style={{ maxHeight: 80, background: "#fff", borderRadius: 8, border: "1px solid var(--lline)" }} />
      </div>
    );
  }
  return (
    <div className="card" style={{ marginTop: 16 }}>
      {!open ? (
        <button className="btn btn-ghost" style={{ width: "100%", color: "var(--ink)", borderColor: "var(--lline)" }} onClick={() => setOpen(true)}>✍️ Get customer signature</button>
      ) : (
        <div>
          <div className="disp dim" style={{ fontSize: 12, marginBottom: 8 }}>Customer sign-off — confirms the wash list for this visit</div>
          <input className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="Signer name (e.g. yard manager)" style={{ marginBottom: 8, minHeight: 42 }} />
          <canvas ref={canvasRef} width={640} height={200}
            onPointerDown={start} onPointerMove={move} onPointerUp={() => (drawing.current = false)} onPointerLeave={() => (drawing.current = false)}
            style={{ width: "100%", height: 130, background: "#fff", border: "1.5px dashed var(--lline)", borderRadius: 10, touchAction: "none" }} />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn btn-ghost" style={{ flex: 1, minHeight: 42, fontSize: 14 }} onClick={clear}>Clear</button>
            <button className="btn btn-green" style={{ flex: 2, minHeight: 42, fontSize: 14 }} onClick={save} disabled={!drew || busy}>{busy ? "Saving…" : "Save signature"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
