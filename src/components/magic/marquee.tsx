import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Magic-UI-style horizontal marquee. CSS-only via duplicated content + a
// keyframe that translates -50%. Add `pauseOnHover` for accessibility.
export function Marquee({
  children,
  className,
  durationSec = 40,
  pauseOnHover = true,
}: {
  children: ReactNode;
  className?: string;
  durationSec?: number;
  pauseOnHover?: boolean;
}) {
  return (
    <div
      className={cn(
        "marquee group flex gap-12 overflow-hidden",
        pauseOnHover && "[--marquee-state:running] hover:[--marquee-state:paused]",
        className,
      )}
      style={
        {
          maskImage:
            "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
          "--marquee-duration": `${durationSec}s`,
        } as React.CSSProperties
      }
    >
      <div className="marquee-track flex shrink-0 items-center gap-12">
        {children}
      </div>
      <div
        className="marquee-track flex shrink-0 items-center gap-12"
        aria-hidden
      >
        {children}
      </div>
      <style>{`
        .marquee-track {
          animation: marquee var(--marquee-duration) linear infinite;
          animation-play-state: var(--marquee-state, running);
        }
        @keyframes marquee {
          to { transform: translateX(calc(-100% - 3rem)); }
        }
      `}</style>
    </div>
  );
}
