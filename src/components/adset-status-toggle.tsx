"use client";

import { useState, useTransition } from "react";
import { Pause, Play } from "lucide-react";
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

import { setAdSetStatusAction } from "@/app/(app)/clients/[slug]/adsets/actions";

export function AdSetStatusToggle({
  clientId,
  slug,
  adSetId,
  adSetName,
  effectiveStatus,
}: {
  clientId: string;
  slug: string;
  adSetId: string;
  adSetName: string;
  effectiveStatus?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const isActive =
    !effectiveStatus ||
    effectiveStatus === "ACTIVE" ||
    effectiveStatus === "IN_PROCESS" ||
    effectiveStatus === "WITH_ISSUES";
  const next = isActive ? "PAUSED" : "ACTIVE";

  const apply = () => {
    const fd = new FormData();
    fd.set("clientId", clientId);
    fd.set("slug", slug);
    fd.set("adSetId", adSetId);
    fd.set("status", next);
    start(async () => {
      const res = await setAdSetStatusAction(undefined, fd);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(
          next === "PAUSED" ? `Paused ${adSetName}` : `Activated ${adSetName}`,
        );
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            title={isActive ? "Pause" : "Activate"}
            className={
              isActive
                ? "text-muted-foreground hover:text-amber-600"
                : "text-muted-foreground hover:text-emerald-600"
            }
          />
        }
      >
        {isActive ? (
          <Pause className="size-3.5" />
        ) : (
          <Play className="size-3.5" />
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isActive ? "Pause" : "Activate"} this ad set?
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium">{adSetName}</span> will be{" "}
            {isActive ? "paused" : "set to active"} on Meta immediately.
            Audit-logged.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={apply} disabled={pending}>
            {pending
              ? "Working…"
              : isActive
                ? "Pause ad set"
                : "Activate ad set"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
