"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { importOrdersCsvAction, type CsvImportState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant="secondary" size="sm">
      {pending ? "Importing…" : "Import CSV"}
    </Button>
  );
}

export function CsvImport({ clientId }: { clientId: string }) {
  const [state, formAction] = useActionState<CsvImportState, FormData>(
    importOrdersCsvAction,
    {},
  );
  const [csv, setCsv] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      toast.success(
        `Imported ${state.imported ?? 0}, skipped ${state.skipped ?? 0}.`,
      );
      setCsv("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [state]);

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="clientId" value={clientId} />
      <input
        type="file"
        ref={fileRef}
        accept=".csv,text/csv"
        className="text-sm"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const text = await file.text();
          setCsv(text);
        }}
      />
      <textarea
        name="csv"
        rows={6}
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        placeholder={`occurredAt,value,reference,notes\n2026-05-01,142.00,ORDER-1,Phone\n2026-05-02,98.50,ORDER-2,`}
        className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring rounded-md border px-3 py-2 font-mono text-xs focus-visible:ring-1 focus-visible:outline-none"
      />
      <Submit />
    </form>
  );
}
