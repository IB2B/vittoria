"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Combine } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { mergeBmAction, type MergeState } from "./actions";

function Submit({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={!enabled || pending}>
      {pending ? "Merging…" : "Merge"}
    </Button>
  );
}

type Option = { id: string; name: string; clientCount: number };

export function MergeButton({
  currentBusinessId,
  currentName,
  options,
}: {
  currentBusinessId: string;
  currentName: string;
  options: Option[];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<MergeState, FormData>(
    mergeBmAction,
    {},
  );
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      toast.success(
        `Merged. Moved ${state.moved ?? 0} ad account${state.moved === 1 ? "" : "s"}.`,
      );
      setOpen(false);
      setTarget("");
      router.refresh();
    }
  }, [state, router]);

  if (options.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Combine className="size-3.5" />
            Merge
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge {currentName} into another BM</DialogTitle>
          <DialogDescription>
            Every ad account currently under <strong>{currentName}</strong>{" "}
            will be reassigned to the target BM. {currentName} disappears from
            the list. The Meta-side ownership doesn&apos;t change — this is
            purely how Vittoria groups them.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
          <input
            type="hidden"
            name="sourceBusinessId"
            value={currentBusinessId}
          />
          <input type="hidden" name="targetBusinessId" value={target} />
          <div className="grid gap-2">
            <Label>Target BM</Label>
            <Select value={target} onValueChange={(v) => setTarget(String(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a target BM…">
                  {(v) =>
                    options.find((o) => o.id === v)?.name ?? "Pick a target BM…"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}{" "}
                    <span className="text-muted-foreground">
                      · {o.clientCount} client{o.clientCount === 1 ? "" : "s"}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Submit enabled={target.length > 0} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
