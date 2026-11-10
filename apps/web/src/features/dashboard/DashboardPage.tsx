import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useAuth } from "@/features/auth/AuthContext";
import { ApiError, api } from "@/shared/api/client";
import type { OverviewPayload } from "@/shared/api/types";
import { dayLabel, fmt, pct, shortDay } from "@/shared/dates";
import { useLocale } from "@/shared/i18n";
import { BarChart } from "@/shared/ui/BarChart";
import { BotFilter } from "@/shared/ui/BotFilter";
import { KpiCard } from "@/shared/ui/KpiCard";
import { LangToggle } from "@/shared/ui/LangToggle";

function readBotsParam(params: URLSearchParams) {
  const v = (params.get("bots") || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function DashboardPage() {
  const { logout, config } = useAuth();
  const { t, locale } = useLocale();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedDay = params.get("day");
  const includeBots = readBotsParam(params);
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [error, setError] = useState("");
  const site = config?.site_name || "Visitly";

  const patchParams = useCallback(
    (patch: Record<string, string | null>, replace = false) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v === null || v === "") next.delete(k);
          else next.set(k, v);
        }
        return next;
      }, { replace });
    },
    [setParams],
  );

  const load = useCallback(async (day?: string | null, bots = false) => {
    try {
      const payload = await api.overview(day, bots);
      setData(payload);
      setError("");
      const next = payload.selected_day;
      if (next && next !== day) patchParams({ day: next }, true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate("/login", { replace: true });
        return;
      }
      setError(err instanceof Error ? err.message : "network error");
    }
  }, [navigate, patchParams]);

  useEffect(() => {
    void load(selectedDay, includeBots);
    const timer = window.setInterval(() => void load(selectedDay, includeBots), 60000);
    return () => window.clearInterval(timer);
  }, [load, selectedDay, includeBots]);

  const day = data?.day;
  const dayKey = selectedDay || data?.selected_day || data?.today || "";
  const days = data?.available_days || [];
  const dayIndex = days.indexOf(dayKey);

  const selectDay = (dayValue: string) => {
    patchParams({ day: dayValue, bots: includeBots ? "1" : null });
  };

  const setIncludeBots = (next: boolean) => {
    patchParams({ day: dayKey || null, bots: next ? "1" : null });
  };

  const listUrl = (kind: string) => {
    const q = new URLSearchParams({ kind });
    if (dayKey) q.set("day", dayKey);
    if (includeBots) q.set("bots", "1");
    return `/list?${q.toString()}`;
  };

  const dailyRows = useMemo(
    () =>
      (data?.daily || []).map((r) => ({
        key: r.day,
        value: r.visitors,
        active: r.day === dayKey,
        day: r.day,
        all: r.visitors_all,
        views: r.pageviews,
      })),
    [data, dayKey],
  );

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        {error ? (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle />
            <AlertDescription>{t("loadError", { error })}</AlertDescription>
          </Alert>
        ) : null}
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  const totals = data.totals;
  const dt = day?.totals;
  const pvSubKey = includeBots ? "subPageviewsAll" : "subPageviewsIps";

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6" key={locale}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <Badge variant="secondary" className="font-mono uppercase tracking-wider">
            {site}
          </Badge>
          <h1 className="font-mono text-3xl font-bold tracking-tight">{t("trafficStats")}</h1>
          <p className="text-sm text-muted-foreground">{t("trafficSub", { timezone: data.timezone })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-2 py-1.5">
            <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
            {t("updated", { time: data.generated })}
          </Badge>
          <LangToggle />
          <Button type="button" variant="outline" size="sm" onClick={logout}>
            <LogOut />
            {t("signOut")}
          </Button>
        </div>
      </header>

      <Card className="py-3">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 px-4">
          <BotFilter includeBots={includeBots} onChange={setIncludeBots} />
          <p className="text-xs text-muted-foreground">
            {includeBots ? t("filterHintBots") : t("filterHintHumans")}
          </p>
        </CardContent>
      </Card>

      <Card className="py-3">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 px-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={dayIndex <= 0}
              onClick={() => dayIndex > 0 && selectDay(days[dayIndex - 1])}
            >
              <ChevronLeft />
              {t("previous")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={dayIndex < 0 || dayIndex >= days.length - 1}
              onClick={() => dayIndex >= 0 && dayIndex < days.length - 1 && selectDay(days[dayIndex + 1])}
            >
              {t("next")}
              <ChevronRight />
            </Button>
            <Button type="button" variant="accent" size="sm" onClick={() => selectDay(data.today)}>
              {t("today")}
            </Button>
          </div>
          <div className="font-mono text-sm font-semibold">
            {dayLabel(dayKey)}
            {dayKey === data.today ? t("todaySuffix") : ""}
          </div>
          <Select value={dayKey} onValueChange={selectDay}>
            <SelectTrigger className="min-w-48">
              <SelectValue placeholder={t("day")} />
            </SelectTrigger>
            <SelectContent>
              {[...days].reverse().map((d) => (
                <SelectItem key={d} value={d}>
                  {dayLabel(d)}
                  {d === data.today ? t("todayOption") : ""} — {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{t("loadErrorRetry", { error })}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label={t("summary")}>
        <KpiCard
          primary
          label={t("kpiToday")}
          value={fmt(totals.today.visitors)}
          sub={t(pvSubKey, {
            pageviews: fmt(totals.today.pageviews),
            ips: fmt(totals.today.visitors_all),
          })}
        />
        <KpiCard
          label={t("kpiYesterday")}
          value={fmt(totals.yesterday.visitors)}
          sub={t("subPageviews", { pageviews: fmt(totals.yesterday.pageviews) })}
        />
        <KpiCard
          label={t("kpiLast7")}
          value={fmt(totals.last7.visitors)}
          sub={t("subDailyAvg", { avg: fmt(Math.round(totals.last7.visitors / 7)) })}
        />
        <KpiCard
          label={t("kpiLast30")}
          value={fmt(totals.last30.visitors)}
          sub={t("subPageviews", { pageviews: fmt(totals.last30.pageviews) })}
        />
        <KpiCard
          label={t("kpiAllTime")}
          value={fmt(totals.all.visitors)}
          sub={t("subSince", { day: dayLabel(data.since || data.today) })}
        />
        <KpiCard
          label={t("kpiReturningToday")}
          value={fmt(totals.returning_today)}
          sub={t("subPctToday", { pct: pct(totals.returning_today, totals.today.visitors) })}
        />
      </section>

      {dt ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label={t("selectedDay")}>
          <KpiCard
            primary
            label={t("uniqueVisitors", { day: day?.is_today ? t("kpiToday") : dayLabel(dayKey) })}
            value={fmt(dt.visitors)}
            sub={t("dayWindow")}
          />
          <KpiCard
            label={t("pageviews")}
            value={fmt(dt.pageviews)}
            sub={t(includeBots ? "subPageviewsAll" : "subIpsBots", {
              pageviews: fmt(dt.pageviews),
              ips: fmt(dt.visitors_all),
            })}
          />
          <KpiCard
            label={t("botPageviews")}
            value={fmt(dt.bot_pageviews || 0)}
            sub={t("subTotalRequests", { requests: fmt(dt.requests || 0) })}
          />
          <KpiCard
            label={t("returning")}
            value={fmt(dt.returning || 0)}
            sub={t("subPctDay", { pct: pct(dt.returning || 0, dt.visitors) })}
          />
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle>{t("dailyUniques")}</CardTitle>
              <CardDescription>
                {dailyRows.length >= 30 ? t("last30Days") : t("nDays", { n: dailyRows.length })}
                {t("peak")}
                {fmt(Math.max(...dailyRows.map((r) => r.value), 1))}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <BarChart
              few={dailyRows.length <= 10}
              rows={dailyRows}
              labelEvery={dailyRows.length <= 10 ? 1 : dailyRows.length <= 20 ? 2 : 5}
              label={(r) => shortDay(String(r.day))}
              title={(r) =>
                t("chartUnique", {
                  day: dayLabel(String(r.day)),
                  unique: fmt(r.value),
                  ips: fmt(Number(r.all || 0)),
                  views: fmt(Number(r.views || 0)),
                })
              }
              empty={t("noDataCollector")}
              onClick={(r) => selectDay(String(r.day))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("hoursOfDay")}</CardTitle>
            <CardDescription>{t("hoursHint", { day: dayLabel(dayKey) })}</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart
              rows={(day?.hourly || []).map((r) => ({
                key: r.hour,
                value: r.visitors,
                label: r.label,
                views: r.pageviews,
              }))}
              labelEvery={3}
              label={(r) => String(r.label)}
              title={(r) =>
                t("chartHour", {
                  label: String(r.label),
                  unique: fmt(r.value),
                  views: fmt(Number(r.views || 0)),
                })
              }
              empty={t("noVisitsDay")}
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <StatsCard
          title={t("topPages")}
          hint={t("onDay", { day: dayLabel(dayKey) })}
          href={listUrl("pages")}
          viewAll={t("viewAll")}
          rows={day?.top_pages || []}
          nameKey="path"
          label={(raw, row) =>
            row.others
              ? t("otherViewAll", { n: row.others_count || 0 })
              : raw === "/"
                ? t("homePath")
                : raw
          }
          isHost={(raw) => raw.charAt(0) === "/"}
        />
        <StatsCard
          title={t("trafficSources")}
          hint={t("onDay", { day: dayLabel(dayKey) })}
          href={listUrl("refs")}
          viewAll={t("viewAll")}
          rows={day?.top_referers || []}
          nameKey="referer"
          label={(raw, row) =>
            row.others
              ? t("otherViewAll", { n: row.others_count || 0 })
              : raw === "Direct"
                ? t("directRef")
                : raw
          }
          isHost={(raw) => Boolean(raw && raw !== "Direct" && raw !== "Other")}
        />
      </section>

      <footer className="space-y-2 pb-6 text-xs leading-relaxed text-muted-foreground">
        <p>{includeBots ? t("footerUniqueBots") : t("footerUnique")}</p>
        <p>
          {t("footerSource", {
            timezone: data.timezone,
            since: dayLabel(data.since || data.today),
          })}
        </p>
      </footer>
    </div>
  );
}

function StatsCard({
  title,
  hint,
  href,
  viewAll,
  rows,
  nameKey,
  label,
  isHost,
}: {
  title: string;
  hint: string;
  href: string;
  viewAll: string;
  rows: Array<{ views: number; others?: boolean; others_count?: number; [key: string]: unknown }>;
  nameKey: string;
  label: (raw: string, row: { others?: boolean; others_count?: number }) => string;
  isHost: (raw: string) => boolean;
}) {
  const { t } = useLocale();
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{hint}</CardDescription>
        </div>
        <Button asChild variant="link" size="sm" className="px-0">
          <Link to={href}>{viewAll}</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {!rows.length ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{t("noVisitsYet")}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">{t("colRank")}</TableHead>
                <TableHead>{t("colName")}</TableHead>
                <TableHead className="w-20 text-end">{t("colViews")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => {
                const raw = String(r[nameKey] ?? "");
                const isOthers = Boolean(r.others) || raw === "Other";
                const text = label(raw, r);
                return (
                  <TableRow key={`${raw}-${i}`}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {isOthers ? "…" : String(i + 1).padStart(2, "0")}
                    </TableCell>
                    <TableCell
                      className={
                        !isOthers && isHost(raw)
                          ? "max-w-0 truncate font-mono text-xs [direction:ltr]"
                          : "max-w-0 truncate"
                      }
                      title={text}
                    >
                      {isOthers ? (
                        <Link className="font-medium text-primary hover:underline" to={href}>
                          {text}
                        </Link>
                      ) : (
                        text
                      )}
                    </TableCell>
                    <TableCell className="text-end font-semibold tabular-nums">
                      {fmt(Number(r.views || 0))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
