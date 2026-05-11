import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { requireManager } from "@/lib/auth-helpers";
import { hasGoogleAdsCredentials } from "@/lib/google/config";

import { MetaImport } from "./meta-import";
import { GoogleImport } from "./google-import";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireManager();
  const sp = await searchParams;
  const googleConfigured = hasGoogleAdsCredentials();
  const defaultTab = sp.tab === "google" ? "google" : "meta";
  const googleError =
    typeof sp.google_error === "string" ? sp.google_error : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import accounts"
        description="Connect a Business Manager or Google Ads manager and bulk-create one client per ad account."
      />

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="meta">
            <span
              className="size-2 rounded-full"
              style={{ background: "var(--meta)" }}
            />
            Meta Business Manager
          </TabsTrigger>
          <TabsTrigger value="google">
            <span
              className="size-2 rounded-full"
              style={{ background: "var(--google)" }}
            />
            Google Ads
          </TabsTrigger>
        </TabsList>

        <TabsContent value="meta">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Bulk-import a Business Manager
              </CardTitle>
              <CardDescription>
                Paste one System User token per BM. We&apos;ll list every ad
                account it can see and let you pick which to onboard as
                clients. Two BMs = run this twice.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MetaImport />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="google">
          <GoogleImport
            configured={googleConfigured}
            errorMessage={googleError}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
