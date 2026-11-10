import type { Locale } from "@/shared/i18n/messages";

const formatters: Record<Locale, Intl.NumberFormat> = {
  en: new Intl.NumberFormat("en-US"),
  fa: new Intl.NumberFormat("fa-IR"),
};

const MONTHS_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

let activeLocale: Locale = "en";

export function setDateLocale(locale: Locale) {
  activeLocale = locale;
}

export function fmt(n: number) {
  return formatters[activeLocale].format(n || 0);
}

export function pct(a: number, b: number) {
  return b ? Math.round((a / b) * 100) : 0;
}

function parseDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Format YYYY-MM-DD for the active locale */
export function dayLabel(day: string) {
  if (activeLocale === "fa") {
    return new Intl.DateTimeFormat("fa-IR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(parseDay(day));
  }
  const [y, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS_EN[m - 1]} ${y}`;
}

/** Short chart label */
export function shortDay(day: string) {
  if (activeLocale === "fa") {
    return new Intl.DateTimeFormat("fa-IR", {
      month: "numeric",
      day: "numeric",
    }).format(parseDay(day));
  }
  const [, m, d] = day.split("-").map(Number);
  return `${m}/${d}`;
}
