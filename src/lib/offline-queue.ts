"use client";
import type { SupabaseClient } from "@supabase/supabase-js";

const KEY = "fwos-op-queue";

export type Op =
  | { t: "check"; jobId: string; unitId: string; companyId: string; userId: string }
  | { t: "uncheck"; jobId: string; unitId: string }
  | { t: "flag"; jobId: string; unitId: string; companyId: string; userId: string; kind: "damage" | "road_out"; note: string }
  | { t: "unflag_road"; jobId: string; unitId: string }
  | { t: "quicklog"; jobId: string; clientId: string; companyId: string; userId: string; number: string; typeId: string | null };

const read = (): Op[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; } };
const write = (q: Op[]) => localStorage.setItem(KEY, JSON.stringify(q));

export const enqueue = (op: Op) => write([...read(), op]);
export const pending = () => read().length;

async function exec(supabase: SupabaseClient, op: Op) {
  switch (op.t) {
    case "check":
      await supabase.from("unit_checkoffs").upsert({ job_id: op.jobId, unit_id: op.unitId, company_id: op.companyId, checked_by: op.userId });
      await supabase.from("unit_flags").delete().match({ job_id: op.jobId, unit_id: op.unitId, kind: "road_out" });
      return;
    case "uncheck":
      await supabase.from("unit_checkoffs").delete().match({ job_id: op.jobId, unit_id: op.unitId });
      return;
    case "flag":
      await supabase.from("unit_flags").insert({ job_id: op.jobId, unit_id: op.unitId, company_id: op.companyId, created_by: op.userId, kind: op.kind, note: op.note });
      if (op.kind === "road_out") await supabase.from("unit_checkoffs").delete().match({ job_id: op.jobId, unit_id: op.unitId });
      return;
    case "unflag_road":
      await supabase.from("unit_flags").delete().match({ job_id: op.jobId, unit_id: op.unitId, kind: "road_out" });
      return;
    case "quicklog": {
      const { data: existing } = await supabase.from("units").select("id").eq("client_id", op.clientId).ilike("number", op.number).maybeSingle();
      let unitId = existing?.id as string | undefined;
      if (!unitId) {
        const { data: created, error } = await supabase.from("units")
          .insert({ company_id: op.companyId, client_id: op.clientId, number: op.number, asset_type_id: op.typeId }).select("id").single();
        if (error) {
          const { data: retry } = await supabase.from("units").select("id").eq("client_id", op.clientId).ilike("number", op.number).maybeSingle();
          unitId = retry?.id;
        } else unitId = created?.id;
      }
      if (!unitId) throw new Error("quicklog unit unresolved");
      const { data: job } = await supabase.from("jobs").select("unit_ids").eq("id", op.jobId).single();
      if (job && !(job.unit_ids as string[]).includes(unitId)) {
        await supabase.from("jobs").update({ unit_ids: [...job.unit_ids, unitId] }).eq("id", op.jobId);
      }
      await supabase.from("unit_checkoffs").upsert({ job_id: op.jobId, unit_id: unitId, company_id: op.companyId, checked_by: op.userId });
      return;
    }
  }
}

let flushing = false;
/** Runs the queue in order. Stops (keeps remainder) on network failure; drops ops that fail for non-network reasons after retrying once. */
export async function flush(supabase: SupabaseClient): Promise<number> {
  if (flushing) return pending();
  flushing = true;
  try {
    let q = read();
    while (q.length) {
      if (typeof navigator !== "undefined" && !navigator.onLine) break;
      try {
        await exec(supabase, q[0]);
        q = q.slice(1);
        write(q);
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (/fetch|network|Failed to fetch|timeout/i.test(msg)) break;   // offline-ish: retry later
        q = q.slice(1); write(q);                                        // data error: drop so the queue can't jam
      }
    }
    return q.length;
  } finally { flushing = false; }
}
