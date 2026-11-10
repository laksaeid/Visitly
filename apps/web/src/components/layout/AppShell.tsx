import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "@/components/layout/AppSidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useLocale } from "@/shared/i18n";

export function AppShell() {
  const { t, locale } = useLocale();
  const location = useLocation();
  const title =
    location.pathname === "/list"
      ? new URLSearchParams(location.search).get("kind") === "refs"
        ? t("navSources")
        : t("navPages")
      : t("navOverview");

  return (
    <SidebarProvider>
      <AppSidebar side={locale === "fa" ? "right" : "left"} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ms-1" />
          <Separator orientation="vertical" className="me-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
