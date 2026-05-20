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
import { ArrowUpDown, Layers } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdSetStatusToggle } from "@/components/adset-status-toggle";
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

export type AdSetRow = {
  adsetId: string;
  adsetName: string;
  campaignName?: string;
  effectiveStatus?: string;
  dailyBudget?: number;
  spend: number;
  impressions: number;
  linkClicks: number;
  ctrLink: number | null;
  leads: number;
  costPerLead: number | null;
  purchasesPixel: number;
  roasPixel: number | null;
};

export function AdSetsTable({
  rows,
  currency,
  clientId,
  slug,
  canToggle,
}: {
  rows: AdSetRow[];
  currency: string;
  clientId: string;
  slug: string;
  canToggle: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "spend", desc: true },
  ]);

  const columns = useMemo<ColumnDef<AdSetRow>[]>(() => {
    const numericHeader = (label: string) =>
      ({
        column,
      }: {
        column: {
          toggleSorting: (desc?: boolean) => void;
          getIsSorted: () => false | "asc" | "desc";
        };
      }) => (
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
        accessorKey: "adsetName",
        header: "Ad set",
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            <Layers className="text-meta size-3.5 shrink-0" />
            <div className="min-w-0">
              <div
                className="line-clamp-1 text-sm"
                title={row.original.adsetName}
              >
                {row.original.adsetName}
              </div>
              {row.original.campaignName ? (
                <div
                  className="text-muted-foreground line-clamp-1 text-[10px]"
                  title={row.original.campaignName}
                >
                  {row.original.campaignName}
                </div>
              ) : null}
            </div>
            {row.original.effectiveStatus &&
            row.original.effectiveStatus !== "ACTIVE" ? (
              <Badge variant="ghost" className="shrink-0 text-[10px]">
                {row.original.effectiveStatus
                  .toLowerCase()
                  .replace(/_/g, " ")}
              </Badge>
            ) : null}
          </div>
        ),
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
        accessorKey: "ctrLink",
        header: numericHeader("CTR"),
        cell: ({ row }) => (
          <span className="text-right font-mono tabular-nums block">
            {formatPercent(row.original.ctrLink, 2)}
          </span>
        ),
      },
      {
        accessorKey: "leads",
        header: numericHeader("Leads"),
        cell: ({ row }) => (
          <span className="text-right font-mono tabular-nums block">
            {formatNumber(row.original.leads)}
          </span>
        ),
      },
      {
        id: "perf",
        accessorFn: (row) => row.roasPixel ?? row.costPerLead ?? 0,
        header: numericHeader("Perf"),
        cell: ({ row }) => {
          if (row.original.purchasesPixel > 0) {
            return (
              <div className="flex flex-col items-end">
                <span className="font-mono tabular-nums">
                  {formatRoas(row.original.roasPixel)}
                </span>
                <span className="text-muted-foreground text-[10px]">
                  ROAS
                </span>
              </div>
            );
          }
          if (row.original.leads > 0) {
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
            <span className="text-muted-foreground text-right block text-xs">
              —
            </span>
          );
        },
      },
      ...(canToggle
        ? [
            {
              id: "actions",
              header: "",
              cell: ({ row }: { row: { original: AdSetRow } }) => (
                <div className="flex justify-end">
                  <AdSetStatusToggle
                    clientId={clientId}
                    slug={slug}
                    adSetId={row.original.adsetId}
                    adSetName={row.original.adsetName}
                    effectiveStatus={row.original.effectiveStatus}
                  />
                </div>
              ),
            } satisfies ColumnDef<AdSetRow>,
          ]
        : []),
    ];
  }, [currency, canToggle, clientId, slug]);

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
                <TableHead
                  key={h.id}
                  className={h.id === "adsetName" ? "" : "text-right"}
                >
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
                No ad sets in this date range.
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
