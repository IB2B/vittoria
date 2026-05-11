"use client";

import { useState, useTransition } from "react";
import { Lock, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { updateRolePermissionsAction } from "./permissions-actions";

type Role = "ADMIN" | "MANAGER" | "VIEWER" | "CLIENT";

type Props = {
  pageKeys: readonly string[];
  pageLabels: Record<string, string>;
  initial: Record<Role, string[]>;
  myRole: Role;
};

export function PermissionsMatrix({
  pageKeys,
  pageLabels,
  initial,
  myRole,
}: Props) {
  const [perms, setPerms] = useState<Record<Role, Set<string>>>({
    ADMIN: new Set(initial.ADMIN),
    MANAGER: new Set(initial.MANAGER),
    VIEWER: new Set(initial.VIEWER),
    CLIENT: new Set(initial.CLIENT),
  });
  const [pendingRow, startSave] = useTransition();

  function toggle(role: Role, key: string) {
    if (role === "ADMIN") return; // locked
    setPerms((prev) => {
      const next = { ...prev };
      const set = new Set(next[role]);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      next[role] = set;
      return next;
    });
  }

  function save(role: Role) {
    if (role === "ADMIN") return;
    if (role === myRole) {
      toast.error("Can't edit your own role's permissions.");
      return;
    }
    const fd = new FormData();
    fd.set("role", role);
    fd.set("permissions", JSON.stringify([...perms[role]]));
    startSave(async () => {
      const res = await updateRolePermissionsAction(undefined, fd);
      if (res?.error) toast.error(res.error);
      else toast.success(`${role.toLowerCase()} permissions saved.`);
    });
  }

  const ROLES: Role[] = ["ADMIN", "MANAGER", "VIEWER", "CLIENT"];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-muted-foreground py-2 pr-3 text-left text-xs uppercase tracking-wide">
              Role
            </th>
            {pageKeys.map((k) => (
              <th
                key={k}
                className="text-muted-foreground py-2 px-2 text-center text-[10px] uppercase tracking-wide"
              >
                {pageLabels[k] ?? k}
              </th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {ROLES.map((role) => {
            const isAdmin = role === "ADMIN";
            const isMine = role === myRole;
            const locked = isAdmin || isMine;
            return (
              <tr key={role} className="border-b last:border-b-0">
                <td className="py-3 pr-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{role.toLowerCase()}</span>
                    {locked ? (
                      <Lock className="text-muted-foreground size-3" />
                    ) : null}
                  </div>
                  {isAdmin ? (
                    <div className="text-muted-foreground text-[10px]">
                      Always all access
                    </div>
                  ) : isMine ? (
                    <div className="text-muted-foreground text-[10px]">
                      Your own role
                    </div>
                  ) : null}
                </td>
                {pageKeys.map((k) => (
                  <td key={k} className="px-2 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={perms[role].has(k)}
                      disabled={locked}
                      onChange={() => toggle(role, k)}
                      className="size-4 cursor-pointer accent-[var(--brand)] disabled:cursor-not-allowed"
                      aria-label={`${role} can access ${pageLabels[k] ?? k}`}
                    />
                  </td>
                ))}
                <td className="py-3 pl-3 text-right">
                  {!locked ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => save(role)}
                      disabled={pendingRow}
                    >
                      <Save className="size-3.5" />
                      Save
                    </Button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
