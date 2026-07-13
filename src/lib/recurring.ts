import type { SupabaseClient } from "@supabase/supabase-js";

/** Keeps recurring series alive: for any series whose latest occurrence has
    started, insert the next one. Called on schedule/field page loads. */
export async function materializeRecurring(supabase: SupabaseClient) {
  const { data: recs } = await supabase.from("jobs").select("*").not("recurrence_days", "is", null);
  if (!recs?.length) return;
  const bySeries = new Map<string, any[]>();
  recs.forEach((j) => {
    const k = j.series_id ?? j.id;
    bySeries.set(k, [...(bySeries.get(k) ?? []), j]);
  });
  for (const [seriesId, jobs] of bySeries) {
    const latest = jobs.sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
    if (new Date(latest.starts_at).getTime() > Date.now()) continue;
    const next = new Date(new Date(latest.starts_at).getTime() + latest.recurrence_days * 86400000);
    await supabase.from("jobs").insert({
      company_id: latest.company_id, client_id: latest.client_id,
      starts_at: next.toISOString(), duration_min: latest.duration_min,
      truck_id: latest.truck_id, worker_ids: latest.worker_ids, unit_ids: latest.unit_ids,
      recurrence_days: latest.recurrence_days, series_id: seriesId,
    });
  }
}
