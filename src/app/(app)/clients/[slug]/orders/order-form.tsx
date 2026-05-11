"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { format } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createOrderAction, type OrderActionState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Saving…" : "Save order"}
    </Button>
  );
}

export function OrderForm({ clientId }: { clientId: string }) {
  const [state, formAction] = useActionState<OrderActionState, FormData>(
    createOrderAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      toast.success("Order added.");
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form action={formAction} className="grid gap-3" ref={formRef}>
      <input type="hidden" name="clientId" value={clientId} />
      <div className="grid gap-1.5">
        <Label htmlFor="occurredAt">Date</Label>
        <Input
          id="occurredAt"
          name="occurredAt"
          type="date"
          defaultValue={format(new Date(), "yyyy-MM-dd")}
          required
          aria-invalid={!!state?.fieldErrors?.occurredAt}
        />
        {state?.fieldErrors?.occurredAt ? (
          <p className="text-destructive text-xs">
            {state.fieldErrors.occurredAt}
          </p>
        ) : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="value">Value</Label>
        <Input
          id="value"
          name="value"
          type="number"
          step="0.01"
          min="0"
          required
          placeholder="142.00"
          aria-invalid={!!state?.fieldErrors?.value}
        />
        {state?.fieldErrors?.value ? (
          <p className="text-destructive text-xs">
            {state.fieldErrors.value}
          </p>
        ) : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="reference">Reference (optional)</Label>
        <Input
          id="reference"
          name="reference"
          placeholder="ORDER-123"
          autoComplete="off"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Input
          id="notes"
          name="notes"
          placeholder="Phone order"
          autoComplete="off"
        />
      </div>
      <Submit />
    </form>
  );
}
