"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Copy, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { inviteUserAction, type InviteState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <UserPlus className="size-3.5" />
      {pending ? "Inviting…" : "Invite"}
    </Button>
  );
}

export function InviteForm({
  clients,
}: {
  clients: Array<{ id: string; name: string }>;
}) {
  const [state, formAction] = useActionState<InviteState, FormData>(
    inviteUserAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [role, setRole] = useState("VIEWER");

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      toast.success("Invite created.");
      formRef.current?.reset();
      setRole("VIEWER");
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="invite-name">Name</Label>
          <Input
            id="invite-name"
            name="name"
            required
            autoComplete="off"
            placeholder="Anna Rossi"
            aria-invalid={!!state?.fieldErrors?.name}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            name="email"
            type="email"
            required
            autoComplete="off"
            placeholder="anna@example.com"
            aria-invalid={!!state?.fieldErrors?.email}
          />
          {state?.fieldErrors?.email ? (
            <p className="text-destructive text-xs">
              {state.fieldErrors.email}
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="invite-role">Role</Label>
          <Select
            value={role}
            onValueChange={(v) => setRole(typeof v === "string" ? v : "VIEWER")}
          >
            <SelectTrigger id="invite-role">
              <SelectValue>
                {(v) =>
                  ({
                    ADMIN: "Admin",
                    MANAGER: "Manager",
                    VIEWER: "Viewer",
                    CLIENT: "Client",
                  })[v as string] ?? "Pick a role"
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
          <input type="hidden" name="role" value={role} />
        </div>
        {role === "CLIENT" ? (
          <div className="grid gap-2">
            <Label htmlFor="invite-clientId">Linked client</Label>
            <select
              id="invite-clientId"
              name="clientId"
              required
              className="border-input bg-background hover:bg-accent flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm"
              defaultValue=""
              aria-invalid={!!state?.fieldErrors?.clientId}
            >
              <option value="" disabled>
                Pick a client…
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {state?.fieldErrors?.clientId ? (
              <p className="text-destructive text-xs">
                {state.fieldErrors.clientId}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex justify-end">
        <Submit />
      </div>

      {state?.ok && state.generatedPassword ? (
        <GeneratedPasswordCallout password={state.generatedPassword} />
      ) : null}
    </form>
  );
}

function GeneratedPasswordCallout({ password }: { password: string }) {
  return (
    <div className="bg-muted/40 rounded-md border p-3 text-sm">
      <p className="mb-2 font-medium">
        Temporary password (share once, out-of-band)
      </p>
      <div className="flex items-center gap-2">
        <code className="bg-background flex-1 rounded px-2 py-1 font-mono text-xs">
          {password}
        </code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(password);
            toast.success("Copied.");
          }}
        >
          <Copy className="size-3.5" />
          Copy
        </Button>
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        Once email-sending is wired (Resend), this will go directly to the
        invitee. For now, copy and send via your usual channel.
      </p>
    </div>
  );
}
