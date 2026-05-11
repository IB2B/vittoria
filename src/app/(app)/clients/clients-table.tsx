"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ClientRow = {
  id: string;
  name: string;
  slug: string;
  archived: boolean;
  brandColor: string | null;
  adAccountCount: number;
  currency: string;
  lastSyncedAt: string | null;
  userCount: number;
};

export function ClientsTable({ rows }: { rows: ClientRow[] }) {
  const [filter, setFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<ClientRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          >
            Name <ArrowUpDown className="size-3" />
          </Button>
        ),
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
            {row.original.archived ? (
              <Badge variant="outline" className="text-muted-foreground">
                archived
              </Badge>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "adAccountCount",
        header: "Ad accounts",
        cell: ({ row }) => (
          <span className="font-mono tabular-nums">
            {row.original.adAccountCount}
          </span>
        ),
      },
      {
        accessorKey: "userCount",
        header: "Users",
        cell: ({ row }) => (
          <span className="font-mono tabular-nums">
            {row.original.userCount}
          </span>
        ),
      },
      {
        accessorKey: "currency",
        header: "Currency",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.currency}</span>
        ),
      },
      {
        accessorKey: "lastSyncedAt",
        header: "Last sync",
        cell: ({ row }) =>
          row.original.lastSyncedAt ? (
            <span
              className="text-muted-foreground"
              title={row.original.lastSyncedAt}
            >
              {formatDistanceToNow(new Date(row.original.lastSyncedAt), {
                addSuffix: true,
              })}
            </span>
          ) : (
            <span className="text-muted-foreground italic">never</span>
          ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              nativeButton={false}
              render={<Link href={`/clients/${row.original.slug}`} />}
            >
              <ExternalLink className="size-3.5" />
              Open
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-3">
      <Input
        placeholder="Filter by name…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-xs"
      />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
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
                  No clients match this filter.
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
    </div>
  );
}
