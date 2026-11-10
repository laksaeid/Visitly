type Props = {
  label: string;
  value: string;
  sub: string;
  primary?: boolean;
};

export function KpiCard({ label, value, sub, primary }: Props) {
  return (
    <article className={`kpi${primary ? " primary" : ""}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-sub">{sub}</div>
    </article>
  );
}
