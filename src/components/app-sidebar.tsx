"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Building2,
  Clapperboard,
  FileText,
  Globe,
  LayoutDashboard,
  Music2,
  Plug,
  Settings,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";

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
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { BmSwitcher } from "@/components/bm-switcher";
import type { BmOption } from "@/lib/business-managers";

type NavItem = {
  label: string;
  href?: string;
  icon: typeof LayoutDashboard;
  managerOnly?: boolean;
  adminOnly?: boolean;
  comingSoon?: boolean;
  disabled?: boolean;
  pageKey?: string; // when set, item is only shown if allowedPages includes it
};

const WORKSPACE: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    pageKey: "dashboard",
  },
  { label: "Reports", href: "/reports", icon: FileText, pageKey: "reports" },
];

const META_ITEMS: NavItem[] = [
  {
    label: "Clients",
    href: "/clients",
    icon: Building2,
    managerOnly: true,
    pageKey: "clients",
  },
  {
    label: "Business Managers",
    href: "/business-managers",
    icon: Workflow,
    managerOnly: true,
    pageKey: "business_managers",
  },
  {
    label: "Connect account",
    href: "/clients/import?tab=meta",
    icon: Plug,
    managerOnly: true,
    pageKey: "import",
  },
];

const GOOGLE_ITEMS: NavItem[] = [
  { label: "Clients", icon: Building2, comingSoon: true, disabled: true },
  { label: "Managers", icon: Workflow, comingSoon: true, disabled: true },
  { label: "Connect account", icon: Plug, comingSoon: true, disabled: true },
];

const TIKTOK_ITEMS: NavItem[] = [
  { label: "Clients", icon: Building2, comingSoon: true, disabled: true },
  {
    label: "Business Managers",
    icon: Workflow,
    comingSoon: true,
    disabled: true,
  },
  { label: "Connect account", icon: Plug, comingSoon: true, disabled: true },
];

const TOOLS: NavItem[] = [
  {
    label: "Monitoring",
    href: "/monitoring",
    icon: Activity,
    managerOnly: true,
    pageKey: "monitoring",
  },
  {
    label: "Creative Lab",
    href: "/creative-lab",
    icon: Sparkles,
    comingSoon: true,
    pageKey: "creative_lab",
  },
  {
    label: "Business Intelligence",
    href: "/business-intelligence",
    icon: BarChart3,
    pageKey: "business_intelligence",
  },
  {
    label: "Reels Lab",
    href: "/reels-lab",
    icon: Clapperboard,
    comingSoon: true,
    pageKey: "reels_lab",
  },
];

const SETTINGS_NAV: NavItem[] = [
  { label: "Profile", href: "/settings/profile", icon: Settings },
  { label: "Team", href: "/settings/team", icon: Users, adminOnly: true },
];

export function AppSidebar({
  user,
  bms,
  activeBm,
  allowedPages,
}: {
  user: {
    email: string;
    name: string | null;
    role: "ADMIN" | "MANAGER" | "VIEWER" | "CLIENT";
  };
  bms: BmOption[];
  activeBm: string;
  allowedPages: string[];
}) {
  const pathname = usePathname();
  const isAdmin = user.role === "ADMIN";
  const isManagerOrAdmin = user.role === "ADMIN" || user.role === "MANAGER";
  const allowedSet = new Set(allowedPages);
  // Visibility: adminOnly trumps; managerOnly requires manager+admin role;
  // pageKey requires the key in DB-backed allowedPages (admin always passes
  // because permissions-store grants admin all keys).
  const visible = (item: NavItem) => {
    if (item.adminOnly) return isAdmin;
    if (item.managerOnly && !isManagerOrAdmin) return false;
    if (item.pageKey && !allowedSet.has(item.pageKey)) return false;
    return true;
  };

  const renderTopLevel = (items: NavItem[]) =>
    items.filter(visible).map((item) => {
      const active =
        item.href != null &&
        (pathname === item.href || pathname.startsWith(item.href + "/"));
      return (
        <SidebarMenuItem key={item.label + item.href}>
          {item.disabled ? (
            <SidebarMenuButton
              className="text-muted-foreground cursor-not-allowed"
              onClick={() =>
                toast(`${item.label} — coming soon`, {
                  description: "We'll surface this once the integration ships.",
                })
              }
            >
              <item.icon />
              <span className="flex-1">{item.label}</span>
              {item.comingSoon ? (
                <Badge
                  variant="ghost"
                  className="bg-muted/60 ml-auto text-[9px] uppercase tracking-wide group-data-[collapsible=icon]:hidden"
                >
                  Soon
                </Badge>
              ) : null}
            </SidebarMenuButton>
          ) : (
            <SidebarMenuButton
              render={<Link href={item.href!} />}
              isActive={active}
              className={
                active
                  ? "data-active:bg-[color-mix(in_oklab,var(--brand)_15%,transparent)] data-active:text-foreground data-active:shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--brand)_40%,transparent),0_4px_12px_-4px_color-mix(in_oklab,var(--brand)_40%,transparent)]"
                  : undefined
              }
            >
              <item.icon
                className={active ? "text-[var(--brand)]" : undefined}
              />
              <span className="flex-1">{item.label}</span>
              {item.comingSoon ? (
                <Badge
                  variant="ghost"
                  className="bg-muted/60 ml-auto text-[9px] uppercase tracking-wide group-data-[collapsible=icon]:hidden"
                >
                  Soon
                </Badge>
              ) : null}
            </SidebarMenuButton>
          )}
        </SidebarMenuItem>
      );
    });

  // Render a platform group header + its sub-items (Clients / BMs / Connect).
  const renderPlatformGroup = (
    label: string,
    accent: string,
    items: NavItem[],
    allComingSoon = false,
  ) => {
    const visibleItems = items.filter(visible);
    if (visibleItems.length === 0) return null;
    return (
      <SidebarGroup>
        <SidebarGroupLabel className="flex items-center gap-1.5">
          <span
            className="size-1.5 rounded-full"
            style={{ background: accent }}
            aria-hidden
          />
          {label}
          {allComingSoon ? (
            <Badge
              variant="ghost"
              className="bg-muted/60 ml-auto text-[9px] uppercase tracking-wide group-data-[collapsible=icon]:hidden"
            >
              Soon
            </Badge>
          ) : null}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {visibleItems.map((item) => {
              const active =
                item.href != null &&
                (pathname === item.href.split("?")[0] ||
                  pathname.startsWith(item.href.split("?")[0] + "/"));
              return (
                <SidebarMenuSubItem key={item.label}>
                  {item.disabled ? (
                    <SidebarMenuSubButton
                      onClick={() =>
                        toast(`${label} ${item.label} — coming soon`, {
                          description:
                            "We'll surface this once the integration ships.",
                        })
                      }
                      className="text-muted-foreground cursor-not-allowed"
                    >
                      <item.icon />
                      <span className="flex-1">{item.label}</span>
                    </SidebarMenuSubButton>
                  ) : (
                    <SidebarMenuSubButton
                      render={<Link href={item.href!} />}
                      isActive={active}
                    >
                      <item.icon />
                      <span className="flex-1">{item.label}</span>
                    </SidebarMenuSubButton>
                  )}
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon" className="glass">
      <SidebarHeader className="gap-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <div
            className="text-brand-foreground flex size-8 shrink-0 items-center justify-center rounded-md font-semibold tracking-tight shadow-md"
            style={{
              background:
                "linear-gradient(135deg, var(--brand) 0%, color-mix(in oklab, var(--brand) 60%, white) 100%)",
              boxShadow:
                "0 4px 12px -2px color-mix(in oklab, var(--brand) 50%, transparent)",
            }}
          >
            V
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-sm font-semibold">Vittoria</div>
            <div className="text-muted-foreground truncate text-xs">
              Multi-channel ads
            </div>
          </div>
        </Link>
        {isManagerOrAdmin ? (
          <div className="px-2 group-data-[collapsible=icon]:hidden">
            <BmSwitcher options={bms} active={activeBm} />
          </div>
        ) : null}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderTopLevel(WORKSPACE)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {renderPlatformGroup("Meta Ads", "var(--meta)", META_ITEMS)}
        {renderPlatformGroup(
          "Google Ads",
          "var(--google)",
          GOOGLE_ITEMS,
          true,
        )}
        {renderPlatformGroup("TikTok Ads", "#FF0050", TIKTOK_ITEMS, true)}

        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderTopLevel(TOOLS)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderTopLevel(SETTINGS_NAV)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <p className="text-muted-foreground px-2 text-[10px] group-data-[collapsible=icon]:hidden">
          Vittoria v0.1
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
