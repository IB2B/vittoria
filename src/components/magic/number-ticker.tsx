"use client";

import { useEffect, useRef, useState } from "react";

// Smooth count-up animation using requestAnimationFrame — no framer-motion dep.
// Inspired by Magic UI's NumberTicker, but rendered as plain text so it can
// inherit any text styling (gradient fills, hero-number, etc).
export function NumberTicker({
  value,
  durationMs = 1200,
  decimals = 0,
  format,
  className,
}: {
  value: number;
  durationMs?: number;
  decimals?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let rafId: number;
    let startTs: number | null = null;
    const fromValue = startedRef.current ? display : 0;
    const toValue = value;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !startedRef.current) {
          startedRef.current = true;
          const tick = (ts: number) => {
            if (startTs == null) startTs = ts;
            const elapsed = ts - startTs;
            const t = Math.min(1, elapsed / durationMs);
            // ease-out-cubic
            const eased = 1 - Math.pow(1 - t, 3);
            const current = fromValue + (toValue - fromValue) * eased;
            setDisplay(current);
            if (t < 1) rafId = requestAnimationFrame(tick);
          };
          rafId = requestAnimationFrame(tick);
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
    // We intentionally don't depend on `display` — it's the animation target
    // we're writing to, not a reactive input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs]);

  // If value changes after mount, reset and re-animate.
  useEffect(() => {
    if (startedRef.current) {
      const fromValue = display;
      const toValue = value;
      const start = performance.now();
      let rafId: number;
      const tick = (ts: number) => {
        const elapsed = ts - start;
        const t = Math.min(1, elapsed / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplay(fromValue + (toValue - fromValue) * eased);
        if (t < 1) rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const formatted = format
    ? format(display)
    : display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  return (
    <span ref={ref} className={className}>
      {formatted}
    </span>
  );
}
