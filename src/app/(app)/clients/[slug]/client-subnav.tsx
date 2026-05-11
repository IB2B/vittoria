"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type Tab = { label: string; href: string; managerOnly?: boolean };

const TABS: Tab[] = [
  { label: "Overview", href: "" },
  { label: "Campaigns", href: "/campaigns" },
  { label: "Ad sets", href: "/adsets" },
  { label: "Creatives", href: "/creatives" },
  { label: "Orders", href: "/orders" },
  { label: "Library", href: "/library" },
  { label: "Report", href: "/report" },
  { label: "Settings", href: "/settings", managerOnly: true },
];

export function ClientSubnav({
  slug,
  isManager,
}: {
  slug: string;
  isManager: boolean;
}) {
  const pathname = usePathname();
  const base = `/clients/${slug}`;

  return (
    <nav className="flex gap-1 overflow-x-auto border-b">
      {TABS.filter((t) => !t.managerOnly || isManager).map((tab) => {
        const href = `${base}${tab.href}`;
        const active =
          tab.href === ""
            ? pathname === base
            : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={tab.href}
            href={href}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-brand text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
