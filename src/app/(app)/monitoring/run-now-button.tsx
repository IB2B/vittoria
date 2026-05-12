"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { runMonitoringNowAction } from "./actions";

export function RunNowButton() {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      disabled={pending}
      onClick={() => {
        start(async () => {
          const res = await runMonitoringNowAction();
          if (!res.ok) {
            toast.error(res.error ?? "Run failed");
            return;
          }
          toast.success(
            `Done. ${res.alertsCreated ?? 0} new alert(s), ${res.alertsRefreshed ?? 0} refreshed.`,
          );
          router.refresh();
        });
      }}
    >
      <Sparkles className="size-3.5" />
      {pending ? "Sweeping…" : "Run sweep now"}
    </Button>
  );
}
