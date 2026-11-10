export type ChartRow = {
  value: number;
  active?: boolean;
  key: string;
  [extra: string]: unknown;
};

type Props = {
  rows: ChartRow[];
  className?: string;
  few?: boolean;
  labelEvery?: number;
  empty?: string;
  label: (row: ChartRow, index: number) => string;
  title: (row: ChartRow) => string;
  onClick?: (row: ChartRow) => void;
};

export function BarChart({
  rows,
  className,
  few,
  labelEvery,
  empty = "No data",
  label,
  title,
  onClick,
}: Props) {
  const has = rows.some((r) => r.value > 0);
  if (!has) {
    return (
      <div className={`chart ${className || ""}`}>
        <div className="empty">{empty}</div>
      </div>
    );
  }
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className={`chart ${className || ""}${few ? " few" : ""}`}>
      <div className="plot" role="img" aria-label="chart">
        {rows.map((r) =>
          onClick ? (
            <button
              key={r.key}
              type="button"
              className="col is-clickable"
              onClick={() => onClick(r)}
              title={title(r)}
              aria-label={title(r)}
            >
              <div
                className={`bar${r.value ? "" : " zero"}${r.active ? " active" : ""}`}
                style={{ height: `${r.value ? Math.max(2, (r.value / max) * 100) : 1}%` }}
              />
            </button>
          ) : (
            <div key={r.key} className="col" title={title(r)}>
              <div
                className={`bar${r.value ? "" : " zero"}${r.active ? " active" : ""}`}
                style={{ height: `${r.value ? Math.max(2, (r.value / max) * 100) : 1}%` }}
              />
            </div>
          ),
        )}
      </div>
      <div className="xlabels">
        {rows.map((r, i) => {
          const show = labelEvery
            ? i % labelEvery === 0 || i === rows.length - 1
            : true;
          return <span key={r.key}>{show ? label(r, i) : ""}</span>;
        })}
      </div>
    </div>
  );
}
