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
      variant="outline"
      className="w-full min-w-0"
    >
      <ToggleGroupItem
        value="humans"
        aria-label={t("filterHumans")}
        className="min-w-0 flex-1 px-2 text-xs"
      >
        <span className="truncate">{t("filterHumans")}</span>
      </ToggleGroupItem>
      <ToggleGroupItem
        value="bots"
        aria-label={t("filterWithBots")}
        className="min-w-0 flex-1 px-2 text-xs"
      >
        <span className="truncate">{t("filterWithBots")}</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
