import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, api } from "@/shared/api/client";
import type { OverviewPayload } from "@/shared/api/types";
import { dayLabel, fmt, pct, shortDay } from "@/shared/dates";
import { useLocale } from "@/shared/i18n";
import { BarChart } from "@/shared/ui/BarChart";
import { BotFilter } from "@/shared/ui/BotFilter";
import { KpiCard } from "@/shared/ui/KpiCard";
import { LangToggle } from "@/shared/ui/LangToggle";
import { useAuth } from "@/features/auth/AuthContext";

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
      if (next && next !== day) {
        patchParams({ day: next }, true);
      }
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
    patchParams({
      day: dayValue,
      bots: includeBots ? "1" : null,
    });
  };

  const setIncludeBots = (next: boolean) => {
    patchParams({
      day: dayKey || null,
      bots: next ? "1" : null,
    });
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
      <div className="wrap">
        {error ? <div className="error" role="alert">{t("loadError", { error })}</div> : null}
        <p className="sub">{t("loading")}</p>
      </div>
    );
  }

  const totals = data.totals;
  const dt = day?.totals;
  const pvSubKey = includeBots ? "subPageviewsAll" : "subPageviewsIps";

  return (
    <div className="wrap" key={locale}>
      <header className="top">
        <div>
          <div className="eyebrow">{site}</div>
          <h1>{t("trafficStats")}</h1>
          <p className="sub">{t("trafficSub", { timezone: data.timezone })}</p>
        </div>
        <div className="top-actions">
          <div className="live" aria-live="polite">
            <span className="dot" aria-hidden="true" />
            <span>{t("updated", { time: data.generated })}</span>
          </div>
          <LangToggle />
          <button type="button" className="btn ghost" onClick={logout}>
            {t("signOut")}
          </button>
        </div>
      </header>

      <section className="toolbar" aria-label={t("filterAria")}>
        <BotFilter includeBots={includeBots} onChange={setIncludeBots} />
        <p className="filter-hint">
          {includeBots ? t("filterHintBots") : t("filterHintHumans")}
        </p>
      </section>

      <nav className="nav" aria-label={t("day")}>
        <div className="nav-day">
          <button type="button" className="btn soft" disabled={dayIndex <= 0} onClick={() => dayIndex > 0 && selectDay(days[dayIndex - 1])}>
            {t("previous")}
          </button>
          <button
            type="button"
            className="btn soft"
            disabled={dayIndex < 0 || dayIndex >= days.length - 1}
            onClick={() => dayIndex >= 0 && dayIndex < days.length - 1 && selectDay(days[dayIndex + 1])}
          >
            {t("next")}
          </button>
          <button type="button" className="btn accent" onClick={() => selectDay(data.today)}>
            {t("today")}
          </button>
        </div>
        <div className="day-title">
          {dayLabel(dayKey)}
          {dayKey === data.today ? t("todaySuffix") : ""}
        </div>
        <div className="nav-day">
          <label className="day-meta" htmlFor="day-select">{t("day")}</label>
          <select id="day-select" value={dayKey} onChange={(e) => selectDay(e.target.value)}>
            {[...days].reverse().map((d) => (
              <option key={d} value={d}>
                {dayLabel(d)}
                {d === data.today ? t("todayOption") : ""} — {d}
              </option>
            ))}
          </select>
        </div>
      </nav>

      {error ? <div className="error" role="alert">{t("loadErrorRetry", { error })}</div> : null}

      <section className="kpis" aria-label={t("summary")}>
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
        <section className="kpis" aria-label={t("selectedDay")}>
          <KpiCard
            primary
            label={t("uniqueVisitors", {
              day: day?.is_today ? t("kpiToday") : dayLabel(dayKey),
            })}
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

      <section className="grid">
        <article className="card">
          <div className="card-head">
            <h2>{t("dailyUniques")}</h2>
            <span className="hint">
              {dailyRows.length >= 30 ? t("last30Days") : t("nDays", { n: dailyRows.length })}
              {t("peak")}
              {fmt(Math.max(...dailyRows.map((r) => r.value), 1))}
            </span>
          </div>
          <BarChart
            className="chart-daily"
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
        </article>
        <article className="card">
          <div className="card-head">
            <h2>{t("hoursOfDay")}</h2>
            <span className="hint">{t("hoursHint", { day: dayLabel(dayKey) })}</span>
          </div>
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
        </article>
      </section>

      <section className="grid">
        <article className="card">
          <div className="card-head">
            <h2>{t("topPages")}</h2>
            <Link className="more-link" to={listUrl("pages")}>{t("viewAll")}</Link>
          </div>
          <div className="hint" style={{ margin: "-2px 0 12px" }}>
            {t("onDay", { day: dayLabel(dayKey) })}
          </div>
          <StatsTable
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
            othersHref={listUrl("pages")}
          />
        </article>
        <article className="card">
          <div className="card-head">
            <h2>{t("trafficSources")}</h2>
            <Link className="more-link" to={listUrl("refs")}>{t("viewAll")}</Link>
          </div>
          <div className="hint" style={{ margin: "-2px 0 12px" }}>
            {t("onDay", { day: dayLabel(dayKey) })}
          </div>
          <StatsTable
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
            othersHref={listUrl("refs")}
          />
        </article>
      </section>

      <footer>
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

function StatsTable({
  rows,
  nameKey,
  label,
  isHost,
  othersHref,
}: {
  rows: Array<{ views: number; others?: boolean; others_count?: number; [key: string]: unknown }>;
  nameKey: string;
  label: (raw: string, row: { others?: boolean; others_count?: number }) => string;
  isHost: (raw: string) => boolean;
  othersHref: string;
}) {
  const { t } = useLocale();
  if (!rows.length) {
    return <div className="nothing">{t("noVisitsYet")}</div>;
  }
  return (
    <table>
      <thead>
        <tr>
          <th>{t("colRank")}</th>
          <th>{t("colName")}</th>
          <th className="num">{t("colViews")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const raw = String(r[nameKey] ?? "");
          const isOthers = Boolean(r.others) || raw === "Other";
          const text = label(raw, r);
          return (
            <tr key={`${raw}-${i}`} className={isOthers ? "is-others" : undefined}>
              <td className="rank">{isOthers ? "…" : String(i + 1).padStart(2, "0")}</td>
              <td className={`name${!isOthers && isHost(raw) ? " is-host" : ""}`}>
                {isOthers ? (
                  <Link className="more-link" to={othersHref}>{text}</Link>
                ) : (
                  text
                )}
              </td>
              <td className="num">{fmt(Number(r.views || 0))}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
