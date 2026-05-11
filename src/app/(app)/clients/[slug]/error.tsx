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

export default function ClientError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[client error]", error);
  }, [error]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-destructive size-5" />
          <CardTitle>Couldn&apos;t load this client</CardTitle>
        </div>
        <CardDescription>
          {error.message || "An unexpected error occurred while loading data."}
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
