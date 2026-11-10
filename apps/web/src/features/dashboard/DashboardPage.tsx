import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, api } from "@/shared/api/client";
import type { OverviewPayload } from "@/shared/api/types";
import { dayLabel, fmt, pct, shortDay } from "@/shared/dates";
import { BarChart } from "@/shared/ui/BarChart";
import { KpiCard } from "@/shared/ui/KpiCard";
import { useAuth } from "@/features/auth/AuthContext";

export function DashboardPage() {
  const { logout, config } = useAuth();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedDay = params.get("day");
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [error, setError] = useState("");
  const site = config?.site_name || "Visitly";

  const load = useCallback(async (day?: string | null) => {
    try {
      const payload = await api.overview(day);
      setData(payload);
      setError("");
      const next = payload.selected_day;
      if (next && next !== day) {
        setParams((prev) => {
          const p = new URLSearchParams(prev);
          p.set("day", next);
          return p;
        }, { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate("/login", { replace: true });
        return;
      }
      setError(err instanceof Error ? err.message : "network error");
    }
  }, [navigate, setParams]);

  useEffect(() => {
    void load(selectedDay);
    const timer = window.setInterval(() => void load(selectedDay), 60000);
    return () => window.clearInterval(timer);
  }, [load, selectedDay]);

  const day = data?.day;
  const dayKey = selectedDay || data?.selected_day || data?.today || "";
  const days = data?.available_days || [];
  const dayIndex = days.indexOf(dayKey);

  const selectDay = (dayValue: string) => {
    setParams({ day: dayValue });
  };

  const listUrl = (kind: string) =>
    `/list?kind=${encodeURIComponent(kind)}${dayKey ? `&day=${encodeURIComponent(dayKey)}` : ""}`;

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
        {error ? <div className="error">Could not load stats ({error}).</div> : null}
        <p className="sub">Loading…</p>
      </div>
    );
  }

  const t = data.totals;
  const dt = day?.totals;

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <div className="eyebrow">{site.toUpperCase()}</div>
          <h1>Traffic stats</h1>
          <p className="sub">
            Unique visitors from nginx access logs · {data.timezone} (00:00–24:00)
          </p>
        </div>
        <div className="top-actions">
          <div className="live">
            <span className="dot" />
            <span>Updated {data.generated} · every 60s</span>
          </div>
          <button type="button" className="logout" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="nav" aria-label="Day picker">
        <div className="nav-day">
          <button type="button" disabled={dayIndex <= 0} onClick={() => dayIndex > 0 && selectDay(days[dayIndex - 1])}>
            Previous
          </button>
          <button
            type="button"
            disabled={dayIndex < 0 || dayIndex >= days.length - 1}
            onClick={() => dayIndex >= 0 && dayIndex < days.length - 1 && selectDay(days[dayIndex + 1])}
          >
            Next
          </button>
          <button type="button" className="today-btn" onClick={() => selectDay(data.today)}>
            Today
          </button>
        </div>
        <div className="day-title">
          {dayLabel(dayKey)}
          {dayKey === data.today ? " · Today" : ""}
        </div>
        <div className="nav-day">
          <label className="day-meta" htmlFor="day-select">Day</label>
          <select id="day-select" value={dayKey} onChange={(e) => selectDay(e.target.value)}>
            {[...days].reverse().map((d) => (
              <option key={d} value={d}>
                {dayLabel(d)}
                {d === data.today ? " (today)" : ""} — {d}
              </option>
            ))}
          </select>
        </div>
      </nav>

      {error ? (
        <div className="error">
          Could not load stats ({error}). Retrying in up to 60 seconds…
        </div>
      ) : null}

      <section className="kpis" aria-label="Summary">
        <KpiCard
          primary
          label="Today"
          value={fmt(t.today.visitors)}
          sub={`${fmt(t.today.pageviews)} pageviews · ${fmt(t.today.visitors_all)} IPs with bots`}
        />
        <KpiCard label="Yesterday" value={fmt(t.yesterday.visitors)} sub={`${fmt(t.yesterday.pageviews)} pageviews`} />
        <KpiCard
          label="Last 7 days"
          value={fmt(t.last7.visitors)}
          sub={`${fmt(Math.round(t.last7.visitors / 7))} daily average`}
        />
        <KpiCard label="Last 30 days" value={fmt(t.last30.visitors)} sub={`${fmt(t.last30.pageviews)} pageviews`} />
        <KpiCard label="All time" value={fmt(t.all.visitors)} sub={`Since ${dayLabel(data.since || data.today)}`} />
        <KpiCard
          label="Returning today"
          value={fmt(t.returning_today)}
          sub={`${pct(t.returning_today, t.today.visitors)}% of today's visitors`}
        />
      </section>

      {dt ? (
        <section className="kpis" aria-label="Selected day">
          <KpiCard
            primary
            label={`${day?.is_today ? "Today" : dayLabel(dayKey)} · unique visitors`}
            value={fmt(dt.visitors)}
            sub="Local day window 00:00–24:00"
          />
          <KpiCard label="Pageviews" value={fmt(dt.pageviews)} sub={`${fmt(dt.visitors_all)} IPs including bots`} />
          <KpiCard label="Bot pageviews" value={fmt(dt.bot_pageviews || 0)} sub={`${fmt(dt.requests || 0)} total requests`} />
          <KpiCard
            label="Returning"
            value={fmt(dt.returning || 0)}
            sub={`${pct(dt.returning || 0, dt.visitors)}% of this day's visitors`}
          />
        </section>
      ) : null}

      <section className="grid">
        <article className="card">
          <div className="card-head">
            <h2>Daily unique visitors</h2>
            <span className="hint">
              {dailyRows.length >= 30 ? "Last 30 days" : `${dailyRows.length} days`}
              {" · peak "}
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
              `${dayLabel(String(r.day))} — ${fmt(r.value)} unique, ${fmt(Number(r.all || 0))} IPs with bots, ${fmt(Number(r.views || 0))} pageviews`
            }
            empty="No data yet — the collector runs every couple of minutes."
            onClick={(r) => selectDay(String(r.day))}
          />
        </article>
        <article className="card">
          <div className="card-head">
            <h2>Hours of day</h2>
            <span className="hint">{dayLabel(dayKey)} · 00–24</span>
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
              `${String(r.label)} — ${fmt(r.value)} unique, ${fmt(Number(r.views || 0))} pageviews`
            }
            empty="No visits recorded for this day."
          />
        </article>
      </section>

      <section className="grid">
        <article className="card">
          <div className="card-head">
            <h2>Top pages</h2>
            <Link className="more-link" to={listUrl("pages")}>View all</Link>
          </div>
          <div className="hint" style={{ margin: "-6px 0 12px" }}>
            On {dayLabel(dayKey)}
          </div>
          <StatsTable
            rows={day?.top_pages || []}
            nameKey="path"
            label={(raw, row) =>
              row.others
                ? `Other (${row.others_count || 0}) — view all`
                : raw === "/"
                  ? "/ (home)"
                  : raw
            }
            isHost={(raw) => raw.charAt(0) === "/"}
            othersHref={listUrl("pages")}
          />
        </article>
        <article className="card">
          <div className="card-head">
            <h2>Traffic sources</h2>
            <Link className="more-link" to={listUrl("refs")}>View all</Link>
          </div>
          <div className="hint" style={{ margin: "-6px 0 12px" }}>
            On {dayLabel(dayKey)}
          </div>
          <StatsTable
            rows={day?.top_referers || []}
            nameKey="referer"
            label={(raw, row) =>
              row.others
                ? `Other (${row.others_count || 0}) — view all`
                : raw === "Direct"
                  ? "Direct / no referrer"
                  : raw
            }
            isHost={(raw) => Boolean(raw && raw !== "Direct" && raw !== "Other")}
            othersHref={listUrl("refs")}
          />
        </article>
      </section>

      <footer>
        <p>
          A unique visitor is a distinct privacy-hashed IP with at least one non-bot pageview.
          Bots are filtered by User-Agent. NAT and dynamic IPs make numbers directional.
        </p>
        <p>
          Source: nginx access logs · timezone {data.timezone} · day window 00:00–24:00 · tracking since{" "}
          {dayLabel(data.since || data.today)}
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
  if (!rows.length) {
    return <div className="nothing">No visits yet.</div>;
  }
  return (
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Name</th>
          <th className="num">Views</th>
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
