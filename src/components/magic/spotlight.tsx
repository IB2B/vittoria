"use client";

import { useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

// Mouse-following radial spotlight on the wrapper. CSS variables driven by
// pointermove — no framer-motion. The wrapper element is `position: relative`
// so the absolute spotlight is contained to it.
export function Spotlight({
  children,
  className,
  size = 480,
  intensity = 0.35,
}: {
  children: ReactNode;
  className?: string;
  size?: number;
  intensity?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--sx", `${e.clientX - rect.left}px`);
        el.style.setProperty("--sy", `${e.clientY - rect.top}px`);
        el.style.setProperty("--sa", `${intensity}`);
      }}
      onPointerLeave={() => {
        const el = ref.current;
        if (el) el.style.setProperty("--sa", "0");
      }}
      style={
        {
          "--sx": "50%",
          "--sy": "50%",
          "--sa": "0",
        } as React.CSSProperties
      }
      className={cn("group/spotlight relative isolate", className)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
        style={{
          background: `radial-gradient(${size}px circle at var(--sx) var(--sy), color-mix(in oklab, var(--brand) 30%, transparent), transparent 60%)`,
          opacity: "var(--sa)",
        }}
      />
      {children}
    </div>
  );
}
