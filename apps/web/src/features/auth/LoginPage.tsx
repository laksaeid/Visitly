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
    <div className="relative flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="absolute top-4 end-4">
        <LangToggle />
      </div>
      <Card className="w-full max-w-sm shadow-none">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            V
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl">{t("signInTitle")}</CardTitle>
            <CardDescription>{t("signInSub", { site })}</CardDescription>
          </div>
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
            <Button className="w-full" type="submit" disabled={busy} aria-busy={busy}>
              {t("signIn")}
            </Button>
            <p className="text-center text-xs text-muted-foreground">{t("loginHint")}</p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
