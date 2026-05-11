"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  connectAdAccountAction,
  type ConnectAccountState,
} from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Validating with Meta…" : "Connect account"}
    </Button>
  );
}

export function ConnectAccountForm({ clientId }: { clientId: string }) {
  const [state, formAction] = useActionState<ConnectAccountState, FormData>(
    connectAdAccountAction,
    {},
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) toast.success("Ad account connected.");
  }, [state]);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="clientId" value={clientId} />
      <div className="grid gap-2">
        <Label htmlFor="metaAccountId">Ad account ID</Label>
        <Input
          id="metaAccountId"
          name="metaAccountId"
          required
          autoComplete="off"
          placeholder="act_123456789"
          aria-invalid={!!state?.fieldErrors?.metaAccountId}
        />
        {state?.fieldErrors?.metaAccountId ? (
          <p className="text-destructive text-xs">
            {state.fieldErrors.metaAccountId}
          </p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="accessToken">System User access token</Label>
        <Input
          id="accessToken"
          name="accessToken"
          type="password"
          required
          autoComplete="off"
          aria-invalid={!!state?.fieldErrors?.accessToken}
        />
        <p className="text-muted-foreground text-xs">
          Stored encrypted with AES-256-GCM. Never logged.
        </p>
        {state?.fieldErrors?.accessToken ? (
          <p className="text-destructive text-xs">
            {state.fieldErrors.accessToken}
          </p>
        ) : null}
      </div>
      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
