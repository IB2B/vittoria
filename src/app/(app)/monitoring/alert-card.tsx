"use client";

import { useTransition } from "react";
import Link from "next/link";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowUpRight,
  Check,
  ChevronUp,
  Eye,
  EyeOff,
  Info,
  Sparkles,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { transitionAlertAction } from "./actions";

type Alert = {
  id: string;
  clientId: string;
  clientName: string;
  clientSlug: string;
  category: string;
  campaignName?: string | null;
  title: string;
  description: string;
  suggestion: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  metrics: Record<string, unknown>;
  detectedAt: string;
  resolvedAt: string | null;
};

// Severity → visual scheme. CRITICAL gets a red border, HIGH amber, etc.
const SEVERITY: Record<
  Alert["severity"],
  { label: string; tint: string; icon: React.ElementType }
> = {
  CRITICAL: {
    label: "Critical",
    tint: "239 68 68", // tailwind red-500
    icon: AlertOctagon,
  },
  HIGH: {
    label: "High",
    tint: "245 158 11", // amber-500
    icon: AlertTriangle,
  },
  MEDIUM: {
    label: "Medium",
    tint: "59 130 246", // blue-500
    icon: Activity,
  },
  LOW: {
    label: "Low",
    tint: "16 185 129", // emerald-500
    icon: Info,
  },
  INFO: {
    label: "Info",
    tint: "100 116 139", // slate-500
    icon: Info,
  },
};

export function AlertCard({ alert }: { alert: Alert }) {
  const [pending, startTransition] = useTransition();
  const meta = SEVERITY[alert.severity];
  const Icon = meta.icon;
  const isOpen = alert.status === "OPEN";

  const transition = (status: "RESOLVED" | "DISMISSED" | "OPEN") => {
    const fd = new FormData();
    fd.set("alertId", alert.id);
    fd.set("status", status);
    startTransition(async () => {
      const res = await transitionAlertAction(undefined, fd);
      if (res.error) toast.error(res.error);
      else
        toast.success(
          status === "RESOLVED"
            ? "Marked resolved."
            : status === "DISMISSED"
              ? "Dismissed."
              : "Reopened.",
        );
    });
  };

  const aiRefined = alert.suggestion.startsWith("✦");
  const suggestionText = aiRefined
    ? alert.suggestion.slice(1).trim()
    : alert.suggestion;

  return (
    <div
      className={`glass relative overflow-hidden rounded-xl border border-l-4 p-5 transition-opacity ${
        isOpen ? "" : "opacity-60"
      }`}
      style={{ borderLeftColor: `rgb(${meta.tint})` }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-12 size-40 rounded-full opacity-25 blur-2xl"
        style={{ background: `rgb(${meta.tint} / 0.4)` }}
      />
      <div className="relative flex flex-col gap-3">
        {/* HEADER */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span
              className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md"
              style={{
                background: `rgb(${meta.tint} / 0.15)`,
                color: `rgb(${meta.tint})`,
              }}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold tracking-tight">
                {alert.title}
              </h3>
              <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-[11px]">
                <Link
                  href={`/clients/${alert.clientSlug}`}
                  className="hover:text-foreground hover:underline"
                >
                  {alert.clientName}
                </Link>
                <span>·</span>
                <span>
                  {formatDistanceToNow(new Date(alert.detectedAt), {
                    addSuffix: true,
                  })}
                </span>
                {alert.campaignName ? (
                  <>
                    <span>·</span>
                    <span className="truncate">{alert.campaignName}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
          <Badge
            variant="outline"
            className="shrink-0 uppercase tracking-wider"
            style={{
              borderColor: `rgb(${meta.tint} / 0.4)`,
              color: `rgb(${meta.tint})`,
            }}
          >
            {meta.label}
          </Badge>
        </div>

        {/* DESCRIPTION */}
        <p className="text-sm leading-relaxed">{alert.description}</p>

        {/* AI SUGGESTION */}
        <div className="bg-card/40 rounded-md border p-3">
          <div className="text-muted-foreground mb-1 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
            {aiRefined ? (
              <>
                <Sparkles className="text-meta size-3" />
                Vittoria&apos;s read
              </>
            ) : (
              "Suggested fix"
            )}
          </div>
          <p className="text-sm leading-relaxed">{suggestionText}</p>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Link
            href={`/clients/${alert.clientSlug}`}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
          >
            Open client <ArrowUpRight className="size-3" />
          </Link>
          <div className="flex gap-2">
            {isOpen ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => transition("DISMISSED")}
                  disabled={pending}
                >
                  <EyeOff className="size-3.5" />
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  onClick={() => transition("RESOLVED")}
                  disabled={pending}
                >
                  <Check className="size-3.5" />
                  Mark done
                </Button>
              </>
            ) : (
              <>
                <Badge variant="ghost" className="text-[10px]">
                  {alert.status.toLowerCase()}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => transition("OPEN")}
                  disabled={pending}
                >
                  <Eye className="size-3.5" />
                  Reopen
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RunNowButton({ onRun }: { onRun: () => void }) {
  return (
    <Button onClick={onRun}>
      <ChevronUp className="size-3.5" />
      Run sweep now
    </Button>
  );
}

// Stub export to keep the import-style consistent if we ever swap.
export const _AlertCardX = AlertCard;
