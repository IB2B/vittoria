"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { changePasswordAction, type PasswordState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Updating…" : "Change password"}
    </Button>
  );
}

export function PasswordForm() {
  const [state, formAction] = useActionState<PasswordState, FormData>(
    changePasswordAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      toast.success("Password updated.");
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form action={formAction} ref={formRef} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="current">Current password</Label>
        <Input
          id="current"
          name="current"
          type="password"
          required
          autoComplete="current-password"
          aria-invalid={!!state?.fieldErrors?.current}
        />
        {state?.fieldErrors?.current ? (
          <p className="text-destructive text-xs">
            {state.fieldErrors.current}
          </p>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="next">New password</Label>
          <Input
            id="next"
            name="next"
            type="password"
            required
            autoComplete="new-password"
            aria-invalid={!!state?.fieldErrors?.next}
          />
          {state?.fieldErrors?.next ? (
            <p className="text-destructive text-xs">
              {state.fieldErrors.next}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirm">Confirm</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            required
            autoComplete="new-password"
            aria-invalid={!!state?.fieldErrors?.confirm}
          />
          {state?.fieldErrors?.confirm ? (
            <p className="text-destructive text-xs">
              {state.fieldErrors.confirm}
            </p>
          ) : null}
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        At least 8 characters. Hashed with bcrypt cost 12.
      </p>
      <div className="flex justify-end">
        <Submit />
      </div>
    </form>
  );
}
