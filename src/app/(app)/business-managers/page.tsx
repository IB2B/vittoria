import Link from "next/link";
import { format } from "date-fns";
import { Building2, Download, ShieldAlert } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/auth-helpers";

import { DisconnectButton } from "./disconnect-button";
import { EditBmButton } from "./edit-button";
import { MergeButton } from "./merge-button";
import { UNASSIGNED_BM } from "./constants";

export default async function BusinessManagersPage() {
  await requireManager();

  // Aggregate per-BM stats from AdAccount rows.
  const accounts = await prisma.adAccount.findMany({
    where: { channel: "META" },
    select: {
      id: true,
      clientId: true,
      businessId: true,
      businessName: true,
      lastSyncedAt: true,
      lastSyncError: true,
      client: { select: { name: true, slug: true } },
    },
    orderBy: { lastSyncedAt: "desc" },
  });

  type Bm = {
    businessId: string | null;
    businessName: string;
    accountCount: number;
    clientIds: Set<string>;
    lastSyncedAt: Date | null;
    erroredCount: number;
    sampleClients: Array<{ name: string; slug: string }>;
  };
  const byBm = new Map<string, Bm>();
  for (const a of accounts) {
    const key = a.businessId ?? "__unassigned__";
    let entry = byBm.get(key);
    if (!entry) {
      entry = {
        businessId: a.businessId,
        businessName: a.businessName ?? (a.businessId ? "Unnamed BM" : "Unassigned"),
        accountCount: 0,
        clientIds: new Set(),
        lastSyncedAt: null,
        erroredCount: 0,
        sampleClients: [],
      };
      byBm.set(key, entry);
    }
    entry.accountCount += 1;
    entry.clientIds.add(a.clientId);
    if (a.lastSyncError) entry.erroredCount += 1;
    if (a.lastSyncedAt && (!entry.lastSyncedAt || a.lastSyncedAt > entry.lastSyncedAt)) {
      entry.lastSyncedAt = a.lastSyncedAt;
    }
    if (entry.sampleClients.length < 3) {
      entry.sampleClients.push({ name: a.client.name, slug: a.client.slug });
    }
  }
  const bms = Array.from(byBm.values()).sort(
    (a, b) => b.accountCount - a.accountCount,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Managers"
        description="One BM = one System User token. Disconnecting removes every client + ad account it owned."
        actions={
          <Button nativeButton={false} render={<Link href="/clients/import" />}>
            <Download className="size-4" />
            Connect a BM
          </Button>
        }
      />

      {bms.length === 0 ? (
        <Card className="glass">
          <CardHeader>
            <CardTitle>No Business Managers connected yet</CardTitle>
            <CardDescription>
              Paste a System User token from Business Manager → System Users →
              Generate Token. We&apos;ll list every ad account it can see and let
              you bulk-import them as clients.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button nativeButton={false} render={<Link href="/clients/import" />}>
              Open import flow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {bms.map((bm) => {
            const isUnassigned = bm.businessId == null;
            return (
              <Card key={bm.businessId ?? "unassigned"} className="glass">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span
                        className="text-brand-foreground flex size-10 shrink-0 items-center justify-center rounded-md font-semibold shadow-sm"
                        style={{
                          background:
                            "linear-gradient(135deg, var(--brand) 0%, color-mix(in oklab, var(--brand) 60%, white) 100%)",
                        }}
                      >
                        <Building2 className="size-5" />
                      </span>
                      <div>
                        <CardTitle className="text-base">
                          {bm.businessName}
                          {isUnassigned ? (
                            <Badge variant="outline" className="ml-2">
                              legacy
                            </Badge>
                          ) : null}
                        </CardTitle>
                        <CardDescription>
                          {bm.businessId ? (
                            <span className="font-mono text-xs">
                              BM ID: {bm.businessId}
                            </span>
                          ) : (
                            <span>
                              Imported before BM tracking was added — re-run
                              import to label.
                            </span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <EditBmButton
                        currentBusinessId={
                          isUnassigned ? UNASSIGNED_BM : bm.businessId!
                        }
                        currentName={bm.businessName}
                        isUnassigned={isUnassigned}
                      />
                      <MergeButton
                        currentBusinessId={
                          isUnassigned ? UNASSIGNED_BM : bm.businessId!
                        }
                        currentName={bm.businessName}
                        options={bms
                          .filter(
                            (other) =>
                              other.businessId != null &&
                              other.businessId !== bm.businessId,
                          )
                          .map((other) => ({
                            id: other.businessId!,
                            name: other.businessName,
                            clientCount: other.clientIds.size,
                          }))}
                      />
                      <DisconnectButton
                        businessId={
                          isUnassigned ? UNASSIGNED_BM : bm.businessId!
                        }
                        businessName={bm.businessName}
                        clientCount={bm.clientIds.size}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Stat label="Clients" value={bm.clientIds.size.toString()} />
                    <Stat
                      label="Ad accounts"
                      value={bm.accountCount.toString()}
                    />
                    <Stat
                      label="Last sync"
                      value={
                        bm.lastSyncedAt
                          ? format(bm.lastSyncedAt, "MMM d, HH:mm")
                          : "—"
                      }
                    />
                    <Stat
                      label="Errors"
                      value={
                        bm.erroredCount > 0
                          ? `${bm.erroredCount} account${bm.erroredCount === 1 ? "" : "s"}`
                          : "none"
                      }
                      tone={bm.erroredCount > 0 ? "warn" : "ok"}
                    />
                  </div>
                  {bm.sampleClients.length > 0 ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Includes:</span>
                      {bm.sampleClients.map((c) => (
                        <Link
                          key={c.slug}
                          href={`/clients/${c.slug}`}
                          className="hover:bg-muted rounded-md border px-2 py-0.5 transition-colors"
                        >
                          {c.name}
                        </Link>
                      ))}
                      {bm.clientIds.size > bm.sampleClients.length ? (
                        <span className="text-muted-foreground">
                          +{bm.clientIds.size - bm.sampleClients.length} more
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Alert>
        <ShieldAlert className="size-4" />
        <AlertTitle>What &quot;disconnect&quot; does</AlertTitle>
        <AlertDescription className="text-xs">
          Deletes every client whose ad accounts were exclusively under that BM,
          along with their cached insights, manual orders, generated reports,
          and Google Ads totals. Clients that also had ad accounts under other
          BMs survive — only the disconnected BM&apos;s ad accounts are removed
          from them. This action cannot be undone.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div>
      <div className="text-muted-foreground text-[11px] uppercase tracking-wide">
        {label}
      </div>
      <div
        className={
          tone === "warn"
            ? "text-amber-600 font-mono text-base tabular-nums"
            : "font-mono text-base tabular-nums"
        }
      >
        {value}
      </div>
    </div>
  );
}
