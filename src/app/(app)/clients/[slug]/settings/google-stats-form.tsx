"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { format, startOfMonth } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  upsertGoogleStatAction,
  type GoogleStatState,
} from "./google-actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save Google Ads totals"}
    </Button>
  );
}

export function GoogleStatsForm({ clientId }: { clientId: string }) {
  const [state, action] = useActionState<GoogleStatState, FormData>(
    upsertGoogleStatAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      toast.success("Google Ads totals saved.");
      formRef.current?.reset();
    }
  }, [state]);

  const today = new Date();
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const todayStr = format(today, "yyyy-MM-dd");

  return (
    <form action={action} className="grid gap-3" ref={formRef}>
      <input type="hidden" name="clientId" value={clientId} />
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="rangeStart" className="text-xs">From</Label>
          <Input
            id="rangeStart"
            name="rangeStart"
            type="date"
            required
            defaultValue={monthStart}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rangeEnd" className="text-xs">To</Label>
          <Input
            id="rangeEnd"
            name="rangeEnd"
            type="date"
            required
            defaultValue={todayStr}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="spend" className="text-xs">Spend</Label>
          <Input id="spend" name="spend" type="number" step="0.01" min="0" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="revenue" className="text-xs">Revenue</Label>
          <Input id="revenue" name="revenue" type="number" step="0.01" min="0" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="impressions" className="text-xs">Impressions</Label>
          <Input id="impressions" name="impressions" type="number" min="0" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="clicks" className="text-xs">Clicks</Label>
          <Input id="clicks" name="clicks" type="number" min="0" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="conversions" className="text-xs">Conversions</Label>
          <Input id="conversions" name="conversions" type="number" min="0" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="currency" className="text-xs">Currency</Label>
          <Input id="currency" name="currency" defaultValue="EUR" maxLength={3} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="notes" className="text-xs">Notes</Label>
        <Input id="notes" name="notes" placeholder="From Google Ads UI · campaign name" />
      </div>
      <Submit />
    </form>
  );
}
