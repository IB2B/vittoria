import { format } from "date-fns";

import { PageHeader } from "@/components/page-header";
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

import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";

export default async function ProfilePage() {
  const session = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Update your account info and password."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Identity</CardTitle>
            <CardDescription>Name and email shown across Vittoria.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm
              defaultName={user.name ?? ""}
              defaultEmail={user.email}
            />
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Password</CardTitle>
            <CardDescription>
              Re-enter your current password to confirm.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Account details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3 text-sm">
          <Detail label="Role" value={<Badge variant="outline">{user.role}</Badge>} />
          <Detail
            label="Member since"
            value={format(user.createdAt, "MMM d, yyyy")}
          />
          <Detail
            label="Last login"
            value={
              user.lastLoginAt
                ? format(user.lastLoginAt, "MMM d, yyyy HH:mm")
                : "—"
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-muted-foreground text-[11px] uppercase tracking-wide">
        {label}
      </div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}
