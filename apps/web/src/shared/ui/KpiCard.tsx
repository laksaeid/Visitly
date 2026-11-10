import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string;
  sub: string;
  primary?: boolean;
};

export function KpiCard({ label, value, sub, primary }: Props) {
  return (
    <Card
      className={cn(
        "gap-2 py-3 shadow-sm",
        primary && "border-transparent bg-primary text-primary-foreground shadow-md",
      )}
    >
      <CardHeader className="px-4 pb-0">
        <CardDescription className={cn("text-xs font-semibold", primary && "text-primary-foreground/75")}>
          {label}
        </CardDescription>
        <CardTitle className="font-mono text-2xl tracking-tight">{value}</CardTitle>
      </CardHeader>
      <CardContent className={cn("px-4 text-xs text-muted-foreground", primary && "text-primary-foreground/75")}>
        {sub}
      </CardContent>
    </Card>
  );
}
