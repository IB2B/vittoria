import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { TopBar } from "@/components/top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireUser } from "@/lib/auth-helpers";
import { getActiveBm, listBusinessManagers } from "@/lib/business-managers";
import { getAllowedPages } from "@/lib/permissions-store";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // requireUser → getSessionUser already pulls fresh-from-DB (name/email/role),
  // so profile edits propagate without needing a second lookup here.
  const user = await requireUser();

  const isManagerOrAdmin =
    user.role === "ADMIN" || user.role === "MANAGER";
  const [bms, activeBm, allowedPages] = await Promise.all([
    isManagerOrAdmin ? listBusinessManagers() : Promise.resolve([]),
    getActiveBm(),
    getAllowedPages(user.role),
  ]);

  return (
    <SidebarProvider>
      <div className="aurora" aria-hidden />
      <AppSidebar
        user={{
          email: user.email,
          name: user.name ?? null,
          role: user.role,
        }}
        bms={bms}
        activeBm={activeBm}
        allowedPages={[...allowedPages]}
      />
      <SidebarInset>
        <TopBar
          user={{
            email: user.email,
            name: user.name ?? null,
            role: user.role,
          }}
        />
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
