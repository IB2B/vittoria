import { format, formatDistanceToNow } from "date-fns";
import { CheckCircle2, AlertTriangle } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/auth-helpers";
import { getClientForUser } from "@/lib/clients";
import { formatCurrencyDetailed, formatNumber } from "@/lib/format";

import { ConnectAccountForm } from "./connect-form";
import { disconnectAdAccountAction } from "./actions";
import { GoogleStatsForm } from "./google-stats-form";
import { deleteGoogleStatAction } from "./google-actions";

export default async function ClientSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireManager();
  const client = await getClientForUser(slug, user);

  const googleStats = await prisma.channelStat.findMany({
    where: { clientId: client.id, channel: "GOOGLE" },
    orderBy: { rangeStart: "desc" },
    take: 24,
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ background: "var(--meta)" }}
              />
              <CardTitle className="text-base">Meta Ads</CardTitle>
            </div>
            <CardDescription>
              Tokens are encrypted at rest with AES-256-GCM.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {client.adAccounts.filter((a) => a.channel === "META").length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No Meta ad accounts connected yet.
              </p>
            ) : (
              client.adAccounts
                .filter((a) => a.channel === "META")
                .map((acc) => {
                  const healthy = !acc.lastSyncError;
                  return (
                    <div
                      key={acc.id}
                      className="flex flex-col gap-2 rounded-md border p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-mono text-sm">
                          {healthy ? (
                            <CheckCircle2 className="size-4 text-emerald-600" />
                          ) : (
                            <AlertTriangle className="text-destructive size-4" />
                          )}
                          {acc.metaAccountId}
                        </div>
                        <Badge variant="outline">{acc.channel}</Badge>
                      </div>
                      <div className="text-muted-foreground grid grid-cols-2 gap-y-1 text-xs">
                        <span>Currency</span>
                        <span className="text-foreground text-right">
                          {acc.currency}
                        </span>
                        <span>Timezone</span>
                        <span className="text-foreground text-right">
                          {acc.timezone}
                        </span>
                        <span>Last sync</span>
                        <span className="text-foreground text-right">
                          {acc.lastSyncedAt
                            ? formatDistanceToNow(acc.lastSyncedAt, {
                                addSuffix: true,
                              })
                            : "never"}
                        </span>
                        {acc.lastSyncError ? (
                          <>
                            <span>Last error</span>
                            <span className="text-destructive col-span-1 text-right">
                              {acc.lastSyncError}
                            </span>
                          </>
                        ) : null}
                      </div>
                      <form
                        action={disconnectAdAccountAction}
                        className="flex justify-end"
                      >
                        <input type="hidden" name="adAccountId" value={acc.id} />
                        <input type="hidden" name="slug" value={slug} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                        >
                          Disconnect
                        </Button>
                      </form>
                    </div>
                  );
                })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connect a Meta ad account</CardTitle>
            <CardDescription>
              Generate a long-lived System User token in Business Manager →
              System Users → Generate Token (scopes: ads_read,
              business_management, read_insights).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConnectAccountForm clientId={client.id} />
          </CardContent>
        </Card>
      </div>

      <div id="google" className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ background: "var(--google)" }}
              />
              <CardTitle className="text-base">Google Ads totals</CardTitle>
            </div>
            <CardDescription>
              Manual entry for now — paste totals from the Google Ads UI. Each
              row is a period that contributes to the dashboard and the report.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {googleStats.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No Google Ads totals saved yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Spend</TableHead>
                    <TableHead className="text-right">Conv.</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="w-[1%]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {googleStats.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs">
                        {format(s.rangeStart, "MMM d")} →{" "}
                        {format(s.rangeEnd, "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatCurrencyDetailed(Number(s.spend), s.currency)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatNumber(s.conversions)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatCurrencyDetailed(Number(s.revenue), s.currency)}
                      </TableCell>
                      <TableCell>
                        <form action={deleteGoogleStatAction}>
                          <input type="hidden" name="statId" value={s.id} />
                          <input type="hidden" name="slug" value={slug} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                          >
                            ✕
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add Google Ads period</CardTitle>
            <CardDescription>
              Enter totals for a date range. Multiple ranges are summed when
              they overlap a dashboard window.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GoogleStatsForm clientId={client.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
