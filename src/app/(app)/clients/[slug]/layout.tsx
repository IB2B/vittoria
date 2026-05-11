import type { ReactNode } from "react";

import { requireUser } from "@/lib/auth-helpers";
import { getClientForUser } from "@/lib/clients";

import { ClientSubnav } from "./client-subnav";

export default async function ClientLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const client = await getClientForUser(slug, user);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className="size-3 shrink-0 rounded-full"
            style={{ background: client.brandColor ?? "#8B1538" }}
            aria-hidden
          />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {client.name}
            </h1>
            <p className="text-muted-foreground text-xs">
              {client.adAccounts.length} ad account
              {client.adAccounts.length === 1 ? "" : "s"} ·{" "}
              {client.adAccounts[0]?.currency ?? "EUR"} ·{" "}
              {client.adAccounts[0]?.timezone ?? "Europe/Rome"}
            </p>
          </div>
        </div>
      </header>
      <ClientSubnav slug={slug} isManager={user.role === "MANAGER"} />
      {children}
    </div>
  );
}
