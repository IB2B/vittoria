"use client";

import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

export function TopBar({
  user,
}: {
  user: {
    email: string;
    name: string | null;
    role: "ADMIN" | "MANAGER" | "VIEWER" | "CLIENT";
  };
}) {
  return (
    <header className="bg-background/70 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4 backdrop-blur-xl">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <div className="flex-1" />
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          toast("Ask is coming soon", {
            description:
              "An AI assistant trained on your campaigns will answer questions here.",
          })
        }
        className="hidden sm:inline-flex"
      >
        <Sparkles className="size-3.5" />
        Ask
      </Button>
      <ThemeToggle />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <UserMenu email={user.email} name={user.name} role={user.role} />
    </header>
  );
}
