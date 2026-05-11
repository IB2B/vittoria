import { format } from "date-fns";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { requireUser } from "@/lib/auth-helpers";
import { getClientForUser } from "@/lib/clients";
import { formatCurrencyDetailed } from "@/lib/format";

import { OrderForm } from "./order-form";
import { CsvImport } from "./csv-import";
import { deleteOrderAction } from "./actions";

export default async function OrdersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const client = await getClientForUser(slug, user);

  const orders = await prisma.order.findMany({
    where: { clientId: client.id },
    orderBy: { occurredAt: "desc" },
    take: 200,
  });

  const currency = client.adAccounts[0]?.currency ?? "EUR";
  const total = orders.reduce((acc, o) => acc + Number(o.value), 0);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Backend orders</CardTitle>
                <CardDescription>
                  Orders not tracked by the Meta pixel — included in Real
                  Revenue / Real ROAS.
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-muted-foreground text-xs">Total</div>
                <div className="font-mono text-lg tabular-nums">
                  {formatCurrencyDetailed(total, currency)}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No backend orders yet. Add one on the right.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[1%]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="text-muted-foreground">
                        {format(o.occurredAt, "yyyy-MM-dd")}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {o.reference ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatCurrencyDetailed(Number(o.value), o.currency)}
                      </TableCell>
                      <TableCell
                        className="text-muted-foreground line-clamp-1 max-w-[280px] text-xs"
                        title={o.notes ?? undefined}
                      >
                        {o.notes ?? "—"}
                      </TableCell>
                      <TableCell>
                        <form action={deleteOrderAction}>
                          <input type="hidden" name="orderId" value={o.id} />
                          <input type="hidden" name="slug" value={slug} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                          >
                            Delete
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
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add backend order</CardTitle>
            <CardDescription>One order at a time.</CardDescription>
          </CardHeader>
          <CardContent>
            <OrderForm clientId={client.id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">CSV import</CardTitle>
            <CardDescription>
              Headers: <code>occurredAt,value</code> (optional{" "}
              <code>reference,notes</code>).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CsvImport clientId={client.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
