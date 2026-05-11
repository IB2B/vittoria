"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, AlertTriangle, ExternalLink, FileText } from "lucide-react";

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
  formatRoas,
} from "@/lib/format";
import type { ClientRollupRow } from "@/lib/dashboard-rollup";

export function ClientsRollupTable({
  rows,
  preset,
  from,
  to,
}: {
  rows: ClientRollupRow[];
  preset: string;
  from: string;
  to: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "spend", desc: true },
  ]);

  const columns = useMemo<ColumnDef<ClientRollupRow>[]>(() => {
    const sortHeader = (label: string) =>
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
        accessorKey: "name",
        header: "Client",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: row.original.brandColor ?? "#8B1538" }}
              aria-hidden
            />
            <Link
              href={`/clients/${row.original.slug}`}
              className="font-medium hover:underline"
            >
              {row.original.name}
            </Link>
            {row.original.hasGoogle ? (
              <Badge variant="outline" className="text-[10px]">
                +Google
              </Badge>
            ) : null}
            {row.original.hasError ? (
              <span title="Sync error">
                <AlertTriangle className="text-destructive size-3.5" />
              </span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "spend",
        header: sortHeader("Spend"),
        cell: ({ row }) => (
          <span className="text-right font-mono tabular-nums block">
            {formatCurrency(row.original.spend, row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: "purchases",
        header: sortHeader("Purchases"),
        cell: ({ row }) => (
          <span className="text-right font-mono tabular-nums block">
            {formatNumber(row.original.purchases)}
          </span>
        ),
      },
      {
        accessorKey: "revenue",
        header: sortHeader("Revenue"),
        cell: ({ row }) => (
          <span className="text-right font-mono tabular-nums block">
            {formatCurrency(row.original.revenue, row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: "roas",
        header: sortHeader("ROAS"),
        cell: ({ row }) => (
          <span className="text-right font-mono tabular-nums block">
            {formatRoas(row.original.roas)}
          </span>
        ),
      },
      {
        accessorKey: "cpa",
        header: sortHeader("CPA"),
        cell: ({ row }) => (
          <span className="text-right font-mono tabular-nums block">
            {row.original.cpa != null
              ? formatCurrency(row.original.cpa, row.original.currency)
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "lastSyncedAt",
        header: "Last sync",
        cell: ({ row }) =>
          row.original.lastSyncedAt ? (
            <span className="text-muted-foreground text-xs">
              {formatDistanceToNow(new Date(row.original.lastSyncedAt), {
                addSuffix: true,
              })}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs italic">never</span>
          ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              nativeButton={false}
              render={<Link href={`/clients/${row.original.slug}`} />}
            >
              <ExternalLink className="size-3.5" />
              Open
            </Button>
            <Button
              size="sm"
              variant="ghost"
              nativeButton={false}
              render={
                <Link
                  href={`/clients/${row.original.slug}/report?preset=${preset}&from=${from}&to=${to}`}
                />
              }
            >
              <FileText className="size-3.5" />
              Report
            </Button>
          </div>
        ),
      },
    ];
  }, [preset, from, to]);

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
                  className={h.id === "name" ? "" : "text-right"}
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
                No clients yet.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext(),
                    )}
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
