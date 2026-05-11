import { redirect } from "next/navigation";
import Link from "next/link";
import { Sparkles, ShieldCheck, BarChart3 } from "lucide-react";

import { auth } from "@/auth";
import { ShinyText } from "@/components/magic/shiny-text";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="relative grid min-h-screen lg:grid-cols-[minmax(420px,500px)_1fr]">
      {/* LEFT: form column */}
      <div className="flex flex-col p-8 sm:p-12 lg:p-16">
        <Link
          href="/login"
          className="mb-12 inline-flex items-center gap-2 self-start"
        >
          <span
            className="text-brand-foreground flex size-9 items-center justify-center rounded-lg font-semibold tracking-tight"
            style={{
              background:
                "linear-gradient(135deg, var(--brand) 0%, color-mix(in oklab, var(--brand) 60%, white) 100%)",
              boxShadow:
                "0 8px 28px -8px color-mix(in oklab, var(--brand) 60%, transparent)",
            }}
          >
            V
          </span>
          <span className="text-base font-semibold tracking-tight">
            Vittoria
          </span>
        </Link>

        <div className="flex flex-1 flex-col justify-center gap-8">
          <div className="space-y-3">
            <div className="text-muted-foreground inline-flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <Sparkles className="text-meta size-3" />
              <ShinyText>Welcome back</ShinyText>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Sign in to your <span className="hero-number">cockpit</span>.
            </h1>
            <p className="text-muted-foreground max-w-sm text-sm">
              Multi-channel ads command center — Meta, Google, soon TikTok —
              with one signal that&apos;s actually worth reading.
            </p>
          </div>

          <LoginForm />

          <div className="text-muted-foreground flex items-center gap-2 text-[11px]">
            <ShieldCheck className="size-3" />
            <span>
              Bcrypt cost 12 · 7-day JWT · brute-force lockout after 5 failed
              attempts
            </span>
          </div>
        </div>

        <p className="text-muted-foreground mt-8 text-xs">
          © {new Date().getFullYear()} Vittoria. Built for agencies that hate
          unread reports.
        </p>
      </div>

      {/* RIGHT: hero column (desktop only) */}
      <div className="relative hidden overflow-hidden border-l border-border/40 lg:block">
        <HeroPanel />
      </div>
    </div>
  );
}

function HeroPanel() {
  return (
    <div className="relative flex h-full flex-col justify-center gap-8 p-16 xl:p-24">
      {/* Decorative glows behind the card stack */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-20 right-10 size-96 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--brand) 60%, transparent), transparent)",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-10 size-72 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--brand) 50%, transparent), transparent)",
        }}
      />

      <div className="relative max-w-md space-y-4">
        <div className="text-muted-foreground inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-[11px] uppercase tracking-wider backdrop-blur">
          <BarChart3 className="text-meta size-3" />
          What you&apos;ll see inside
        </div>
        <h2 className="text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
          Every client. Every channel.
          <br />
          <span className="hero-number">One screen.</span>
        </h2>
        <p className="text-muted-foreground text-sm">
          Roll up spend, leads, purchases, and ROAS across a portfolio of ad
          accounts. Or zoom into a single client&apos;s campaigns. Vittoria,
          your AI co-pilot, narrates what changed and why.
        </p>
      </div>

      {/* Floating preview cards — purely decorative */}
      <div className="relative grid grid-cols-2 gap-4">
        <PreviewCard
          eyebrow="Spend (30d)"
          value="€48.214,30"
          delta="+8.2%"
          floatDelay="0s"
        />
        <PreviewCard
          eyebrow="ROAS"
          value="3.42×"
          delta="+0.6×"
          floatDelay="-1.5s"
        />
        <PreviewCard
          eyebrow="Leads"
          value="284"
          delta="+12.1%"
          floatDelay="-3s"
        />
        <PreviewCard
          eyebrow="Active campaigns"
          value="42"
          delta="across 9 clients"
          deltaTone="muted"
          floatDelay="-4.5s"
        />
      </div>
    </div>
  );
}

function PreviewCard({
  eyebrow,
  value,
  delta,
  deltaTone = "ok",
  floatDelay = "0s",
}: {
  eyebrow: string;
  value: string;
  delta: string;
  deltaTone?: "ok" | "muted";
  floatDelay?: string;
}) {
  return (
    <div
      className="glass relative overflow-hidden rounded-xl p-5"
      style={{
        animation: `preview-float 6s ease-in-out infinite`,
        animationDelay: floatDelay,
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-10 size-32 rounded-full opacity-30 blur-2xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--brand) 50%, transparent), transparent)",
        }}
      />
      <div className="text-muted-foreground text-[10px] uppercase tracking-wider">
        {eyebrow}
      </div>
      <div className="hero-number mt-1 font-mono text-2xl font-semibold tabular-nums">
        {value}
      </div>
      <div
        className={
          deltaTone === "ok"
            ? "mt-1 text-xs text-emerald-600"
            : "text-muted-foreground mt-1 text-xs"
        }
      >
        {delta}
      </div>
      <style>{`
        @keyframes preview-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
