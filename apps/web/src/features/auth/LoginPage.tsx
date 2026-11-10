import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ApiError, api } from "@/shared/api/client";
import { useAuth } from "./AuthContext";

export function LoginPage() {
  const { user, loading, refresh, config } = useAuth();
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
        setError("Invalid username or password.");
        setBusy(false);
        return;
      }
      await refresh();
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError("Too many attempts. Try again in a few minutes.");
      } else if (err instanceof ApiError && err.status === 401) {
        setError("Invalid username or password.");
      } else {
        setError("Could not reach the server.");
      }
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-box">
        <div className="brand">
          <div className="mark">V</div>
          <h1>Visitly</h1>
          <p className="sub">Sign in to {site} analytics</p>
        </div>
        <form className="login-card" onSubmit={onSubmit}>
          {error ? <div className="error">{error}</div> : null}
          <div className="field">
            <label htmlFor="user">Username</label>
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
            <label htmlFor="password">Password</label>
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
            Sign in
          </button>
          <p className="login-hint">
            Stats days use your configured timezone, from 00:00 to 24:00.
          </p>
        </form>
      </div>
    </div>
  );
}
