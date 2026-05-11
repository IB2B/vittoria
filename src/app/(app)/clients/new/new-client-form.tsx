"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
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
  createClientAction,
  type CreateClientState,
} from "../actions";
import { slugify } from "@/lib/slug";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create client"}
    </Button>
  );
}

export function NewClientForm() {
  const [state, formAction] = useActionState<CreateClientState, FormData>(
    createClientAction,
    {},
  );
  const [name, setName] = useState("");
  const slugPreview = slugify(name);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Client details</CardTitle>
        <CardDescription>
          The slug is generated from the name and used in URLs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              required
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Note del Chianti"
              aria-invalid={!!state?.fieldErrors?.name}
            />
            <p className="text-muted-foreground text-xs">
              Slug:{" "}
              <span className="font-mono">{slugPreview || "—"}</span>
            </p>
            {state?.fieldErrors?.name ? (
              <p className="text-destructive text-xs">
                {state.fieldErrors.name}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="brandColor">Brand color (optional)</Label>
            <Input
              id="brandColor"
              name="brandColor"
              placeholder="#8B1538"
              autoComplete="off"
              aria-invalid={!!state?.fieldErrors?.brandColor}
            />
            {state?.fieldErrors?.brandColor ? (
              <p className="text-destructive text-xs">
                {state.fieldErrors.brandColor}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="logoUrl">Logo URL (optional)</Label>
            <Input
              id="logoUrl"
              name="logoUrl"
              type="url"
              placeholder="https://…/logo.png"
              autoComplete="off"
              aria-invalid={!!state?.fieldErrors?.logoUrl}
            />
            {state?.fieldErrors?.logoUrl ? (
              <p className="text-destructive text-xs">
                {state.fieldErrors.logoUrl}
              </p>
            ) : null}
          </div>
          <div className="flex justify-end">
            <SubmitButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
