"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useFormStatus } from "react-dom";
import { Clock, KeyRound, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import {
  assignUserAction,
  listBmDirectoryAction,
  removeUserAction,
  type AssignState,
  type BmDirectoryEntry,
} from "./team-actions";

const TASKS: { id: string; label: string; description: string }[] = [
  {
    id: "MANAGE",
    label: "Manage",
    description: "Full admin — edit campaigns, billing, assignments",
  },
  {
    id: "ADVERTISE",
    label: "Advertise",
    description: "Create + edit campaigns, no billing or assignments",
  },
  {
    id: "ANALYZE",
    label: "Analyze",
    description: "Read-only access to reports",
  },
];

type Assigned = {
  id: string;
  name: string;
  email?: string | null;
  tasks: string[];
};

function AddSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <UserPlus className="size-3.5" />
      {pending ? "Assigning…" : "Assign"}
    </Button>
  );
}

export function AccountAccessSection({
  adAccountId,
  metaAccountId,
  slug,
  assigned,
  loadError,
}: {
  adAccountId: string;
  metaAccountId: string;
  slug: string;
  assigned: Assigned[];
  loadError: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>(["ADVERTISE"]);
  const [state, formAction] = useActionState<AssignState, FormData>(
    assignUserAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [removing, startRemove] = useTransition();

  // BM directory state — lazy loaded the first time the user opens the form
  // so we don't burn API calls on every page render.
  const [directory, setDirectory] = useState<BmDirectoryEntry[] | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [loadingDir, startLoadingDir] = useTransition();
  const [query, setQuery] = useState("");
  const [pickedUser, setPickedUser] = useState<BmDirectoryEntry | null>(null);

  useEffect(() => {
    if (!open || directory !== null || loadingDir) return;
    startLoadingDir(async () => {
      const res = await listBmDirectoryAction(adAccountId);
      if (res.error) {
        setDirectoryError(res.error);
        setDirectory([]);
      } else {
        setDirectory(res.members ?? []);
        setDirectoryError(null);
      }
    });
  }, [open, adAccountId, directory, loadingDir]);

  const assignedIds = useMemo(
    () => new Set(assigned.map((a) => a.id)),
    [assigned],
  );
  const filtered = useMemo(() => {
    const list = directory ?? [];
    const needle = query.trim().toLowerCase();
    return list
      .filter((m) => !assignedIds.has(m.id))
      .filter((m) => {
        if (!needle) return true;
        return (
          m.name.toLowerCase().includes(needle) ||
          (m.email ?? "").toLowerCase().includes(needle)
        );
      })
      .slice(0, 25);
  }, [directory, query, assignedIds]);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      toast.success(
        state.assignedName
          ? `${state.assignedName} assigned to ${metaAccountId}`
          : "User assigned",
      );
      setOpen(false);
      setPicked(["ADVERTISE"]);
      setPickedUser(null);
      setQuery("");
      formRef.current?.reset();
    }
  }, [state, metaAccountId]);

  const handleRemove = (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from ${metaAccountId}?`)) return;
    const fd = new FormData();
    fd.set("adAccountId", adAccountId);
    fd.set("slug", slug);
    fd.set("userId", userId);
    startRemove(async () => {
      const res = await removeUserAction(undefined, fd);
      if (res.error) toast.error(res.error);
      else toast.success(`${name} removed`);
    });
  };

  return (
    <div className="space-y-3 rounded-lg border bg-card/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-meta size-4" />
          <span className="text-xs font-medium">
            Meta ad-account access ({assigned.length})
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen((v) => !v)}
        >
          <UserPlus className="size-3.5" />
          {open ? "Cancel" : "Add user"}
        </Button>
      </div>

      {loadError ? (
        <p className="text-destructive text-xs">{loadError}</p>
      ) : assigned.length === 0 ? (
        <p className="text-muted-foreground text-xs italic">
          No users assigned beyond the System User. The owner of the System
          Token always retains access.
        </p>
      ) : (
        <ul className="space-y-1">
          {assigned.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between gap-2 rounded-md border bg-background/40 px-2.5 py-1.5 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium">{u.name}</span>
                  {u.email ? (
                    <span className="text-muted-foreground truncate">
                      · {u.email}
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {u.tasks.length === 0 ? (
                    <Badge variant="ghost" className="text-[9px]">
                      no tasks
                    </Badge>
                  ) : (
                    u.tasks.map((t) => (
                      <Badge key={t} variant="outline" className="text-[9px]">
                        {t.toLowerCase()}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                className="text-destructive shrink-0"
                disabled={removing}
                onClick={() => handleRemove(u.id, u.name)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <form
          ref={formRef}
          action={formAction}
          className="grid gap-2 rounded-md border bg-background/60 p-3"
        >
          <input type="hidden" name="adAccountId" value={adAccountId} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="tasks" value={picked.join(",")} />
          <input
            type="hidden"
            name="emailOrUserId"
            value={pickedUser?.id ?? query}
          />
          <div className="grid gap-1.5">
            <Label
              htmlFor={`bm-search-${adAccountId}`}
              className="text-[11px]"
            >
              Pick someone from this Business Manager
            </Label>
            {pickedUser ? (
              <div className="flex items-center justify-between rounded-md border bg-card/60 px-2.5 py-1.5 text-xs">
                <div className="min-w-0">
                  <div className="truncate font-medium">{pickedUser.name}</div>
                  {pickedUser.email ? (
                    <div className="text-muted-foreground truncate text-[10px]">
                      {pickedUser.email}
                    </div>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPickedUser(null);
                    setQuery("");
                  }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <>
                <Input
                  id={`bm-search-${adAccountId}`}
                  type="text"
                  autoComplete="off"
                  placeholder={
                    loadingDir
                      ? "Loading BM members…"
                      : "Search by name or email — or paste a Meta user ID"
                  }
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={loadingDir && (directory?.length ?? 0) === 0}
                />
                {directoryError ? (
                  <p className="text-destructive text-[10px]">
                    {directoryError}
                  </p>
                ) : loadingDir ? (
                  <p className="text-muted-foreground text-[10px] italic">
                    Loading from Meta…
                  </p>
                ) : directory && filtered.length === 0 ? (
                  <p className="text-muted-foreground text-[10px] italic">
                    {(directory.length ?? 0) === 0
                      ? "Meta returned no BM members. Add someone in Meta Business Manager → People first."
                      : query
                        ? "No match. Pasting a Meta user ID also works."
                        : "Everyone in this BM is already assigned."}
                  </p>
                ) : null}
                {filtered.length > 0 ? (
                  <ul className="max-h-48 overflow-y-auto rounded-md border bg-card/40">
                    {filtered.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setPickedUser(m);
                            setQuery("");
                          }}
                          className="hover:bg-accent/40 flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {m.name}
                            </div>
                            {m.email ? (
                              <div className="text-muted-foreground truncate text-[10px]">
                                {m.email}
                              </div>
                            ) : null}
                          </div>
                          {m.status === "pending" ? (
                            <Badge
                              variant="outline"
                              className="shrink-0 gap-1 text-[9px]"
                            >
                              <Clock className="size-2.5" />
                              pending
                            </Badge>
                          ) : m.role ? (
                            <Badge
                              variant="outline"
                              className="shrink-0 text-[9px]"
                            >
                              {m.role.toLowerCase()}
                            </Badge>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
            <p className="text-muted-foreground text-[10px]">
              Only people already inside this Business Manager can be assigned.
              Pending invites must be accepted first.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-[11px]">Permissions</Label>
            <div className="flex flex-wrap gap-1.5">
              {TASKS.map((t) => {
                const checked = picked.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setPicked((prev) =>
                        checked
                          ? prev.filter((p) => p !== t.id)
                          : [...prev, t.id],
                      )
                    }
                    title={t.description}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-all ${
                      checked
                        ? "border-[var(--brand)] bg-[color-mix(in_oklab,var(--brand)_15%,transparent)] text-foreground"
                        : "border-border/70 bg-card/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <KeyRound className="size-3" />
                    {t.label}
                  </button>
                );
              })}
            </div>
            <p className="text-muted-foreground text-[10px]">
              Manage = admin · Advertise = edit campaigns · Analyze = read-only
            </p>
          </div>
          <div className="flex justify-end">
            <AddSubmit />
          </div>
        </form>
      ) : null}
    </div>
  );
}
