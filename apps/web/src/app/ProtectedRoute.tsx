import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useLocale } from "@/shared/i18n";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const { t } = useLocale();
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-sm text-muted-foreground">{t("checkingSession")}</p>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
