"use client";
import { useEffect } from "react";
import { sbBrowser } from "@/lib/supabase-client";

export default function PositionBeacon({ userId, companyId, clockedIn }: { userId: string; companyId: string; clockedIn: boolean }) {
  useEffect(() => {
    if (!clockedIn || typeof navigator === "undefined" || !navigator.geolocation) return;
    const supabase = sbBrowser();
    let last = 0;
    const id = navigator.geolocation.watchPosition(
      async (p) => {
        if (Date.now() - last < 15000) return;
        last = Date.now();
        await supabase.from("positions").upsert({
          user_id: userId, company_id: companyId,
          lat: p.coords.latitude, lng: p.coords.longitude, updated_at: new Date().toISOString(),
        });
      },
      () => {}, { enableHighAccuracy: false, maximumAge: 30000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [clockedIn, userId, companyId]);
  return null;
}
