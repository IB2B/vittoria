import type { ReactNode } from "react";

// Auth layout intentionally minimal — each auth page (login, forgot, reset)
// owns its full-screen layout so they can each have a distinct hero.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="aurora" aria-hidden />
      {children}
    </div>
  );
}
