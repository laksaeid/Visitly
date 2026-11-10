import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLocale } from "@/shared/i18n";

type Props = {
  includeBots: boolean;
  onChange: (includeBots: boolean) => void;
};

export function BotFilter({ includeBots, onChange }: Props) {
  const { t } = useLocale();

  return (
    <ToggleGroup
      type="single"
      value={includeBots ? "bots" : "humans"}
      onValueChange={(value) => {
        if (!value) return;
        onChange(value === "bots");
      }}
      aria-label={t("filterAria")}
      size="sm"
    >
      <ToggleGroupItem value="humans" aria-label={t("filterHumans")}>
        {t("filterHumans")}
      </ToggleGroupItem>
      <ToggleGroupItem value="bots" aria-label={t("filterWithBots")}>
        {t("filterWithBots")}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
