import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  label: string;
  value: string;
  sub: string;
};

export function KpiCard({ label, value, sub }: Props) {
  return (
    <Card className="gap-2 py-4 shadow-none">
      <CardHeader className="px-4 pb-0">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tracking-tight tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <p className="text-xs text-muted-foreground leading-snug">{sub}</p>
      </CardContent>
    </Card>
  );
}
