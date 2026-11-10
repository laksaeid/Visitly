import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, api } from "@/shared/api/client";
import type { TopListPayload } from "@/shared/api/types";
import { dayLabel, fmt } from "@/shared/dates";
import { useLocale } from "@/shared/i18n";
import { BotFilter } from "@/shared/ui/BotFilter";
import { LangToggle } from "@/shared/ui/LangToggle";
import { useAuth } from "@/features/auth/AuthContext";

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
    <div className="wrap narrow" key={locale}>
      <header className="top">
        <div>
          <div className="eyebrow">{site}</div>
          <h1>{title}</h1>
          <p className="sub">{t("listSub")}</p>
        </div>
        <div className="top-actions">
          <LangToggle />
          <Link className="btn ghost" to={backTo}>
            {t("backDashboard")}
          </Link>
        </div>
      </header>

      <section className="toolbar" aria-label={t("filterAria")}>
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
        <p className="filter-hint">
          {includeBots ? t("filterHintBots") : t("filterHintHumans")}
        </p>
      </section>

      <nav className="nav">
        <div className="tabs">
          <button
            type="button"
            className={kind === "pages" ? "active" : undefined}
            onClick={() => {
              setQ("");
              patchParams({
                kind: "pages",
                day: day || null,
                bots: includeBots ? "1" : null,
              });
            }}
          >
            {t("pages")}
          </button>
          <button
            type="button"
            className={kind === "refs" ? "active" : undefined}
            onClick={() => {
              setQ("");
              patchParams({
                kind: "refs",
                day: day || null,
                bots: includeBots ? "1" : null,
              });
            }}
          >
            {t("sources")}
          </button>
        </div>
        <div className="nav-day">
          <span className="day-meta">
            {data ? `${dayLabel(data.day)}${data.is_today ? t("todaySuffix") : ""}` : "—"}
          </span>
          <select
            value={data?.day || day || ""}
            onChange={(e) => {
              setQ("");
              patchParams({
                kind,
                day: e.target.value,
                bots: includeBots ? "1" : null,
              });
            }}
          >
            {[...(data?.available_days || [])].reverse().map((d) => (
              <option key={d} value={d}>
                {dayLabel(d)} — {d}
              </option>
            ))}
          </select>
        </div>
      </nav>

      {error ? <div className="error" role="alert">{t("listLoadError", { error })}</div> : null}

      <section className="card">
        <div className="search">
          <input
            type="search"
            placeholder={t("searchPlaceholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
          />
        </div>
        <p className="day-meta" style={{ margin: "0 0 8px" }}>
          {data
            ? filtered.length === (data.rows || []).length
              ? t("rowsViews", { rows: data.rows.length, views: fmt(data.total_views) })
              : t("rowsOf", { filtered: filtered.length, total: data.rows.length })
            : "—"}
        </p>
        <table>
          <thead>
            <tr>
              <th>{t("colRank")}</th>
              <th>{kind === "pages" ? t("colPage") : t("colSource")}</th>
              <th className="num">{t("colViews")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const raw = String(r[data!.name_key] || "");
              const label = labelRow(kind, raw, t);
              const total = data?.total_views || 1;
              return (
                <tr key={`${raw}-${i}`}>
                  <td className="rank">{String(i + 1).padStart(2, "0")}</td>
                  <td className={`name${isHost(kind, raw) ? " is-host" : ""}`} title={label}>
                    {label}
                  </td>
                  <td className="num">
                    <span className="share">
                      <i style={{ width: `${Math.max(2, (r.views / total) * 100)}%` }} />
                    </span>
                    {fmt(r.views)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length ? <div className="nothing">{t("noMatches")}</div> : null}
      </section>
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
