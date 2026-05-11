import Link from "next/link";
import { AlertCircle, ExternalLink, Sparkles } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { requirePageAccess } from "@/lib/auth-helpers";

import { VittoriaChat } from "./chat";

export default async function BusinessIntelligencePage() {
  const user = await requirePageAccess("business_intelligence");
  const configured = !!process.env.OPENROUTER_API_KEY;

  if (user.role === "CLIENT") {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle>Not available</CardTitle>
          <CardDescription>
            Business Intelligence is for the agency team. Ask your account
            manager.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Intelligence"
        description="Ask Vittoria anything about your portfolio."
        actions={
          <Badge variant="outline">
            <Sparkles className="size-3" />
            Vittoria · OpenRouter
          </Badge>
        }
      />

      {configured ? (
        <VittoriaChat />
      ) : (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Set up required</CardTitle>
            <CardDescription>
              Add your Anthropic API key to start chatting with Vittoria.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="size-4" />
              <AlertTitle>One-time setup</AlertTitle>
              <AlertDescription>
                <ol className="ml-4 list-decimal space-y-1.5 text-sm">
                  <li>
                    Get an API key from{" "}
                    <Link
                      href="https://openrouter.ai/keys"
                      target="_blank"
                      className="inline-flex items-center gap-1 underline"
                    >
                      openrouter.ai/keys
                      <ExternalLink className="size-3" />
                    </Link>
                    .
                  </li>
                  <li>
                    Add to <code className="bg-muted rounded px-1">.env</code>:{" "}
                    <code className="bg-muted rounded px-1">
                      OPENROUTER_API_KEY=sk-or-v1-…
                    </code>
                  </li>
                  <li>Restart the dev server.</li>
                </ol>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      <p className="text-muted-foreground text-center text-xs">
        Vittoria is read-only. It can&apos;t pause campaigns or change budgets
        — only advise. Conversation history is not persisted yet.
      </p>
    </div>
  );
}
