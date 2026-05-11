import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <Card className="glass relative overflow-hidden p-8">
        <div className="grid gap-6 sm:grid-cols-[2fr_1fr]">
          <div className="space-y-3">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-9 w-72" />
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="border-l border-border/40 pl-6 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-end">
        <Skeleton className="h-9 w-44" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Card key={i} className="glass overflow-hidden">
            <div className="space-y-2 p-4">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-3 w-24" />
            </div>
          </Card>
        ))}
      </div>

      <Card className="glass">
        <div className="space-y-3 p-6">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="glass">
            <div className="space-y-3 p-5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-44" />
              {[0, 1, 2, 3, 4].map((j) => (
                <div key={j} className="flex items-center gap-2 pt-1">
                  <Skeleton className="size-4 rounded" />
                  <Skeleton className="h-3 flex-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Card className="glass">
        <div className="space-y-3 p-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-64" />
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}
