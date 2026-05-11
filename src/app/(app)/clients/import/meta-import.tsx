"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  discoverMetaAdAccountsAction,
  importMetaAdAccountsAction,
  type DiscoverState,
} from "./actions";
import { accountStatusLabel, type AccessibleAdAccount } from "@/lib/meta";

type Row = {
  metaAccountId: string;
  defaultName: string;
  clientName: string;
  currency: string;
  timezone: string;
  status: number;
  businessId?: string;
  businessName?: string;
  selected: boolean;
  alreadyImported?: { clientName: string; clientSlug: string };
};

function DiscoverSubmit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending}>
      {pending ? "Talking to Meta…" : "Discover ad accounts"}
    </Button>
  );
}

export function MetaImport() {
  const router = useRouter();
  const [discoverState, discoverAction] = useActionState<
    DiscoverState,
    FormData
  >(discoverMetaAdAccountsAction, {});
  const [pending, startTransition] = useTransition();

  const [token, setToken] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (discoverState?.error) toast.error(discoverState.error);
    if (discoverState?.ok && discoverState.accounts) {
      setRows(
        discoverState.accounts.map((a: AccessibleAdAccount) => {
          const dup = discoverState.alreadyImported?.[a.id];
          return {
            metaAccountId: a.id,
            defaultName: a.name,
            clientName: a.name,
            currency: a.currency,
            timezone: a.timezone,
            status: a.status,
            businessId: a.businessId,
            businessName: a.businessName,
            selected: !dup && a.status === 1,
            alreadyImported: dup,
          };
        }),
      );
    }
  }, [discoverState]);

  const selectedCount = useMemo(
    () => rows.filter((r) => r.selected).length,
    [rows],
  );

  function toggle(id: string, selected: boolean) {
    setRows((prev) =>
      prev.map((r) => (r.metaAccountId === id ? { ...r, selected } : r)),
    );
  }

  function rename(id: string, value: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.metaAccountId === id ? { ...r, clientName: value } : r,
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
        metaAccountId: r.metaAccountId,
        clientName: r.clientName.trim() || r.defaultName,
        currency: r.currency,
        timezone: r.timezone,
        businessId: r.businessId,
        businessName: r.businessName,
      }));
    if (items.length === 0) {
      toast.error("Pick at least one ad account.");
      return;
    }
    const fd = new FormData();
    fd.set("accessToken", token);
    fd.set("items", JSON.stringify(items));

    startTransition(async () => {
      const res = await importMetaAdAccountsAction(undefined, fd);
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

  return (
    <div className="space-y-6">
      <form action={discoverAction} className="grid gap-3">
        <div className="grid gap-2">
          <Label htmlFor="accessToken">System User access token</Label>
          <Input
            id="accessToken"
            name="accessToken"
            type="password"
            required
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="EAA…"
          />
          <p className="text-muted-foreground text-xs">
            Business Manager → System Users → your system user → Generate Token
            (scopes: <code>ads_read</code>, <code>business_management</code>,{" "}
            <code>read_insights</code>). Encrypted at rest if you import.
          </p>
        </div>
        <div className="flex justify-end">
          <DiscoverSubmit disabled={token.length < 20} />
        </div>
      </form>

      {rows.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="font-medium">{rows.length}</span> ad account(s)
              found
              {rows[0]?.businessName ? (
                <span className="text-muted-foreground">
                  {" "}
                  · BM: {rows[0].businessName}
                </span>
              ) : null}
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
                  <TableHead>Ad account</TableHead>
                  <TableHead>Client name</TableHead>
                  <TableHead className="w-[110px]">Currency</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow
                    key={r.metaAccountId}
                    className={r.alreadyImported ? "opacity-60" : ""}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={r.selected}
                        disabled={!!r.alreadyImported}
                        onChange={(e) =>
                          toggle(r.metaAccountId, e.target.checked)
                        }
                        className="size-4 rounded border-input"
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <div>{r.metaAccountId}</div>
                      <div className="text-muted-foreground">
                        {r.defaultName}
                      </div>
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
                          onChange={(e) =>
                            rename(r.metaAccountId, e.target.value)
                          }
                          className="h-8"
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{r.currency}</TableCell>
                    <TableCell>
                      <Badge
                        variant={r.status === 1 ? "outline" : "destructive"}
                      >
                        {accountStatusLabel(r.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs">
              The same token is encrypted and stored on each imported account.
              Already-imported accounts refresh their token only.
            </p>
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
      ) : null}
    </div>
  );
}
