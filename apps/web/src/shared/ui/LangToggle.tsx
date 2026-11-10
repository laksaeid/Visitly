import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLocale } from "@/shared/i18n";

export function LangToggle() {
  const { locale, setLocale, t } = useLocale();

  return (
    <ToggleGroup
      type="single"
      value={locale}
      onValueChange={(value) => {
        if (value === "en" || value === "fa") setLocale(value);
      }}
      aria-label={t("langAria")}
      size="sm"
      variant="outline"
    >
      <ToggleGroupItem value="en" aria-label={t("langSwitchToEn")}>
        EN
      </ToggleGroupItem>
      <ToggleGroupItem value="fa" aria-label={t("langSwitchToFa")}>
        FA
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
