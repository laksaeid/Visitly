import { useLocale } from "@/shared/i18n/LocaleContext";

export function LangToggle({ className = "lang-toggle" }: { className?: string }) {
  const { locale, toggleLocale, t } = useLocale();
  const label = locale === "fa" ? t("langSwitchToEn") : t("langSwitchToFa");

  return (
    <button
      type="button"
      className={className}
      onClick={toggleLocale}
      aria-label={t("langAria")}
      title={t("langAria")}
    >
      {label}
    </button>
  );
}
