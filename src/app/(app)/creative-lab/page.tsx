import { Sparkles, Wand2, Image as ImageIcon, Megaphone } from "lucide-react";

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

export default async function CreativeLabPage() {
  await requirePageAccess("creative_lab");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Creative Lab"
        description="Generate ad creatives from a brief, iterate on variations, and ship straight to your campaigns."
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
            <Sparkles className="text-meta size-5" />
            <CardTitle className="text-xl">
              GPT Image · ad creative on demand
            </CardTitle>
          </div>
          <CardDescription>
            Brief once, get a board of static + video variations, sized for
            every Meta placement. Auto-tag with the right campaign objective.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <FeatureBlock
            icon={<Wand2 className="size-4" />}
            title="From brief to board"
            body="Paste a product description; receive 6+ static variations, each captioned and CTA-suggested."
          />
          <FeatureBlock
            icon={<ImageIcon className="size-4" />}
            title="Every placement, sized"
            body="1:1 feed, 9:16 reels, 4:5 stories — auto-cropped with subject-aware framing."
          />
          <FeatureBlock
            icon={<Megaphone className="size-4" />}
            title="Push to a campaign"
            body="One-click upload as a draft ad set. Pre-tagged by objective so the lead/sales split keeps working."
          />
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-center text-xs">
        Want early access? Mention it next time we chat.
      </p>
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
