export const money = (cents: number) => "$" + (cents / 100).toFixed(2);
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
export const sameDay = (a: string | Date, b: string | Date) => new Date(a).toDateString() === new Date(b).toDateString();
export function fmtRange(iso: string, mins?: number | null) {
  if (!mins) return fmtTime(iso);
  const end = new Date(new Date(iso).getTime() + mins * 60000).toISOString();
  return `${fmtTime(iso)}\u2013${fmtTime(end)}`;
}
export type Truck = { id: string; name: string; color: string };
export const txtOn = (hex: string) => {
  const h = (hex || "#888888").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#14213D" : "#fff";
};
