import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError, api } from "@/shared/api/client";
import type { OverviewPayload } from "@/shared/api/types";
import { dayLabel, fmt, pct, shortDay } from "@/shared/dates";
import { useLocale } from "@/shared/i18n";
import { BarChart } from "@/shared/ui/BarChart";
import { KpiCard } from "@/shared/ui/KpiCard";

function readBotsParam(params: URLSearchParams) {
  const v = (params.get("bots") || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function DashboardPage() {
  const { t, locale } = useLocale();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedDay = params.get("day");
  const includeBots = readBotsParam(params);
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [error, setError] = useState("");

  const patchParams = useCallback(
    (patch: Record<string, string | null>, replace = false) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === "") next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace },
      );
    },
    [setParams],
  );

  const load = useCallback(
    async (day?: string | null, bots = false) => {
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
    },
    [navigate, patchParams],
  );

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
      <div className="flex flex-col gap-4 p-4 md:p-6">
        {error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{t("loadError", { error })}</AlertDescription>
          </Alert>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const totals = data.totals;
  const dt = day?.totals;
  const pvSubKey = includeBots ? "subPageviewsAll" : "subPageviewsIps";

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6" key={locale}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("trafficStats")}</h1>
          <p className="text-sm text-muted-foreground">{t("trafficSub", { timezone: data.timezone })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="h-8 gap-2 font-normal">
            <span className="size-1.5 rounded-full bg-primary" />
            {t("updated", { time: data.generated })}
          </Badge>
          {/* Keep chronological prev/next order in RTL (older ← → newer). */}
          <div className="flex items-center gap-2" dir="ltr">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={dayIndex <= 0}
              onClick={() => dayIndex > 0 && selectDay(days[dayIndex - 1])}
            >
              <ChevronLeft />
              {t("previous")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={dayIndex < 0 || dayIndex >= days.length - 1}
              onClick={() => dayIndex >= 0 && dayIndex < days.length - 1 && selectDay(days[dayIndex + 1])}
            >
              {t("next")}
              <ChevronRight />
            </Button>
          </div>
          <Button type="button" size="sm" onClick={() => selectDay(data.today)}>
            {t("today")}
          </Button>
          <Select value={dayKey} onValueChange={selectDay}>
            <SelectTrigger className="h-8 w-[200px]">
              <SelectValue placeholder={t("day")} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {[...days].reverse().map((d) => (
                  <SelectItem key={d} value={d}>
                    {dayLabel(d)}
                    {d === data.today ? t("todayOption") : ""}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{t("loadErrorRetry", { error })}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6" aria-label={t("summary")}>
        <KpiCard
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
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("selectedDayKpis")}>
          <KpiCard
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

      <section className="grid gap-4 xl:grid-cols-7">
        <Card className="shadow-none xl:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("dailyUniques")}</CardTitle>
            <CardDescription>
              {dailyRows.length >= 30 ? t("last30Days") : t("nDays", { n: dailyRows.length })}
              {t("peak")}
              {fmt(Math.max(...dailyRows.map((r) => r.value), 1))}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart
              rows={dailyRows}
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

        <Card className="shadow-none xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("hoursOfDay")}</CardTitle>
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

      <section className="grid gap-4 xl:grid-cols-2">
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

      <p className="pb-2 text-xs text-muted-foreground leading-relaxed">
        {includeBots ? t("footerUniqueBots") : t("footerUnique")}{" "}
        {t("footerSource", {
          timezone: data.timezone,
          since: dayLabel(data.since || data.today),
        })}
      </p>
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
    <Card className="shadow-none">
      <CardHeader className="flex-row items-center justify-between pb-2">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{hint}</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to={href}>{viewAll}</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {!rows.length ? (
          <Empty className="border-0 py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchX />
              </EmptyMedia>
              <EmptyTitle className="text-sm font-medium">{t("noVisitsYet")}</EmptyTitle>
            </EmptyHeader>
          </Empty>
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
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
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
                        <Link className="font-medium hover:underline" to={href}>
                          {text}
                        </Link>
                      ) : (
                        text
                      )}
                    </TableCell>
                    <TableCell className="text-end tabular-nums font-medium">
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
