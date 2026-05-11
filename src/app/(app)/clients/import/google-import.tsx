import Link from "next/link";
import { AlertCircle, ExternalLink } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { listCustomersWithDetails, type GoogleCustomer } from "@/lib/google/customers";
import { getPendingGoogleRefreshToken } from "@/lib/google/session";

import { GoogleImportPicker } from "./google-import-picker";
import { cancelPendingGoogleSession } from "./google-actions";

export async function GoogleImport({
  configured,
  errorMessage,
}: {
  configured: boolean;
  errorMessage?: string;
}) {
  if (!configured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Google Ads — setup required</CardTitle>
          <CardDescription>
            Google requires a developer token + OAuth client before any
            customer data can be read. One-time setup, then this tab works
            like the Meta one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="size-4" />
            <AlertTitle>What you need to procure</AlertTitle>
            <AlertDescription>
              <ol className="ml-4 list-decimal space-y-2 text-sm">
                <li>
                  <span className="font-medium">Google Ads developer token.</span>{" "}
                  Sign in to your Google Ads manager (MCC) account → Tools &
                  Settings → API Center → apply for a token.{" "}
                  <span className="text-muted-foreground">
                    (Basic access is usually approved within a day or two.)
                  </span>{" "}
                  <Link
                    href="https://ads.google.com/aw/apicenter"
                    target="_blank"
                    className="inline-flex items-center gap-1 underline"
                  >
                    Open API Center <ExternalLink className="size-3" />
                  </Link>
                </li>
                <li>
                  <span className="font-medium">Google Cloud OAuth client.</span>{" "}
                  Console → APIs &amp; Services → Credentials → Create OAuth
                  Client ID (Web application). Add redirect URI:{" "}
                  <code className="bg-muted rounded px-1">
                    {process.env.NEXTAUTH_URL ?? "http://localhost:3001"}
                    /api/google/oauth/callback
                  </code>
                  .{" "}
                  <Link
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    className="inline-flex items-center gap-1 underline"
                  >
                    Open Cloud Console <ExternalLink className="size-3" />
                  </Link>
                </li>
                <li>
                  <span className="font-medium">Add to <code>.env</code>:</span>
                  <pre className="bg-muted mt-1 overflow-x-auto rounded p-2 text-xs">
{`GOOGLE_ADS_DEVELOPER_TOKEN=...
GOOGLE_OAUTH_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=...
# optional: your manager (MCC) customer ID, digits only, no dashes
GOOGLE_ADS_LOGIN_CUSTOMER_ID=1234567890`}
                  </pre>
                </li>
                <li>Restart the dev server. This tab will then show the OAuth flow.</li>
              </ol>
            </AlertDescription>
          </Alert>

          <div className="flex items-start gap-3 rounded-md border p-3 text-sm">
            <div className="space-y-1">
              <p className="font-medium">In the meantime</p>
              <p className="text-muted-foreground">
                You can keep entering Google Ads totals manually for any client
                under <span className="font-mono">Settings → Google Ads totals</span>.
                Those rows still feed the dashboard and the .docx report.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const refreshToken = await getPendingGoogleRefreshToken();

  if (!refreshToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connect Google Ads</CardTitle>
          <CardDescription>
            Sign in with Google to enumerate the customer accounts your
            manager (MCC) account has access to. Pick which to onboard as
            clients.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Authentication error</AlertTitle>
              <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
          <Button nativeButton={false} render={<Link href="/api/google/oauth/start" />}>
            Sign in with Google
          </Button>
          <p className="text-muted-foreground text-xs">
            We request the <code>https://www.googleapis.com/auth/adwords</code>{" "}
            scope. Refresh tokens are encrypted at rest with the same key as
            Meta tokens.
          </p>
        </CardContent>
      </Card>
    );
  }

  // OAuth completed — enumerate customers.
  let customers: GoogleCustomer[] = [];
  let listError: string | null = null;
  try {
    customers = await listCustomersWithDetails(refreshToken);
  } catch (err) {
    listError = err instanceof Error ? err.message : "Failed to list customers";
  }

  const existing = await prisma.adAccount.findMany({
    where: {
      channel: "GOOGLE",
      metaAccountId: { in: customers.map((c) => c.customerId) },
    },
    select: {
      metaAccountId: true,
      client: { select: { name: true, slug: true } },
    },
  });
  const alreadyImported: Record<
    string,
    { clientName: string; clientSlug: string }
  > = {};
  for (const e of existing) {
    alreadyImported[e.metaAccountId] = {
      clientName: e.client.name,
      clientSlug: e.client.slug,
    };
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pick Google Ads customers</CardTitle>
        <CardDescription>
          OAuth complete. {customers.length} accessible customer account(s)
          {customers.length > 0 ? "." : " — refresh token has access to none."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {listError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="size-4" />
            <AlertTitle>Couldn&apos;t list customers</AlertTitle>
            <AlertDescription className="text-xs">{listError}</AlertDescription>
          </Alert>
        ) : null}

        <GoogleImportPicker
          customers={customers}
          alreadyImported={alreadyImported}
          onCancel={cancelPendingGoogleSession}
        />
      </CardContent>
    </Card>
  );
}
