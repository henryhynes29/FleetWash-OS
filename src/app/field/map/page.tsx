import LiveMap from "@/components/LiveMap";
export const dynamic = "force-dynamic";

export default function FieldMap() {
  return (
    <div>
      <h1 className="disp" style={{ fontSize: 22, marginBottom: 4 }}>Live Map</h1>
      <div className="dim" style={{ fontSize: 13, marginBottom: 14 }}>
        Everyone on the clock, updating every 15 seconds. Tap a crew card to navigate to them.
      </div>
      <LiveMap />
    </div>
  );
}
