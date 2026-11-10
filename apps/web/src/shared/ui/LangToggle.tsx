import { Button } from "@/components/ui/button";
import { useLocale } from "@/shared/i18n";

export function LangToggle() {
  const { locale, toggleLocale, t } = useLocale();
  const label = locale === "fa" ? t("langSwitchToEn") : t("langSwitchToFa");

  return (
    <Button type="button" variant="outline" size="sm" onClick={toggleLocale} aria-label={t("langAria")}>
      {label}
    </Button>
  );
}
