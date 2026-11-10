import { cn } from "@/lib/utils";

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
      <div className={cn("flex h-56 items-center justify-center text-sm text-muted-foreground", className)}>
        {empty}
      </div>
    );
  }
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn("flex h-56 items-end gap-px border-b pb-0", few ? "gap-1" : "gap-px")}
        role="img"
        aria-label="chart"
      >
        {rows.map((r) => {
          const height = r.value ? Math.max(3, (r.value / max) * 100) : 1;
          const bar = (
            <div
              className={cn(
                "w-full max-w-8 rounded-t-sm transition-colors",
                r.active ? "bg-foreground" : "bg-foreground/70",
                !r.value && "bg-muted",
              )}
              style={{ height: `${height}%` }}
            />
          );
          if (onClick) {
            return (
              <button
                key={r.key}
                type="button"
                className="group flex h-full min-w-0 flex-1 cursor-pointer items-end justify-center border-0 bg-transparent p-0 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title={title(r)}
                aria-label={title(r)}
                onClick={() => onClick(r)}
              >
                {bar}
              </button>
            );
          }
          return (
            <div key={r.key} className="flex h-full min-w-0 flex-1 items-end justify-center" title={title(r)}>
              {bar}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-px text-[10px] text-muted-foreground">
        {rows.map((r, i) => {
          const show = labelEvery ? i % labelEvery === 0 || i === rows.length - 1 : true;
          return (
            <span key={r.key} className="min-w-0 flex-1 overflow-hidden text-center whitespace-nowrap">
              {show ? label(r, i) : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}
