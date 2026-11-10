export const nf = new Intl.NumberFormat("en-US");

export function fmt(n: number) {
  return nf.format(n || 0);
}

export function pct(a: number, b: number) {
  return b ? Math.round((a / b) * 100) : 0;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Format YYYY-MM-DD as "10 Nov 2026" */
export function dayLabel(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Short chart label like "11/10" */
export function shortDay(day: string) {
  const [, m, d] = day.split("-").map(Number);
  return `${m}/${d}`;
}
