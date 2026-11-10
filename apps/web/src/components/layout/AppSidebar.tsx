import { NavLink, useLocation, useSearchParams } from "react-router-dom";
import { Activity, FileText, GalleryVerticalEnd, Globe2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useAuth } from "@/features/auth/AuthContext";
import { useLocale } from "@/shared/i18n";
import { BotFilter } from "@/shared/ui/BotFilter";
import { LangToggle } from "@/shared/ui/LangToggle";

function readBots(params: URLSearchParams) {
  const v = (params.get("bots") || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

type Props = {
  side?: "left" | "right";
};

export function AppSidebar({ side = "left" }: Props) {
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
    <Sidebar collapsible="icon" side={side}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <NavLink to={withQs("/")}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <GalleryVerticalEnd />
                </div>
                <div className="grid flex-1 text-start text-sm leading-tight">
                  <span className="truncate font-medium">Visitly</span>
                  <span className="truncate text-xs">{site}</span>
                </div>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="overflow-x-hidden">
        <SidebarGroup>
          <SidebarGroupLabel>{t("navSection")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton asChild isActive={item.active} tooltip={item.label}>
                    <NavLink to={item.to}>
                      <item.icon />
                      <span>{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>{t("filterAria")}</SidebarGroupLabel>
          <SidebarGroupContent className="flex min-w-0 flex-col gap-2 px-2">
            <BotFilter includeBots={includeBots} onChange={setIncludeBots} />
            <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
              {includeBots ? t("filterHintBots") : t("filterHintHumans")}
            </p>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex min-w-0 items-center gap-2 group-data-[collapsible=icon]:flex-col">
          <LangToggle />
          <Button type="button" variant="outline" size="sm" className="min-w-0 flex-1" onClick={logout}>
            <LogOut />
            <span className="truncate group-data-[collapsible=icon]:hidden">{t("signOut")}</span>
          </Button>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
