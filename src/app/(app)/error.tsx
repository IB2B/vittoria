"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <Card className="mx-auto mt-12 max-w-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-destructive size-5" />
          <CardTitle>Something went wrong</CardTitle>
        </div>
        <CardDescription>
          {error.message || "An unexpected error occurred."}
          {error.digest ? (
            <span className="text-muted-foreground block font-mono text-xs">
              digest: {error.digest}
            </span>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => reset()}>
          <RefreshCw className="size-4" />
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
