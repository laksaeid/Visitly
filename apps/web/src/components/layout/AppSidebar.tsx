import { NavLink, useLocation, useSearchParams } from "react-router-dom";
import { Activity, FileText, Globe2, LogOut, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/features/auth/AuthContext";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n";
import { BotFilter } from "@/shared/ui/BotFilter";
import { LangToggle } from "@/shared/ui/LangToggle";

function readBots(params: URLSearchParams) {
  const v = (params.get("bots") || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

type Props = {
  onNavigate?: () => void;
  className?: string;
};

export function AppSidebar({ onNavigate, className }: Props) {
  const { logout, config } = useAuth();
  const { t } = useLocale();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const includeBots = readBots(params);
  const site = config?.site_name || "Visitly";
  const day = params.get("day");
  const kind = params.get("kind");

  const setIncludeBots = (next: boolean) => {
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next) p.set("bots", "1");
      else p.delete("bots");
      return p;
    });
  };

  const withQs = (path: string, extra?: Record<string, string>) => {
    const q = new URLSearchParams(extra);
    if (day) q.set("day", day);
    if (includeBots) q.set("bots", "1");
    const s = q.toString();
    return s ? `${path}?${s}` : path;
  };

  const items = [
    {
      to: withQs("/"),
      label: t("navOverview"),
      icon: Activity,
      active: location.pathname === "/",
    },
    {
      to: withQs("/list", { kind: "pages" }),
      label: t("navPages"),
      icon: FileText,
      active: location.pathname === "/list" && kind !== "refs",
    },
    {
      to: withQs("/list", { kind: "refs" }),
      label: t("navSources"),
      icon: Globe2,
      active: location.pathname === "/list" && kind === "refs",
    },
  ];

  return (
    <aside className={cn("flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground", className)}>
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <PanelLeft className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tracking-tight">Visitly</div>
          <div className="truncate text-xs text-muted-foreground">{site}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {t("navSection")}
        </div>
        <nav className="space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium transition-colors cursor-pointer",
                item.active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <Separator className="my-4" />

        <div className="space-y-2 px-1">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {t("filterAria")}
          </div>
          <BotFilter includeBots={includeBots} onChange={setIncludeBots} />
          <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
            {includeBots ? t("filterHintBots") : t("filterHintHumans")}
          </p>
        </div>
      </div>

      <div className="space-y-2 border-t p-3">
        <div className="flex items-center gap-2">
          <LangToggle />
          <Button type="button" variant="outline" size="sm" className="flex-1" onClick={logout}>
            <LogOut className="size-4" />
            {t("signOut")}
          </Button>
        </div>
      </div>
    </aside>
  );
}
