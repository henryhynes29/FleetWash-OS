"use client";
import { useRef, useState } from "react";
import { sbBrowser } from "@/lib/supabase-client";

export default function UnitPhotos({ jobId, unitId, companyId, initial }: { jobId: string; unitId: string; companyId: string; initial: { url: string }[] }) {
  const [photos, setPhotos] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const compress = (file: File): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const max = 1200, scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error("compress failed"))), "image/jpeg", 0.7);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const supabase = sbBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const blob = await compress(file);
      const path = `${companyId}/${jobId}/${unitId}-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("wash-photos").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      await supabase.from("wash_photos").insert({ company_id: companyId, job_id: jobId, unit_id: unitId, storage_path: path, taken_by: user.id });
      const { data: signed } = await supabase.storage.from("wash-photos").createSignedUrl(path, 3600);
      if (signed) setPhotos((p) => [...p, { url: signed.signedUrl }]);
    } catch (e) { console.error(e); } finally { setBusy(false); }
  };

  return (
    <span>
      <input ref={ref} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
      <button onClick={() => ref.current?.click()} className="btn btn-ghost" style={{ minHeight: 40, fontSize: 13 }} disabled={busy}>
        {busy ? "…" : "📷"}
      </button>
      {photos.length > 0 && (
        <span style={{ display: "inline-flex", gap: 6, marginLeft: 8, verticalAlign: "middle" }}>
          {photos.map((p, i) => (
            <img key={i} src={p.url} alt={`wash photo ${i + 1}`} onClick={() => setViewer(p.url)}
              style={{ width: 42, height: 42, objectFit: "cover", borderRadius: 8, cursor: "pointer", border: "1px solid var(--lline)" }} />
          ))}
        </span>
      )}
      {viewer && (
        <span onClick={() => setViewer(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <img src={viewer} alt="wash photo" style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 10 }} />
        </span>
      )}
    </span>
  );
}
