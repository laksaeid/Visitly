import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  label: string;
  value: string;
  sub: string;
};

export function KpiCard({ label, value, sub }: Props) {
  return (
    <Card className="gap-2 py-4 shadow-none">
      <CardHeader className="px-4 pb-0">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 px-4">
        <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
        <p className="text-xs text-muted-foreground leading-snug">{sub}</p>
      </CardContent>
    </Card>
  );
}
