"use client";

import { useTransition } from "react";
import { ChevronsUpDown, Check, Building2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setActiveBmAction } from "@/app/(app)/bm-actions";
import { ALL_BMS } from "@/lib/business-managers-shared";

type Bm = { id: string; name: string; clientCount: number };

export function BmSwitcher({
  options,
  active,
}: {
  options: Bm[];
  active: string;
}) {
  const [pending, startTransition] = useTransition();
  const activeOption =
    active === ALL_BMS
      ? null
      : options.find((o) => o.id === active) ?? null;
  const totalClients = options.reduce((acc, o) => acc + o.clientCount, 0);

  const switchTo = (id: string) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("value", id);
      await setActiveBmAction(fd);
    });
  };

  if (options.length === 0) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 rounded-md border border-dashed px-2 py-1.5 text-xs group-data-[collapsible=icon]:hidden">
        <Building2 className="size-3.5" />
        No BM connected yet
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className="hover:bg-sidebar-accent group/trigger flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-card/40 px-2 py-1.5 text-left text-sm transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-1"
      >
        <span
          className="text-brand-foreground flex size-6 shrink-0 items-center justify-center rounded text-[10px] font-semibold"
          style={{
            background:
              "linear-gradient(135deg, var(--brand) 0%, color-mix(in oklab, var(--brand) 60%, white) 100%)",
          }}
        >
          {(activeOption?.name ?? "All").slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
          <div className="truncate text-xs font-medium leading-tight">
            {activeOption?.name ?? "All workspaces"}
          </div>
          <div className="text-muted-foreground truncate text-[10px] leading-tight">
            {(activeOption?.clientCount ?? totalClients)} client
            {(activeOption?.clientCount ?? totalClients) === 1 ? "" : "s"}
          </div>
        </div>
        <ChevronsUpDown className="text-muted-foreground size-3.5 shrink-0 group-data-[collapsible=icon]:hidden" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[--anchor-width] min-w-56">
        <DropdownMenuItem onClick={() => switchTo(ALL_BMS)}>
          <Building2 className="size-4" />
          <span className="flex-1">All workspaces</span>
          <span className="text-muted-foreground text-xs">{totalClients}</span>
          {active === ALL_BMS ? <Check className="ml-1 size-3.5" /> : null}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {options.map((o) => (
          <DropdownMenuItem key={o.id} onClick={() => switchTo(o.id)}>
            <span
              className="text-brand-foreground flex size-5 shrink-0 items-center justify-center rounded text-[9px] font-semibold"
              style={{
                background:
                  "linear-gradient(135deg, var(--brand) 0%, color-mix(in oklab, var(--brand) 60%, white) 100%)",
              }}
            >
              {o.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="flex-1 truncate">{o.name}</span>
            <span className="text-muted-foreground text-xs">
              {o.clientCount}
            </span>
            {active === o.id ? <Check className="ml-1 size-3.5" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
