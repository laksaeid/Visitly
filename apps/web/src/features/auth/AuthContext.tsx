import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, api, type PublicConfig } from "@/shared/api/client";

type AuthState = {
  user: string | null;
  loading: boolean;
  config: PublicConfig | null;
  refresh: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const cfg = await api.config();
      setConfig(cfg);
      document.title = `${cfg.site_name} · Visitly`;
    } catch {
      setConfig({
        ok: true,
        site_name: "Visitly",
        timezone: "UTC",
        base_path: "/stats",
        locale: "en",
      });
    }
    try {
      const me = await api.me();
      setUser(me.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(() => {
    window.location.href = api.logoutUrl();
  }, []);

  const value = useMemo(
    () => ({ user, loading, config, refresh, logout }),
    [user, loading, config, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
