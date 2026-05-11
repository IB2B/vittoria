"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Pencil } from "lucide-react";
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

import { editBmAction, type EditState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

export function EditBmButton({
  currentBusinessId,
  currentName,
  isUnassigned,
}: {
  currentBusinessId: string;
  currentName: string;
  isUnassigned: boolean;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<EditState, FormData>(
    editBmAction,
    {},
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      toast.success(
        `Updated ${state.updated ?? 0} ad account${state.updated === 1 ? "" : "s"}.`,
      );
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Pencil className="size-3.5" />
            {isUnassigned ? "Name this BM" : "Edit"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isUnassigned ? "Name this Business Manager" : "Edit Business Manager"}
          </DialogTitle>
          <DialogDescription>
            {isUnassigned
              ? "These ad accounts were imported before BM tracking was added. Give them a name to make this a real BM you can disconnect or filter on."
              : "Rename or correct the Meta BM ID."}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
          <input
            type="hidden"
            name="currentBusinessId"
            value={currentBusinessId}
          />
          <div className="grid gap-2">
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={isUnassigned ? "" : currentName}
              autoFocus
              required
              autoComplete="off"
              placeholder="e.g. Main B2B BM"
              aria-invalid={!!state?.fieldErrors?.name}
            />
            {state?.fieldErrors?.name ? (
              <p className="text-destructive text-xs">
                {state.fieldErrors.name}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="newBusinessId">
              Meta BM ID <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="newBusinessId"
              name="newBusinessId"
              autoComplete="off"
              placeholder={
                isUnassigned ? "Leave blank to auto-generate" : currentBusinessId
              }
              aria-invalid={!!state?.fieldErrors?.newBusinessId}
            />
            <p className="text-muted-foreground text-xs">
              {isUnassigned
                ? "Leave blank and we'll mint a synthetic ID. Paste your Meta BM ID if you have it."
                : "Leave blank to keep the current ID."}
            </p>
            {state?.fieldErrors?.newBusinessId ? (
              <p className="text-destructive text-xs">
                {state.fieldErrors.newBusinessId}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Submit />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
