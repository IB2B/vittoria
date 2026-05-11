import Link from "next/link";
import { Plus, Download } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireManager } from "@/lib/auth-helpers";
import { loadClientCards } from "@/lib/client-cards";
import { getActiveBm } from "@/lib/business-managers";

import { ClientsGrid } from "./clients-grid";

export default async function ClientsPage() {
  await requireManager();
  const activeBm = await getActiveBm();
  const cards = await loadClientCards(activeBm);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="All accounts under management."
        actions={
          <>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/clients/import" />}
            >
              <Download className="size-4" />
              Import from BM
            </Button>
            <Button nativeButton={false} render={<Link href="/clients/new" />}>
              <Plus className="size-4" />
              New client
            </Button>
          </>
        }
      />

      {cards.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No clients yet</CardTitle>
            <CardDescription>
              Create your first client to start tracking campaigns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button nativeButton={false} render={<Link href="/clients/new" />}>
              <Plus className="size-4" />
              Add a client
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ClientsGrid clients={cards} />
      )}
    </div>
  );
}
