import { cn } from "@/lib/utils";

// Magic-UI-style shimmer text. Pure CSS — uses the .shimmer utility from
// globals.css. Wrap anything that needs the diagonal sweep effect.
export function ShinyText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("shimmer inline-block", className)}>{children}</span>
  );
}
