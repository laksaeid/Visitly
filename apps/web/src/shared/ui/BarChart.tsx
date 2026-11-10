import { ChartColumnIncreasing } from "lucide-react";
import { Bar, BarChart as RechartsBarChart, CartesianGrid, Cell, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export type ChartRow = {
  value: number;
  active?: boolean;
  key: string;
  [extra: string]: unknown;
};

type Props = {
  rows: ChartRow[];
  className?: string;
  empty?: string;
  label: (row: ChartRow, index: number) => string;
  title: (row: ChartRow) => string;
  onClick?: (row: ChartRow) => void;
};

const chartConfig = {
  value: {
    label: "Visitors",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function BarChart({ rows, className, empty = "No data", label, title, onClick }: Props) {
  const has = rows.some((r) => r.value > 0);
  if (!has) {
    return (
      <Empty className="h-56 border-0 p-4 md:p-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ChartColumnIncreasing />
          </EmptyMedia>
          <EmptyTitle className="text-sm font-medium">{empty}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  const data = rows.map((r, i) => ({
    ...r,
    label: label(r, i),
    tooltip: title(r),
  }));

  return (
    <ChartContainer config={chartConfig} className={className ?? "aspect-auto h-56 w-full"}>
      <RechartsBarChart
        accessibilityLayer
        data={data}
        margin={{ left: 4, right: 4, top: 8, bottom: 0 }}
        onClick={(state) => {
          if (!onClick) return;
          const index =
            typeof state.activeIndex === "number"
              ? state.activeIndex
              : typeof state.activeTooltipIndex === "number"
                ? state.activeTooltipIndex
                : -1;
          if (index < 0 || index >= rows.length) return;
          onClick(rows[index]);
        }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(_value, _name, item) => {
                const payload = item?.payload as { tooltip?: string } | undefined;
                return payload?.tooltip ?? "";
              }}
            />
          }
        />
        <Bar dataKey="value" radius={[3, 3, 0, 0]} cursor={onClick ? "pointer" : undefined}>
          {data.map((entry) => (
            <Cell
              key={entry.key}
              fill={entry.active ? "var(--chart-1)" : "var(--chart-2)"}
              fillOpacity={entry.active ? 1 : 0.75}
            />
          ))}
        </Bar>
      </RechartsBarChart>
    </ChartContainer>
  );
}
