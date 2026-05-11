"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

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

import {
  importGoogleCustomersAction,
  type GoogleImportState,
} from "./google-actions";

type Customer = {
  customerId: string;
  descriptiveName: string;
  currency: string;
  timeZone: string;
  manager: boolean;
  testAccount: boolean;
};

type Row = {
  customerId: string;
  defaultName: string;
  clientName: string;
  currency: string;
  timezone: string;
  manager: boolean;
  testAccount: boolean;
  selected: boolean;
  alreadyImported?: { clientName: string; clientSlug: string };
};

export function GoogleImportPicker({
  customers,
  alreadyImported,
  onCancel,
}: {
  customers: Customer[];
  alreadyImported: Record<string, { clientName: string; clientSlug: string }>;
  onCancel: () => Promise<void>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    setRows(
      customers.map((c) => {
        const dup = alreadyImported[c.customerId];
        return {
          customerId: c.customerId,
          defaultName: c.descriptiveName,
          clientName: c.descriptiveName,
          currency: c.currency,
          timezone: c.timeZone,
          manager: c.manager,
          testAccount: c.testAccount,
          selected: !dup && !c.manager && !c.testAccount,
          alreadyImported: dup,
        };
      }),
    );
  }, [customers, alreadyImported]);

  const selectedCount = useMemo(
    () => rows.filter((r) => r.selected).length,
    [rows],
  );

  function toggle(id: string, selected: boolean) {
    setRows((prev) =>
      prev.map((r) => (r.customerId === id ? { ...r, selected } : r)),
    );
  }

  function rename(id: string, value: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.customerId === id ? { ...r, clientName: value } : r,
      ),
    );
  }

  function selectAll(checked: boolean) {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        selected: checked && !r.alreadyImported,
      })),
    );
  }

  function handleImport() {
    const items = rows
      .filter((r) => r.selected)
      .map((r) => ({
        customerId: r.customerId,
        clientName: r.clientName.trim() || r.defaultName,
        currency: r.currency,
        timezone: r.timezone,
      }));
    if (items.length === 0) {
      toast.error("Pick at least one customer.");
      return;
    }
    const fd = new FormData();
    fd.set("items", JSON.stringify(items));
    startTransition(async () => {
      const res: GoogleImportState = await importGoogleCustomersAction(
        undefined,
        fd,
      );
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const parts: string[] = [];
      if (res.imported) parts.push(`${res.imported} new client(s)`);
      if (res.reused) parts.push(`${res.reused} re-linked`);
      toast.success(`Imported: ${parts.join(", ") || "done"}`);
      router.push("/clients");
      router.refresh();
    });
  }

  function handleCancel() {
    startTransition(async () => {
      await onCancel();
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          The Google account you signed in with has access to 0 customers — or
          the call returned an error above. Sign out and retry, or check that
          the Manager (MCC) account has the right permissions.
        </p>
        <Button variant="outline" size="sm" onClick={handleCancel}>
          Sign out of Google
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className="font-medium">{rows.length}</span> customer(s) found
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => selectAll(true)}
            type="button"
          >
            Select all
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => selectAll(false)}
            type="button"
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[1%]" />
              <TableHead>Customer</TableHead>
              <TableHead>Client name</TableHead>
              <TableHead className="w-[110px]">Currency</TableHead>
              <TableHead className="w-[120px]">Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow
                key={r.customerId}
                className={r.alreadyImported ? "opacity-60" : ""}
              >
                <TableCell>
                  <input
                    type="checkbox"
                    checked={r.selected}
                    disabled={!!r.alreadyImported}
                    onChange={(e) => toggle(r.customerId, e.target.checked)}
                    className="size-4 rounded border-input"
                  />
                </TableCell>
                <TableCell className="font-mono text-xs">
                  <div>{r.customerId}</div>
                  <div className="text-muted-foreground">{r.defaultName}</div>
                </TableCell>
                <TableCell>
                  {r.alreadyImported ? (
                    <Link
                      href={`/clients/${r.alreadyImported.clientSlug}`}
                      className="inline-flex items-center gap-1 text-sm hover:underline"
                    >
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                      {r.alreadyImported.clientName}
                      <ExternalLink className="size-3" />
                    </Link>
                  ) : (
                    <Input
                      value={r.clientName}
                      onChange={(e) => rename(r.customerId, e.target.value)}
                      className="h-8"
                    />
                  )}
                </TableCell>
                <TableCell className="text-xs">{r.currency}</TableCell>
                <TableCell>
                  {r.manager ? (
                    <Badge variant="outline">manager</Badge>
                  ) : r.testAccount ? (
                    <Badge variant="outline">test</Badge>
                  ) : (
                    <Badge variant="outline">client</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={pending}
        >
          Cancel & sign out of Google
        </Button>
        <Button
          type="button"
          onClick={handleImport}
          disabled={pending || selectedCount === 0}
        >
          {pending
            ? "Importing…"
            : `Import ${selectedCount} as client${selectedCount === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}
