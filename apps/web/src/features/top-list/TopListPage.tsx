import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, api } from "@/shared/api/client";
import type { TopListPayload } from "@/shared/api/types";
import { dayLabel, fmt } from "@/shared/dates";
import { useLocale } from "@/shared/i18n";
import { LangToggle } from "@/shared/ui/LangToggle";
import { useAuth } from "@/features/auth/AuthContext";

export function TopListPage() {
  const { config } = useAuth();
  const { t, locale } = useLocale();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const kind = (params.get("kind") || "pages").toLowerCase() === "refs" ? "refs" : "pages";
  const day = params.get("day");
  const [data, setData] = useState<TopListPayload | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const site = config?.site_name || "Visitly";

  const load = useCallback(async () => {
    try {
      const payload = await api.top(kind, day);
      setData(payload);
      setError("");
      if (payload.day && payload.day !== day) {
        setParams({ kind, day: payload.day }, { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate("/login", { replace: true });
        return;
      }
      setError(err instanceof Error ? err.message : "network error");
    }
  }, [day, kind, navigate, setParams]);

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

  return (
    <div className="wrap narrow" key={locale}>
      <header className="top">
        <div>
          <div className="eyebrow">{site.toUpperCase()}</div>
          <h1>{title}</h1>
          <p className="sub">{t("listSub")}</p>
        </div>
        <div className="top-actions">
          <LangToggle />
          <Link className="back" to={day ? `/?day=${encodeURIComponent(day)}` : "/"}>
            {t("backDashboard")}
          </Link>
        </div>
      </header>

      <nav className="nav">
        <div className="tabs">
          <a
            href="#"
            className={kind === "pages" ? "active" : undefined}
            onClick={(e) => {
              e.preventDefault();
              setQ("");
              setParams({ kind: "pages", ...(day ? { day } : {}) });
            }}
          >
            {t("pages")}
          </a>
          <a
            href="#"
            className={kind === "refs" ? "active" : undefined}
            onClick={(e) => {
              e.preventDefault();
              setQ("");
              setParams({ kind: "refs", ...(day ? { day } : {}) });
            }}
          >
            {t("sources")}
          </a>
        </div>
        <div className="nav-day">
          <span className="day-meta">
            {data ? `${dayLabel(data.day)}${data.is_today ? t("todaySuffix") : ""}` : "—"}
          </span>
          <select
            value={data?.day || day || ""}
            onChange={(e) => {
              setQ("");
              setParams({ kind, day: e.target.value });
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

      {error ? <div className="error">{t("listLoadError", { error })}</div> : null}

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
