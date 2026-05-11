"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

const PRESETS: Array<{ value: string; label: string }> = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "custom", label: "Custom" },
];

export function RangePicker({
  preset,
  from,
  to,
}: {
  preset: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);
  // useTransition lets us show pending UI while the server component re-renders.
  // Without it, query-param changes feel "frozen" — Next doesn't fire loading.tsx
  // for same-route param updates, only for path changes.
  const [isPending, startTransition] = useTransition();

  const apply = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams(search?.toString() ?? "");
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "") params.delete(k);
      else params.set(k, v);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={preset}
        disabled={isPending}
        onValueChange={(value) => {
          const v = typeof value === "string" ? value : "30d";
          if (v === "custom") {
            apply({ preset: "custom", from: customFrom, to: customTo });
          } else {
            apply({ preset: v, from: undefined, to: undefined });
          }
        }}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Date range">
            {(value) =>
              PRESETS.find((p) => p.value === value)?.label ?? "Date range"
            }
          </SelectValue>
          {isPending ? (
            <Loader2 className="text-muted-foreground ml-1 size-3.5 shrink-0 animate-spin" />
          ) : null}
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === "custom" ? (
        <Popover>
          <PopoverTrigger
            render={<Button variant="outline" disabled={isPending} />}
          >
            {from} → {to}
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-2">
            <div className="grid gap-1">
              <label className="text-xs">From</label>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <label className="text-xs">To</label>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              className="w-full"
              disabled={isPending}
              onClick={() =>
                apply({ preset: "custom", from: customFrom, to: customTo })
              }
            >
              {isPending ? "Loading…" : "Apply"}
            </Button>
          </PopoverContent>
        </Popover>
      ) : null}

      {isPending ? (
        <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
          <Loader2 className="size-3 animate-spin" />
          Refreshing…
        </span>
      ) : null}
    </div>
  );
}
