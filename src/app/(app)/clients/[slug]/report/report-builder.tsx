"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  CheckCircle2,
  Download,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { startReportAction } from "./actions";

type ToneOpt = "bad" | "warn" | "good" | "meta" | "brand";
type Priority = {
  tone: ToneOpt;
  tag: string;
  title: string;
  body: string;
};

const DEFAULT_PRIORITIES: Priority[] = [
  {
    tone: "bad",
    tag: "P1",
    title: "Audit del tracciamento",
    body: "Verifica pixel Meta + Conversion Tracking Google. Eventi Purchase, AddToCart, Initiate Checkout.",
  },
  {
    tone: "good",
    tag: "P2",
    title: "Scaling canale migliore",
    body: "Aumenta budget del canale con ROAS più alto, mantenendo struttura e creatività.",
  },
];

type BuildStatus = {
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
  progress: number;
  phase: string | null;
  error: string | null;
  download_url: string | null;
};

export function ReportBuilder({
  clientId,
  slug,
  rangeStart,
  rangeEnd,
  preset,
}: {
  clientId: string;
  slug: string;
  rangeStart: string;
  rangeEnd: string;
  preset: string;
}) {
  const [language, setLanguage] = useState<"it" | "en">("it");
  const [start, setStart] = useState(rangeStart);
  const [end, setEnd] = useState(rangeEnd);
  const [contextNote, setContextNote] = useState("");
  const [priorities, setPriorities] = useState<Priority[]>(DEFAULT_PRIORITIES);
  const [isSubmitting, startSubmit] = useTransition();
  const [reportId, setReportId] = useState<string | null>(null);
  const [build, setBuild] = useState<BuildStatus | null>(null);

  // Persist reportId in localStorage so the user can navigate away and come
  // back to find their build still running.
  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem(`vittoria_report_${slug}`)
        : null;
    if (stored && !reportId) setReportId(stored);
  }, [reportId, slug]);

  // Poll status until DONE/FAILED.
  const pollRef = useRef<number | null>(null);
  useEffect(() => {
    if (!reportId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/reports/${reportId}/status`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (res.status === 404) {
            window.localStorage.removeItem(`vittoria_report_${slug}`);
            setReportId(null);
            setBuild(null);
            return;
          }
          throw new Error(`status ${res.status}`);
        }
        const data = (await res.json()) as BuildStatus;
        if (cancelled) return;
        setBuild(data);
        if (data.status === "DONE" || data.status === "FAILED") {
          if (pollRef.current) {
            window.clearInterval(pollRef.current);
            pollRef.current = null;
          }
          if (data.status === "DONE") {
            toast.success("Report ready.", {
              description: "Click Download below.",
            });
          } else {
            toast.error(`Report failed: ${data.error ?? "unknown"}`);
          }
        }
      } catch (err) {
        if (cancelled) return;
        console.warn("[report] poll error", err);
      }
    };
    poll();
    pollRef.current = window.setInterval(poll, 2000);
    return () => {
      cancelled = true;
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [reportId, slug]);

  const updatePriority = (idx: number, patch: Partial<Priority>) => {
    setPriorities((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    );
  };
  const addPriority = () => {
    setPriorities((prev) => [
      ...prev,
      { tone: "brand", tag: `P${prev.length + 1}`, title: "", body: "" },
    ]);
  };
  const removePriority = (idx: number) => {
    setPriorities((prev) => prev.filter((_, i) => i !== idx));
  };

  const onSubmit = () => {
    const fd = new FormData();
    fd.set("clientId", clientId);
    fd.set("slug", slug);
    fd.set("rangeStart", start);
    fd.set("rangeEnd", end);
    fd.set("language", language);
    fd.set("contextNote", contextNote);
    fd.set("priorities", JSON.stringify(priorities));
    startSubmit(async () => {
      const res = await startReportAction(undefined, fd);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.reportId) {
        window.localStorage.setItem(`vittoria_report_${slug}`, res.reportId);
        setReportId(res.reportId);
        setBuild({
          status: "PENDING",
          progress: 0,
          phase: "Queued",
          error: null,
          download_url: null,
        });
        toast.success("Vittoria is building your report.", {
          description: "You can leave this page — we'll keep going.",
        });
      }
    });
  };

  const reset = () => {
    window.localStorage.removeItem(`vittoria_report_${slug}`);
    setReportId(null);
    setBuild(null);
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base">Report builder</CardTitle>
        <CardDescription>
          Period {rangeStart} → {rangeEnd} (preset: {preset}). Vittoria reads
          your cached insights, writes the executive summary + recommendations,
          and packages the .docx in the background.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {build ? (
          <BuildStatusPanel
            build={build}
            reportId={reportId}
            onReset={reset}
          />
        ) : (
          <BuildForm
            start={start}
            end={end}
            setStart={setStart}
            setEnd={setEnd}
            language={language}
            setLanguage={setLanguage}
            contextNote={contextNote}
            setContextNote={setContextNote}
            priorities={priorities}
            updatePriority={updatePriority}
            addPriority={addPriority}
            removePriority={removePriority}
            isSubmitting={isSubmitting}
            onSubmit={onSubmit}
          />
        )}
      </CardContent>
    </Card>
  );
}

function BuildStatusPanel({
  build,
  reportId,
  onReset,
}: {
  build: BuildStatus;
  reportId: string | null;
  onReset: () => void;
}) {
  const isRunning = build.status === "PENDING" || build.status === "RUNNING";
  const isDone = build.status === "DONE";
  const isFailed = build.status === "FAILED";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {isDone ? (
          <CheckCircle2 className="size-5 text-emerald-600" />
        ) : isFailed ? (
          <XCircle className="text-destructive size-5" />
        ) : (
          <Sparkles className="text-meta size-5 animate-pulse" />
        )}
        <div>
          <div className="text-sm font-medium">
            {isDone
              ? "Report ready"
              : isFailed
                ? "Build failed"
                : "Vittoria is building your report"}
          </div>
          <div className="text-muted-foreground text-xs">
            {build.phase ?? (isRunning ? "Working…" : "")}
          </div>
        </div>
      </div>

      <div className="bg-muted/60 relative h-2 w-full overflow-hidden rounded-full">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
          style={{
            width: `${isFailed ? 100 : build.progress}%`,
            background: isFailed
              ? "var(--destructive)"
              : "linear-gradient(90deg, var(--brand), color-mix(in oklab, var(--brand) 50%, white))",
          }}
        />
      </div>

      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span>{Math.max(0, Math.min(100, build.progress))}%</span>
        <span>
          {isRunning
            ? "You can leave this page — Vittoria will finish in the background."
            : isDone
              ? "Click Download to save the .docx."
              : null}
        </span>
      </div>

      {isFailed && build.error ? (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-xs">
          {build.error}
        </div>
      ) : null}

      <div className="flex gap-2">
        {isDone && reportId ? (
          <a
            href={`/api/reports/${reportId}/download`}
            download
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium text-primary-foreground"
            style={{
              background:
                "linear-gradient(135deg, var(--brand) 0%, color-mix(in oklab, var(--brand) 75%, white) 100%)",
              boxShadow:
                "0 2px 8px -2px color-mix(in oklab, var(--brand) 50%, transparent)",
            }}
          >
            <Download className="size-4" />
            Download .docx
          </a>
        ) : null}
        <Button variant="outline" onClick={onReset} disabled={isRunning}>
          {isDone ? "New report" : isFailed ? "Try again" : "Cancel"}
        </Button>
      </div>
    </div>
  );
}

function BuildForm({
  start,
  end,
  setStart,
  setEnd,
  language,
  setLanguage,
  contextNote,
  setContextNote,
  priorities,
  updatePriority,
  addPriority,
  removePriority,
  isSubmitting,
  onSubmit,
}: {
  start: string;
  end: string;
  setStart: (s: string) => void;
  setEnd: (s: string) => void;
  language: "it" | "en";
  setLanguage: (l: "it" | "en") => void;
  contextNote: string;
  setContextNote: (s: string) => void;
  priorities: Priority[];
  updatePriority: (i: number, p: Partial<Priority>) => void;
  addPriority: () => void;
  removePriority: (i: number) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="rangeStart" className="text-xs">
            From
          </Label>
          <Input
            id="rangeStart"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rangeEnd" className="text-xs">
            To
          </Label>
          <Input
            id="rangeEnd"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs">Language</Label>
        <Select
          value={language}
          onValueChange={(v) => {
            if (v === "it" || v === "en") setLanguage(v);
          }}
        >
          <SelectTrigger>
            <SelectValue>
              {(v) => (v === "en" ? "English" : "Italiano")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="it">Italiano</SelectItem>
            <SelectItem value="en">English</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="note" className="text-xs">
          Context note (optional)
        </Label>
        <textarea
          id="note"
          value={contextNote}
          onChange={(e) => setContextNote(e.target.value)}
          rows={3}
          placeholder="Anything Vittoria should keep in mind for this report."
          className="border-input bg-card/50 placeholder:text-muted-foreground focus-visible:ring-ring rounded-lg border px-3 py-2 text-sm focus-visible:ring-3 focus-visible:outline-none"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Priorities</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addPriority}
          >
            <Plus className="size-3" /> Add
          </Button>
        </div>
        <div className="space-y-3">
          {priorities.map((pr, i) => (
            <div key={i} className="space-y-2 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Select
                  value={pr.tone}
                  onValueChange={(v) => {
                    if (
                      v === "bad" ||
                      v === "warn" ||
                      v === "good" ||
                      v === "meta" ||
                      v === "brand"
                    )
                      updatePriority(i, { tone: v });
                  }}
                >
                  <SelectTrigger className="w-[110px]">
                    <SelectValue>
                      {(v) =>
                        ({
                          bad: "Critical",
                          warn: "Warning",
                          good: "Good",
                          meta: "In progress",
                          brand: "Brand",
                        })[v as string] ?? "Tone"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bad">Critical</SelectItem>
                    <SelectItem value="warn">Warning</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="meta">In progress</SelectItem>
                    <SelectItem value="brand">Brand</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={pr.tag}
                  onChange={(e) =>
                    updatePriority(i, { tag: e.target.value })
                  }
                  placeholder="Tag"
                  className="w-24"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removePriority(i)}
                  className="text-destructive ml-auto"
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
              <Input
                value={pr.title}
                onChange={(e) =>
                  updatePriority(i, { title: e.target.value })
                }
                placeholder="Title"
              />
              <textarea
                value={pr.body}
                onChange={(e) =>
                  updatePriority(i, { body: e.target.value })
                }
                rows={2}
                placeholder="Body"
                className="border-input bg-card/50 placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-sm focus-visible:ring-3 focus-visible:outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      <Button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting}
        className="w-full"
      >
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Sparkles className="size-4" />
        )}
        {isSubmitting ? "Queueing…" : "Generate report"}
      </Button>
    </>
  );
}
