const BASE = "/stats";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    cache: "no-store",
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  if (res.status === 401) {
    throw new ApiError(401, "unauthorized");
  }
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body?.error || body?.detail?.error || detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export type PublicConfig = {
  ok: boolean;
  site_name: string;
  timezone: string;
  base_path: string;
  locale: string;
};

export const api = {
  config: () => request<PublicConfig>("/api/config"),
  me: () => request<{ ok: boolean; user: string }>("/api/me"),
  login: (user: string, password: string) =>
    request<{ ok: boolean; redirect?: string }>("/api/login", {
      method: "POST",
      body: JSON.stringify({ user, password }),
    }),
  logoutUrl: () => `${BASE}/api/logout`,
  overview: (day?: string | null) => {
    const q = new URLSearchParams();
    if (day) q.set("day", day);
    q.set("ts", String(Date.now()));
    return request<import("./types").OverviewPayload>(
      `/api/overview?${q.toString()}`,
    );
  },
  top: (kind: string, day?: string | null) => {
    const q = new URLSearchParams({ kind });
    if (day) q.set("day", day);
    q.set("ts", String(Date.now()));
    return request<import("./types").TopListPayload>(`/api/top?${q.toString()}`);
  },
};
