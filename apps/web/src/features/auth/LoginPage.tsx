import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="relative flex min-h-screen items-center justify-center px-4 py-8">
      <div className="absolute top-4 end-4">
        <LangToggle />
      </div>
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary font-mono text-lg font-bold text-primary-foreground shadow-md">
            V
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold tracking-tight">{t("signInTitle")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("signInSub", { site })}</p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("signIn")}</CardTitle>
            <CardDescription>{t("loginHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              {error ? (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="user">{t("username")}</Label>
                <Input
                  id="user"
                  name="user"
                  autoComplete="username"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("password")}</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button className="w-full" variant="accent" type="submit" disabled={busy} aria-busy={busy}>
                {t("signIn")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
