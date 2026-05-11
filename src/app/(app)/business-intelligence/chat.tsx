"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spotlight } from "@/components/magic/spotlight";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const SUGGESTIONS = [
  "Which client had the worst CPL last month?",
  "Where should we cut budget across the portfolio?",
  "Compare ROAS across all sales campaigns and rank them.",
  "Are any campaigns burning spend without conversions?",
];

export function VittoriaChat({
  initialMessages = [],
}: {
  initialMessages?: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  async function send(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed || pending) return;

    const next: Message[] = [
      ...messages,
      { role: "user" as const, content: trimmed },
      { role: "assistant" as const, content: "" },
    ];
    setMessages(next);
    setInput("");
    setPending(true);

    try {
      const res = await fetch("/api/bi/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next
            .filter((m, i) => !(i === next.length - 1 && m.role === "assistant"))
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errBody.error ?? "Chat request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Chat failed";
      toast.error(msg);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setPending(false);
    }
  }

  return (
    <Spotlight size={500} intensity={0.4}>
    <Card className="glass relative overflow-hidden">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-20 size-72 rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--brand) 60%, transparent), transparent)",
        }}
      />
      <CardHeader>
        <div className="flex items-center gap-2">
          <span
            className="text-brand-foreground flex size-7 items-center justify-center rounded-md text-xs font-semibold"
            style={{
              background:
                "linear-gradient(135deg, var(--brand) 0%, color-mix(in oklab, var(--brand) 60%, white) 100%)",
            }}
          >
            V
          </span>
          <CardTitle className="text-base">Vittoria</CardTitle>
        </div>
        <CardDescription>
          Ask anything about your portfolio. Vittoria sees every client&apos;s
          last-30-day metrics and top campaigns.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex h-[60vh] flex-col gap-3">
        <div
          ref={scrollRef}
          className="flex-1 space-y-3 overflow-y-auto pr-2"
        >
          {messages.length === 0 ? (
            <EmptyState onPick={send} />
          ) : (
            messages.map((m, i) => (
              <MessageBubble
                key={i}
                role={m.role}
                content={m.content}
                pending={pending && i === messages.length - 1 && m.content === ""}
              />
            ))
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="bg-background/60 flex items-end gap-2 rounded-lg border p-2 backdrop-blur"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Ask Vittoria… (Enter to send, Shift+Enter for newline)"
            disabled={pending}
            className="placeholder:text-muted-foreground max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
          />
          <Button
            type="submit"
            size="sm"
            disabled={pending || input.trim().length === 0}
          >
            <ArrowUp className="size-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
    </Spotlight>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="space-y-3 py-4">
      <div className="flex items-center gap-2 text-sm">
        <Sparkles className="text-meta size-4" />
        Try one of these to get started:
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="hover:bg-muted/60 group rounded-md border p-3 text-left text-sm transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  role,
  content,
  pending,
}: {
  role: "user" | "assistant";
  content: string;
  pending: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`shrink-0 flex size-7 items-center justify-center rounded-md text-xs font-semibold ${
          isUser
            ? "bg-muted text-foreground"
            : "text-brand-foreground"
        }`}
        style={
          isUser
            ? undefined
            : {
                background:
                  "linear-gradient(135deg, var(--brand) 0%, color-mix(in oklab, var(--brand) 60%, white) 100%)",
              }
        }
      >
        {isUser ? <User className="size-3.5" /> : "V"}
      </div>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
          isUser ? "bg-muted" : "bg-background/60 border"
        }`}
      >
        {pending && content.length === 0 ? (
          <span className="text-muted-foreground italic">Thinking…</span>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap break-words">
            {content}
          </div>
        )}
      </div>
    </div>
  );
}
