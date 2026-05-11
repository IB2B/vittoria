"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  KeyRound,
  Link as LinkIcon,
  Pencil,
  Pin,
  Trash2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  deleteLibraryItemAction,
  revealCredentialAction,
  toggleLibraryPinAction,
} from "./actions";
import { LibraryForm } from "./library-form";

type Item = {
  id: string;
  type: "NOTE" | "CREDENTIAL" | "LINK";
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

const TYPE_ICON = {
  NOTE: FileText,
  CREDENTIAL: KeyRound,
  LINK: LinkIcon,
};

const TYPE_TINT = {
  NOTE: "var(--brand)",
  CREDENTIAL: "#F59E0B",
  LINK: "var(--meta)",
};

export function LibraryItemCard({
  item,
  clientId,
  slug,
  canMutate,
}: {
  item: Item;
  clientId: string;
  slug: string;
  canMutate: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [revealing, startReveal] = useTransition();
  const [busy, startBusy] = useTransition();

  const Icon = TYPE_ICON[item.type];
  const accent = TYPE_TINT[item.type];

  const reveal = () => {
    startReveal(async () => {
      const res = await revealCredentialAction(item.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setRevealed(res.value ?? "");
    });
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard.");
  };

  if (editing) {
    return (
      <div className="glass rounded-xl p-4">
        <LibraryForm
          clientId={clientId}
          slug={slug}
          initial={item}
          onDone={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="glass group/item relative overflow-hidden rounded-xl p-4">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: accent }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md"
            style={{
              background: `color-mix(in oklab, ${accent} 15%, transparent)`,
              color: accent,
            }}
          >
            <Icon className="size-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-sm font-semibold">{item.title}</h3>
              {item.pinned ? (
                <Pin className="size-3 shrink-0 fill-amber-400 text-amber-400" />
              ) : null}
            </div>
            <div className="text-muted-foreground mt-0.5 text-[10px] uppercase tracking-wide">
              {item.type.toLowerCase()} ·{" "}
              {formatDistanceToNow(new Date(item.updatedAt), {
                addSuffix: true,
              })}
            </div>
          </div>
        </div>
        {canMutate ? (
          <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover/item:opacity-100">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => {
                const fd = new FormData();
                fd.set("itemId", item.id);
                fd.set("slug", slug);
                startBusy(() => toggleLibraryPinAction(fd));
              }}
              disabled={busy}
              title={item.pinned ? "Unpin" : "Pin"}
            >
              <Pin className={`size-3.5 ${item.pinned ? "fill-current" : ""}`} />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setEditing(true)}
              title="Edit"
            >
              <Pencil className="size-3.5" />
            </Button>
            <form
              action={(fd) => startBusy(() => deleteLibraryItemAction(fd))}
            >
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="slug" value={slug} />
              <Button
                type="submit"
                size="icon-sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={busy}
                title="Delete"
                onClick={(e) => {
                  if (!confirm(`Delete "${item.title}"?`)) e.preventDefault();
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </form>
          </div>
        ) : null}
      </div>

      <div className="mt-3">
        {item.type === "CREDENTIAL" ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-md border border-dashed border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/20 p-2">
              <KeyRound className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              {revealed != null ? (
                <pre className="flex-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs">
                  {revealed || <span className="italic text-muted-foreground">empty</span>}
                </pre>
              ) : (
                <span className="text-muted-foreground flex-1 font-mono text-xs">
                  ••••••••••••••
                </span>
              )}
              {revealed != null ? (
                <>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => copy(revealed)}
                    title="Copy"
                  >
                    <Copy className="size-3.5" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setRevealed(null)}
                    title="Hide"
                  >
                    <EyeOff className="size-3.5" />
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={reveal}
                  disabled={revealing}
                >
                  <Eye className="size-3.5" />
                  {revealing ? "Revealing…" : "Reveal"}
                </Button>
              )}
            </div>
          </div>
        ) : item.type === "LINK" ? (
          <div className="flex items-center gap-2 rounded-md border bg-card/40 p-2 font-mono text-xs">
            <LinkIcon className="text-meta size-3.5 shrink-0" />
            {/^https?:\/\//.test(item.body) ? (
              <Link
                href={item.body}
                target="_blank"
                rel="noopener noreferrer"
                className="text-meta truncate flex-1 hover:underline"
              >
                {item.body}
              </Link>
            ) : (
              <span className="truncate flex-1">{item.body || "—"}</span>
            )}
            {item.body ? (
              <>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => copy(item.body)}
                  title="Copy URL"
                >
                  <Copy className="size-3.5" />
                </Button>
                {/^https?:\/\//.test(item.body) ? (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    nativeButton={false}
                    render={
                      <Link
                        href={item.body}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                    title="Open"
                  >
                    <ExternalLink className="size-3.5" />
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {item.body || <span className="text-muted-foreground italic">No content.</span>}
          </p>
        )}
      </div>

      {item.tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {item.tags.map((t) => (
            <Badge key={t} variant="outline" className="text-[10px]">
              {t}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="text-muted-foreground mt-2 text-[10px]">
        Created {format(new Date(item.createdAt), "MMM d, yyyy")}
      </div>
    </div>
  );
}
