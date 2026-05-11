"use client";

import { useActionState, useEffect, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  removeUserAction,
  updateMemberAction,
  type UpdateState,
} from "./actions";

export function MemberRow({
  user,
  isSelf,
  clients,
}: {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    clientId: string | null;
    lastLoginAt: string | null;
  };
  isSelf: boolean;
  clients: Array<{ id: string; name: string }>;
}) {
  const [state, formAction] = useActionState<UpdateState, FormData>(
    updateMemberAction,
    {},
  );
  const [removing, startRemove] = useTransition();

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) toast.success("Updated.");
  }, [state]);

  return (
    <tr className="border-b last:border-b-0">
      <td className="py-3 pr-3">
        <div className="font-medium">
          {user.name ?? user.email.split("@")[0]}
          {isSelf ? (
            <span className="text-muted-foreground ml-1 text-xs">(you)</span>
          ) : null}
        </div>
        <div className="text-muted-foreground text-xs">{user.email}</div>
      </td>
      <td className="py-3 pr-3">
        {isSelf ? (
          // Editing your own role would let an admin lock themselves out, so
          // we surface it as a read-only label here. Other admins can still
          // change another admin's role from their own session.
          <div className="text-muted-foreground inline-flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1 text-xs">
            <span className="font-medium">{user.role.toLowerCase()}</span>
            <span>· locked</span>
          </div>
        ) : (
          <form action={formAction} className="flex items-center gap-2">
            <input type="hidden" name="userId" value={user.id} />
            <Select name="role" defaultValue={user.role}>
              <SelectTrigger className="h-8 w-[110px]">
                <SelectValue>
                  {(v) =>
                    ({
                      ADMIN: "Admin",
                      MANAGER: "Manager",
                      VIEWER: "Viewer",
                      CLIENT: "Client",
                    })[v as string] ?? "Role"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
                <SelectItem value="VIEWER">Viewer</SelectItem>
                <SelectItem value="CLIENT">Client</SelectItem>
              </SelectContent>
            </Select>
            {user.role === "CLIENT" ? (
              <select
                name="clientId"
                defaultValue={user.clientId ?? ""}
                className="border-input bg-background h-8 rounded-md border px-2 text-xs"
              >
                <option value="" disabled>
                  Pick…
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : null}
            <Button type="submit" size="sm" variant="outline">
              Save
            </Button>
          </form>
        )}
      </td>
      <td className="text-muted-foreground py-3 pr-3 text-xs">
        {user.lastLoginAt
          ? new Date(user.lastLoginAt).toLocaleDateString()
          : "never"}
      </td>
      <td className="py-3 text-right">
        {!isSelf ? (
          <form
            action={(fd) => startRemove(() => removeUserAction(fd))}
            className="inline-flex"
          >
            <input type="hidden" name="userId" value={user.id} />
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={removing}
            >
              <Trash2 className="size-3.5" />
              Remove
            </Button>
          </form>
        ) : null}
      </td>
    </tr>
  );
}
