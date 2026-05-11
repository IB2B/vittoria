"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  createOrderAction,
  type OrderActionState,
} from "@/app/(app)/clients/[slug]/orders/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm" className="w-full">
      {pending ? "Saving…" : "Add order"}
    </Button>
  );
}

export function QuickAddOrder({
  clientId,
  currency,
}: {
  slug: string;
  clientId: string;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<OrderActionState, FormData>(
    createOrderAction,
    {},
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      toast.success("Backend order added.");
      setOpen(false);
    }
  }, [state]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <Plus className="size-3.5" />
            Adjust revenue
          </Button>
        }
      />
      <PopoverContent className="w-72 space-y-3">
        <div>
          <p className="text-sm font-medium">Add untracked order</p>
          <p className="text-muted-foreground text-xs">
            Adjusts Real Revenue + Real ROAS for the period that contains this
            date.
          </p>
        </div>
        <form action={action} className="grid gap-2">
          <input type="hidden" name="clientId" value={clientId} />
          <div className="grid gap-1">
            <Label htmlFor="qao-date" className="text-xs">
              Date
            </Label>
            <Input
              id="qao-date"
              name="occurredAt"
              type="date"
              defaultValue={format(new Date(), "yyyy-MM-dd")}
              required
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="qao-value" className="text-xs">
              Value ({currency})
            </Label>
            <Input
              id="qao-value"
              name="value"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="200.00"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="qao-notes" className="text-xs">
              Notes
            </Label>
            <Input
              id="qao-notes"
              name="notes"
              placeholder="Phone order"
            />
          </div>
          <Submit />
        </form>
      </PopoverContent>
    </Popover>
  );
}
