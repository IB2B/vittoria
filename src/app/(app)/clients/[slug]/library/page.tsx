import { BookMarked, FileText, KeyRound, Link as LinkIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { getClientForUser } from "@/lib/clients";
import { canMutate } from "@/lib/permissions";

import { NewLibraryItem } from "./library-form";
import { LibraryItemCard } from "./library-item-card";

export default async function ClientLibraryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const client = await getClientForUser(slug, user);
  const writable = canMutate(user);

  const items = await prisma.clientLibraryItem.findMany({
    where: { clientId: client.id },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      tags: true,
      pinned: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const counts = {
    NOTE: items.filter((i) => i.type === "NOTE").length,
    CREDENTIAL: items.filter((i) => i.type === "CREDENTIAL").length,
    LINK: items.filter((i) => i.type === "LINK").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="text-muted-foreground inline-flex items-center gap-1.5 text-xs uppercase tracking-wider">
            <BookMarked className="text-meta size-3" />
            Library
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {client.name}&apos;s knowledge base
          </h2>
          <p className="text-muted-foreground text-sm">
            Notes, credentials, drive links — anything specific to this client
            that doesn&apos;t belong in the ad data. Credentials are encrypted
            at rest.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            <FileText className="size-3" />
            {counts.NOTE} notes
          </Badge>
          <Badge variant="outline">
            <KeyRound className="size-3" />
            {counts.CREDENTIAL} credentials
          </Badge>
          <Badge variant="outline">
            <LinkIcon className="size-3" />
            {counts.LINK} links
          </Badge>
        </div>
      </div>

      {writable ? (
        <NewLibraryItem clientId={client.id} slug={slug} />
      ) : null}

      {items.length === 0 ? (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Nothing here yet</CardTitle>
            <CardDescription>
              {writable
                ? "Add a note, credential, or drive link to get started. Use tags to keep things organized."
                : "No items have been added to this client's library yet."}
            </CardDescription>
          </CardHeader>
          {writable ? null : (
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Read-only on your role.
              </p>
            </CardContent>
          )}
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((it) => (
            <LibraryItemCard
              key={it.id}
              item={{
                id: it.id,
                type: it.type as "NOTE" | "CREDENTIAL" | "LINK",
                title: it.title,
                body: it.body ?? "",
                tags: it.tags,
                pinned: it.pinned,
                createdAt: it.createdAt.toISOString(),
                updatedAt: it.updatedAt.toISOString(),
              }}
              clientId={client.id}
              slug={slug}
              canMutate={writable}
            />
          ))}
        </div>
      )}
    </div>
  );
}
