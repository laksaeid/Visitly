import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { setDateLocale } from "@/shared/dates";
import { messages, type Locale, type MessageKey } from "./messages";

const STORAGE_KEY = "visitly_locale";

type Vars = Record<string, string | number>;

type LocaleState = {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: MessageKey, vars?: Vars) => string;
};

const LocaleContext = createContext<LocaleState | null>(null);

function normalizeLocale(value: string | null | undefined): Locale | null {
  if (value === "fa" || value === "en") return value;
  return null;
}

function applyDocumentLocale(locale: Locale) {
  const dir = locale === "fa" ? "rtl" : "ltr";
  document.documentElement.lang = locale;
  document.documentElement.dir = dir;
  document.documentElement.dataset.locale = locale;
}

function formatTemplate(template: string, vars?: Vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{${key}}`,
  );
}

function readStoredLocale(): Locale | null {
  try {
    return normalizeLocale(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function LocaleProvider({
  children,
  defaultLocale = "en",
}: {
  children: ReactNode;
  defaultLocale?: string;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    return readStoredLocale() || normalizeLocale(defaultLocale) || "en";
  });

  useEffect(() => {
    if (readStoredLocale()) return;
    const fromDefault = normalizeLocale(defaultLocale);
    if (fromDefault && fromDefault !== locale) {
      setLocaleState(fromDefault);
    }
  }, [defaultLocale, locale]);

  useEffect(() => {
    applyDocumentLocale(locale);
    setDateLocale(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "fa" ? "en" : "fa");
  }, [locale, setLocale]);

  const t = useCallback(
    (key: MessageKey, vars?: Vars) => formatTemplate(messages[locale][key], vars),
    [locale],
  );

  const value = useMemo(
    () => ({
      locale,
      dir: locale === "fa" ? ("rtl" as const) : ("ltr" as const),
      setLocale,
      toggleLocale,
      t,
    }),
    [locale, setLocale, toggleLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale outside LocaleProvider");
  return ctx;
}
