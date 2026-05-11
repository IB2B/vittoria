import { Clapperboard, Wand2, Film } from "lucide-react";

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

export default async function ReelsLabPage() {
  await requirePageAccess("reels_lab");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reels Lab"
        description="Storyboard → AI video → ready-to-publish reel. Designed for the Meta + TikTok lead-gen workflow."
        actions={<Badge variant="outline">Coming soon</Badge>}
      />

      <Card className="glass relative overflow-hidden">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-20 size-72 rounded-full opacity-40 blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in oklab, var(--brand) 60%, transparent), transparent)",
          }}
        />
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clapperboard className="text-meta size-5" />
            <CardTitle className="text-xl">From script to reel</CardTitle>
          </div>
          <CardDescription>
            Reels Lab pairs a hook generator, a clip stitcher, and TTS voiceover
            in Italian + English.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FeatureBlock
            icon={<Wand2 className="size-4" />}
            title="Hook variations"
            body="Generate 6 opening hooks per brief. A/B test which retention curve climbs fastest."
          />
          <FeatureBlock
            icon={<Film className="size-4" />}
            title="Clip stitcher"
            body="Stitch product B-roll, broll, captions, and TTS into 9:16 reels in one click."
          />
        </CardContent>
      </Card>
    </div>
  );
}

function FeatureBlock({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-4">
      <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </div>
      <p className="text-sm">{body}</p>
    </div>
  );
}
