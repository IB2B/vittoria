"use client";

import { useMemo, useState } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, ShoppingCart, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRoas,
} from "@/lib/format";
import type { CampaignObjectiveKind } from "@/lib/meta";

export type CampaignRow = {
  campaignId: string;
  campaignName: string;
  effectiveStatus?: string;
  objectiveKind?: CampaignObjectiveKind;
  spend: number;
  impressions: number;
  linkClicks: number;
  ctrLink: number | null;
  cpcLink: number | null;
  leads: number;
  costPerLead: number | null;
  purchasesPixel: number;
  revenuePixel: number;
  cpaPixel: number | null;
  roasPixel: number | null;
};

// Per-row decision: what's the headline conversion event for this campaign?
// Lead-gen objectives → leads; sales objectives → purchases; "other" gets
// whichever metric actually has volume (so engagement campaigns that happen
// to drive purchases still show that data).
function pickConversionMode(row: CampaignRow): "leads" | "sales" {
  if (row.objectiveKind === "leads") return "leads";
  if (row.objectiveKind === "sales") return "sales";
  if (row.leads > 0 && row.purchasesPixel === 0) return "leads";
  return "sales";
}

export function CampaignsTable({
  rows,
  currency,
}: {
  rows: CampaignRow[];
  currency: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "spend", desc: true },
  ]);

  const columns = useMemo<ColumnDef<CampaignRow>[]>(() => {
    const numericHeader = (label: string) =>
      ({ column }: { column: { toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-mr-2 ml-auto flex"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {label} <ArrowUpDown className="size-3" />
        </Button>
      );

    return [
      {
        accessorKey: "campaignName",
        header: "Campaign",
        cell: ({ row }) => {
          const mode = pickConversionMode(row.original);
          return (
            <div className="flex min-w-0 items-center gap-2">
              {mode === "leads" ? (
                <UserPlus className="text-meta size-3.5 shrink-0" />
              ) : (
                <ShoppingCart className="text-meta size-3.5 shrink-0" />
              )}
              <span className="line-clamp-1" title={row.original.campaignName}>
                {row.original.campaignName}
              </span>
              {row.original.effectiveStatus &&
              row.original.effectiveStatus !== "ACTIVE" ? (
                <Badge
                  variant="ghost"
                  className="shrink-0 text-[10px]"
                >
                  {row.original.effectiveStatus.toLowerCase().replace(/_/g, " ")}
                </Badge>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "spend",
        header: numericHeader("Spend"),
        cell: ({ row }) => (
          <span className="text-right font-mono tabular-nums block">
            {formatCurrency(row.original.spend, currency)}
          </span>
        ),
      },
      {
        accessorKey: "impressions",
        header: numericHeader("Impressions"),
        cell: ({ row }) => (
          <span className="text-right font-mono tabular-nums block">
            {formatNumber(row.original.impressions)}
          </span>
        ),
      },
      {
        accessorKey: "linkClicks",
        header: numericHeader("Link clicks"),
        cell: ({ row }) => (
          <span className="text-right font-mono tabular-nums block">
            {formatNumber(row.original.linkClicks)}
          </span>
        ),
      },
      {
        accessorKey: "ctrLink",
        header: numericHeader("CTR"),
        cell: ({ row }) => (
          <span className="text-right font-mono tabular-nums block">
            {formatPercent(row.original.ctrLink, 2)}
          </span>
        ),
      },
      {
        id: "conversions",
        accessorFn: (row) =>
          pickConversionMode(row) === "leads" ? row.leads : row.purchasesPixel,
        header: numericHeader("Conversions"),
        cell: ({ row }) => {
          const mode = pickConversionMode(row.original);
          const count =
            mode === "leads"
              ? row.original.leads
              : row.original.purchasesPixel;
          return (
            <div className="flex flex-col items-end">
              <span className="font-mono tabular-nums">
                {formatNumber(count)}
              </span>
              <span className="text-muted-foreground text-[10px]">
                {mode === "leads" ? "leads" : "purchases"}
              </span>
            </div>
          );
        },
      },
      {
        id: "perf",
        accessorFn: (row) =>
          pickConversionMode(row) === "leads"
            ? -(row.costPerLead ?? Infinity)
            : (row.roasPixel ?? -1),
        header: numericHeader("Performance"),
        cell: ({ row }) => {
          const mode = pickConversionMode(row.original);
          if (mode === "leads") {
            return (
              <div className="flex flex-col items-end">
                <span className="font-mono tabular-nums">
                  {formatCurrency(row.original.costPerLead, currency)}
                </span>
                <span className="text-muted-foreground text-[10px]">
                  cost / lead
                </span>
              </div>
            );
          }
          return (
            <div className="flex flex-col items-end">
              <span className="font-mono tabular-nums">
                {formatRoas(row.original.roasPixel)}
              </span>
              <span className="text-muted-foreground text-[10px]">ROAS</span>
            </div>
          );
        },
      },
    ];
  }, [currency]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id} className={h.id === "campaignName" ? "" : "text-right"}>
                  {h.isPlaceholder
                    ? null
                    : flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="text-muted-foreground py-8 text-center text-sm"
              >
                No campaigns in this date range.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
