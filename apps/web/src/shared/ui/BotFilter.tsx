import { useLocale } from "@/shared/i18n";

type Props = {
  includeBots: boolean;
  onChange: (includeBots: boolean) => void;
};

export function BotFilter({ includeBots, onChange }: Props) {
  const { t } = useLocale();

  return (
    <div className="filter-group" role="group" aria-label={t("filterAria")}>
      <button
        type="button"
        className={`filter-chip${!includeBots ? " is-active" : ""}`}
        aria-pressed={!includeBots}
        onClick={() => onChange(false)}
      >
        {t("filterHumans")}
      </button>
      <button
        type="button"
        className={`filter-chip${includeBots ? " is-active" : ""}`}
        aria-pressed={includeBots}
        onClick={() => onChange(true)}
      >
        {t("filterWithBots")}
      </button>
    </div>
  );
}
