import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

// Modern input: 9h tall, soft frosted background, brand-tinted glow on focus.
// Same API as the previous shadcn Input.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // Base
        "h-9 w-full min-w-0 rounded-lg border px-3 py-1.5 text-sm transition-all outline-none",
        // Background — frosted card surface, deeper in dark mode
        "bg-card/50 backdrop-blur-sm dark:bg-input/30",
        // Border — subtle by default, brand-tinted on focus
        "border-border/70",
        // Focus — brand-blue ring + halo + slight lift
        "focus-visible:border-[var(--brand)] focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_oklab,var(--brand)_25%,transparent)] focus-visible:shadow-[0_4px_16px_-6px_color-mix(in_oklab,var(--brand)_45%,transparent)]",
        // Placeholder
        "placeholder:text-muted-foreground/70",
        // File input slot
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        // Disabled
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-input/50",
        // Invalid
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
