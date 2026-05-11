"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  disconnectBmAction,
  type DisconnectState,
} from "./actions";

function ConfirmSubmit({
  enabled,
}: {
  enabled: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="destructive"
      disabled={!enabled || pending}
    >
      {pending ? "Disconnecting…" : "Disconnect & delete"}
    </Button>
  );
}

export function DisconnectButton({
  businessId,
  businessName,
  clientCount,
}: {
  businessId: string;
  businessName: string;
  clientCount: number;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<DisconnectState, FormData>(
    disconnectBmAction,
    {},
  );
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      toast.success(
        `Disconnected. Removed ${state.deletedClients ?? 0} client(s)${
          state.detachedAccounts
            ? `, detached ${state.detachedAccounts} ad account(s) from shared clients`
            : ""
        }.`,
      );
      setOpen(false);
      setConfirm("");
      router.refresh();
    }
  }, [state, router]);

  const enabled = confirm === businessName;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="destructive" size="sm">
            <Trash2 className="size-3.5" />
            Disconnect
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="text-destructive size-5" />
            Disconnect {businessName}?
          </DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{clientCount} client(s)</strong>
            {" "}plus all their cached insights, manual orders, reports, and
            Google Ads totals. Clients that also belong to another BM will be
            kept (only this BM&apos;s ad accounts will be detached).
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="businessId" value={businessId} />
          <div className="grid gap-2">
            <Label htmlFor="confirm">
              Type <code className="bg-muted rounded px-1 font-mono">{businessName}</code> to confirm
            </Label>
            <Input
              id="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <ConfirmSubmit enabled={enabled} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
