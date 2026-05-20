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

import { setCampaignStatusAction } from "@/app/(app)/clients/[slug]/campaigns/actions";

// Inline pause/play button. Renders a tiny icon that opens a confirm dialog
// before flipping the campaign status. Admin-only — non-admins don't see
// this button at all (caller controls).
export function CampaignStatusToggle({
  clientId,
  slug,
  campaignId,
  campaignName,
  effectiveStatus,
}: {
  clientId: string;
  slug: string;
  campaignId: string;
  campaignName: string;
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
    fd.set("campaignId", campaignId);
    fd.set("status", next);
    start(async () => {
      const res = await setCampaignStatusAction(undefined, fd);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(
          next === "PAUSED"
            ? `Paused ${campaignName}`
            : `Activated ${campaignName}`,
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
            {isActive ? "Pause" : "Activate"} this campaign?
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium">{campaignName}</span> will be{" "}
            {isActive ? "paused" : "set to active"} on Meta immediately. The
            change is audit-logged. You can revert here anytime.
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
                ? "Pause campaign"
                : "Activate campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
