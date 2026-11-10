import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useLocale } from "@/shared/i18n";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const { t } = useLocale();
  if (loading) {
    return (
      <div className="wrap">
        <p className="sub">{t("checkingSession")}</p>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
