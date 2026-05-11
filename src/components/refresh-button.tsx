"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import {
  refreshClientAction,
  type RefreshState,
} from "@/app/(app)/clients/[slug]/refresh-action";

function Inner() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      <RefreshCw className={pending ? "size-3.5 animate-spin" : "size-3.5"} />
      {pending ? "Refreshing…" : "Refresh"}
    </Button>
  );
}

export function RefreshButton({
  slug,
  preset,
}: {
  slug: string;
  preset: string;
}) {
  const [state, action] = useActionState<RefreshState, FormData>(
    refreshClientAction,
    {},
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) toast.success("Insights refreshed.");
  }, [state]);

  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="preset" value={preset} />
      <Inner />
    </form>
  );
}
