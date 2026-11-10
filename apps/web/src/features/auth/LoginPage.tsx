import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ApiError, api } from "@/shared/api/client";
import { useLocale } from "@/shared/i18n";
import { LangToggle } from "@/shared/ui/LangToggle";
import { useAuth } from "./AuthContext";

export function LoginPage() {
  const { user, loading, refresh, config } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const site = config?.site_name || "Visitly";

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api.login(username.trim(), password);
      if (!res.ok) {
        setError(t("invalidCreds"));
        setBusy(false);
        return;
      }
      await refresh();
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError(t("tooManyAttempts"));
      } else if (err instanceof ApiError && err.status === 401) {
        setError(t("invalidCreds"));
      } else {
        setError(t("serverUnreachable"));
      }
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-lang">
        <LangToggle />
      </div>
      <div className="login-box">
        <div className="brand">
          <div className="mark">V</div>
          <h1>{t("signInTitle")}</h1>
          <p className="sub">{t("signInSub", { site })}</p>
        </div>
        <form className="login-card" onSubmit={onSubmit}>
          {error ? <div className="error">{error}</div> : null}
          <div className="field">
            <label htmlFor="user">{t("username")}</label>
            <input
              id="user"
              name="user"
              autoComplete="username"
              required
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">{t("password")}</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="login-submit" type="submit" disabled={busy}>
            {t("signIn")}
          </button>
          <p className="login-hint">{t("loginHint")}</p>
        </form>
      </div>
    </div>
  );
}
