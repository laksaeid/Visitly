import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuth } from "@/features/auth/AuthContext";
import { ApiError, api } from "@/shared/api/client";
import type { TopListPayload } from "@/shared/api/types";
import { dayLabel, fmt } from "@/shared/dates";
import { useLocale } from "@/shared/i18n";
import { BotFilter } from "@/shared/ui/BotFilter";
import { LangToggle } from "@/shared/ui/LangToggle";

function readBotsParam(params: URLSearchParams) {
  const v = (params.get("bots") || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function TopListPage() {
  const { config } = useAuth();
  const { t, locale } = useLocale();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const kind = (params.get("kind") || "pages").toLowerCase() === "refs" ? "refs" : "pages";
  const day = params.get("day");
  const includeBots = readBotsParam(params);
  const [data, setData] = useState<TopListPayload | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const site = config?.site_name || "Visitly";

  const patchParams = useCallback(
    (patch: Record<string, string | null>) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v === null || v === "") next.delete(k);
          else next.set(k, v);
        }
        return next;
      });
    },
    [setParams],
  );

  const load = useCallback(async () => {
    try {
      const payload = await api.top(kind, day, includeBots);
      setData(payload);
      setError("");
      if (payload.day && payload.day !== day) {
        patchParams({
          kind,
          day: payload.day,
          bots: includeBots ? "1" : null,
        });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate("/login", { replace: true });
        return;
      }
      setError(err instanceof Error ? err.message : "network error");
    }
  }, [day, kind, includeBots, navigate, patchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const rows = data?.rows || [];
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      const raw = String(r[data!.name_key] || "");
      return labelRow(kind, raw, t).toLowerCase().includes(needle);
    });
  }, [data, kind, q, t]);

  const title = kind === "pages" ? t("topPages") : t("trafficSources");
  const backQs = new URLSearchParams();
  if (day) backQs.set("day", day);
  if (includeBots) backQs.set("bots", "1");
  const backTo = backQs.toString() ? `/?${backQs.toString()}` : "/";

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6" key={locale}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <Badge variant="secondary" className="font-mono uppercase tracking-wider">
            {site}
          </Badge>
          <h1 className="font-mono text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{t("listSub")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LangToggle />
          <Button asChild variant="outline" size="sm">
            <Link to={backTo}>
              <ArrowLeft />
              {t("backDashboard")}
            </Link>
          </Button>
        </div>
      </header>

      <Card className="py-3">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 px-4">
          <BotFilter
            includeBots={includeBots}
            onChange={(next) =>
              patchParams({
                kind,
                day: day || null,
                bots: next ? "1" : null,
              })
            }
          />
          <p className="text-xs text-muted-foreground">
            {includeBots ? t("filterHintBots") : t("filterHintHumans")}
          </p>
        </CardContent>
      </Card>

      <Card className="py-3">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 px-4">
          <ToggleGroup
            type="single"
            value={kind}
            onValueChange={(value) => {
              if (!value) return;
              setQ("");
              patchParams({
                kind: value,
                day: day || null,
                bots: includeBots ? "1" : null,
              });
            }}
            size="sm"
          >
            <ToggleGroupItem value="pages">{t("pages")}</ToggleGroupItem>
            <ToggleGroupItem value="refs">{t("sources")}</ToggleGroupItem>
          </ToggleGroup>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {data ? `${dayLabel(data.day)}${data.is_today ? t("todaySuffix") : ""}` : "—"}
            </span>
            <Select
              value={data?.day || day || ""}
              onValueChange={(value) => {
                setQ("");
                patchParams({
                  kind,
                  day: value,
                  bots: includeBots ? "1" : null,
                });
              }}
            >
              <SelectTrigger className="min-w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...(data?.available_days || [])].reverse().map((d) => (
                  <SelectItem key={d} value={d}>
                    {dayLabel(d)} — {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{t("listLoadError", { error })}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{kind === "pages" ? t("colPage") : t("colSource")}</CardTitle>
          <CardDescription>
            {data
              ? filtered.length === (data.rows || []).length
                ? t("rowsViews", { rows: data.rows.length, views: fmt(data.total_views) })
                : t("rowsOf", { filtered: filtered.length, total: data.rows.length })
              : "—"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="search"
            placeholder={t("searchPlaceholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">{t("colRank")}</TableHead>
                <TableHead>{kind === "pages" ? t("colPage") : t("colSource")}</TableHead>
                <TableHead className="w-28 text-end">{t("colViews")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r, i) => {
                const raw = String(r[data!.name_key] || "");
                const label = labelRow(kind, raw, t);
                const total = data?.total_views || 1;
                return (
                  <TableRow key={`${raw}-${i}`}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </TableCell>
                    <TableCell
                      className={isHost(kind, raw) ? "max-w-0 truncate font-mono text-xs" : "max-w-0 truncate"}
                      title={label}
                    >
                      {label}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="inline-flex items-center justify-end gap-2">
                        <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-muted sm:inline-block">
                          <i
                            className="block h-full rounded-full bg-primary"
                            style={{ width: `${Math.max(2, (r.views / total) * 100)}%` }}
                          />
                        </span>
                        <span className="font-semibold tabular-nums">{fmt(r.views)}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {!filtered.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t("noMatches")}</div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function labelRow(kind: string, raw: string, t: (key: "homePath" | "directRef") => string) {
  if (kind === "pages") return raw === "/" ? t("homePath") : raw;
  return raw === "Direct" ? t("directRef") : raw;
}

function isHost(kind: string, raw: string) {
  if (kind === "pages") return raw.charAt(0) === "/";
  return Boolean(raw && raw !== "Direct");
}
