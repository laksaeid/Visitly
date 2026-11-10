import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthContext";
import { LoginPage } from "@/features/auth/LoginPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { TopListPage } from "@/features/top-list/TopListPage";
import { ProtectedRoute } from "./ProtectedRoute";

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/list" element={<TopListPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
