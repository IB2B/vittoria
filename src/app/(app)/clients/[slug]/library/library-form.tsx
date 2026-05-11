"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { FileText, KeyRound, Link as LinkIcon, Pin, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  createLibraryItemAction,
  updateLibraryItemAction,
  type LibraryState,
} from "./actions";

type Type = "NOTE" | "CREDENTIAL" | "LINK";

type ExistingItem = {
  id: string;
  type: Type;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
};

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (editing ? "Saving…" : "Adding…") : editing ? "Save" : "Add"}
    </Button>
  );
}

const TYPE_META: Record<Type, { label: string; icon: React.ElementType; placeholder: string }> = {
  NOTE: {
    label: "Note",
    icon: FileText,
    placeholder: "Anything you want to remember about this client — brand voice, audience targeting, internal decisions…",
  },
  CREDENTIAL: {
    label: "Credential",
    icon: KeyRound,
    placeholder: "Username + password, or paste the full secret. Encrypted at rest with AES-256-GCM.",
  },
  LINK: {
    label: "Link",
    icon: LinkIcon,
    placeholder: "https://drive.google.com/...",
  },
};

export function LibraryForm({
  clientId,
  slug,
  initial,
  onDone,
}: {
  clientId: string;
  slug: string;
  initial?: ExistingItem;
  onDone?: () => void;
}) {
  const editing = !!initial;
  const action = editing ? updateLibraryItemAction : createLibraryItemAction;
  const [state, formAction] = useActionState<LibraryState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  const [type, setType] = useState<Type>(initial?.type ?? "NOTE");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [pinned, setPinned] = useState(initial?.pinned ?? false);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      toast.success(editing ? "Updated." : "Added.");
      if (!editing) {
        formRef.current?.reset();
        setTitle("");
        setBody("");
        setTags("");
        setPinned(false);
        setType("NOTE");
      }
      onDone?.();
    }
  }, [state, editing, onDone]);

  const meta = TYPE_META[type];
  const Icon = meta.icon;

  return (
    <form action={formAction} ref={formRef} className="grid gap-3">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="slug" value={slug} />
      {editing ? (
        <input type="hidden" name="itemId" value={initial!.id} />
      ) : null}
      <input type="hidden" name="pinned" value={pinned ? "true" : "false"} />

      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(TYPE_META) as Type[]).map((t) => {
          const M = TYPE_META[t];
          const I = M.icon;
          const active = type === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all ${
                active
                  ? "border-[var(--brand)] bg-[color-mix(in_oklab,var(--brand)_15%,transparent)] text-foreground"
                  : "border-border/70 bg-card/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              <I className="size-3" />
              {M.label}
            </button>
          );
        })}
        <input type="hidden" name="type" value={type} />
        <button
          type="button"
          onClick={() => setPinned((p) => !p)}
          className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all ${
            pinned
              ? "border-amber-400 bg-amber-400/15 text-amber-700 dark:text-amber-300"
              : "border-border/70 text-muted-foreground hover:text-foreground"
          }`}
        >
          <Pin className={`size-3 ${pinned ? "fill-current" : ""}`} />
          {pinned ? "Pinned" : "Pin"}
        </button>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="library-title" className="text-xs">
          Title
        </Label>
        <Input
          id="library-title"
          name="title"
          required
          autoComplete="off"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            type === "CREDENTIAL"
              ? "Meta Business Manager admin login"
              : type === "LINK"
                ? "Brand asset drive"
                : "Brand voice guidelines"
          }
          aria-invalid={!!state?.fieldErrors?.title}
        />
        {state?.fieldErrors?.title ? (
          <p className="text-destructive text-xs">
            {state.fieldErrors.title}
          </p>
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="library-body" className="text-xs">
          {type === "LINK" ? "URL" : type === "CREDENTIAL" ? "Secret" : "Body"}
        </Label>
        {type === "LINK" ? (
          <Input
            id="library-body"
            name="body"
            value={body}
            type="url"
            onChange={(e) => setBody(e.target.value)}
            placeholder={meta.placeholder}
            autoComplete="off"
          />
        ) : (
          <textarea
            id="library-body"
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={type === "NOTE" ? 6 : 3}
            placeholder={meta.placeholder}
            className="border-input bg-card/50 placeholder:text-muted-foreground focus-visible:ring-[var(--brand)] focus-visible:ring-[3px] focus-visible:border-[var(--brand)] focus-visible:outline-none rounded-lg border px-3 py-2 text-sm font-mono backdrop-blur-sm"
            autoComplete="off"
            spellCheck={type === "NOTE"}
          />
        )}
        {type === "CREDENTIAL" ? (
          <p className="text-muted-foreground text-[11px]">
            <Icon className="inline size-3" /> Encrypted at rest with AES-256-GCM. Revealing logs an audit entry.
          </p>
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="library-tags" className="text-xs">
          Tags (comma-separated)
        </Label>
        <Input
          id="library-tags"
          name="tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="brand, onboarding, drive"
          autoComplete="off"
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        {editing && onDone ? (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
        <SubmitButton editing={editing} />
      </div>
    </form>
  );
}

export function NewLibraryItem({
  clientId,
  slug,
}: {
  clientId: string;
  slug: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      {open ? (
        <div className="glass rounded-xl p-4">
          <LibraryForm
            clientId={clientId}
            slug={slug}
            onDone={() => setOpen(false)}
          />
        </div>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          New item
        </Button>
      )}
    </div>
  );
}
