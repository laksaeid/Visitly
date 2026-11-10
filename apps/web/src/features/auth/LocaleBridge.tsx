import type { ReactNode } from "react";
import { LocaleProvider } from "@/shared/i18n";
import { useAuth } from "./AuthContext";

/** Applies server default locale until the user picks one in the UI. */
export function LocaleBridge({ children }: { children: ReactNode }) {
  const { config } = useAuth();
  return <LocaleProvider defaultLocale={config?.locale || "en"}>{children}</LocaleProvider>;
}
