import { ShieldCheck } from "lucide-react";
import { Role } from "@prisma/client";

import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { ROLE_DESCRIPTIONS } from "@/lib/permissions";
import {
  getAllowedPages,
  PAGE_KEYS,
  PAGE_LABELS,
} from "@/lib/permissions-store";

import { InviteForm } from "./invite-form";
import { MemberRow } from "./member-row";
import { PermissionsMatrix } from "./permissions-matrix";

export default async function TeamPage() {
  const me = await requireAdmin();

  const [users, clients, adminPerms, managerPerms, viewerPerms, clientPerms] =
    await Promise.all([
      prisma.user.findMany({
        orderBy: [{ role: "asc" }, { email: "asc" }],
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          clientId: true,
          lastLoginAt: true,
        },
      }),
      prisma.client.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      getAllowedPages(Role.ADMIN),
      getAllowedPages(Role.MANAGER),
      getAllowedPages(Role.VIEWER),
      getAllowedPages(Role.CLIENT),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Invite collaborators and assign per-page permissions."
      />

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Invite</CardTitle>
          <CardDescription>
            Generates a temporary password to share — wire Resend later for
            real invite emails.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm clients={clients} />
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">
            Members ({users.length})
          </CardTitle>
          <CardDescription>
            Change role inline. Removing a user is permanent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-muted-foreground py-2 text-left text-xs uppercase tracking-wide">
                  Member
                </th>
                <th className="text-muted-foreground py-2 text-left text-xs uppercase tracking-wide">
                  Role
                </th>
                <th className="text-muted-foreground py-2 text-left text-xs uppercase tracking-wide">
                  Last login
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <MemberRow
                  key={u.id}
                  user={{
                    ...u,
                    lastLoginAt: u.lastLoginAt
                      ? u.lastLoginAt.toISOString()
                      : null,
                  }}
                  isSelf={u.id === me.id}
                  clients={clients}
                />
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-meta size-4" />
            <CardTitle className="text-base">Role permissions</CardTitle>
          </div>
          <CardDescription>
            What each role can see in the sidebar and reach via URL. Admin is
            locked at full access — you can&apos;t edit your own role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PermissionsMatrix
            pageKeys={PAGE_KEYS}
            pageLabels={PAGE_LABELS}
            initial={{
              ADMIN: [...adminPerms],
              MANAGER: [...managerPerms],
              VIEWER: [...viewerPerms],
              CLIENT: [...clientPerms],
            }}
            myRole={me.role}
          />
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Role descriptions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          {(["ADMIN", "MANAGER", "VIEWER", "CLIENT"] as const).map((r) => (
            <div key={r} className="rounded-md border p-3">
              <div className="font-medium">{r.toLowerCase()}</div>
              <div className="text-muted-foreground text-xs">
                {ROLE_DESCRIPTIONS[r]}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
