import { differenceInCalendarDays } from "date-fns";

import { prisma } from "@/lib/db";
import { assembleClientInsights } from "@/lib/insights-assembly";
import type { DateRange } from "@/lib/meta";

import type {
  ChannelOrder,
  GoogleSection,
  MetaSection,
  ReportInput,
  ReportLanguage,
  ReportPriority,
} from "./types";
import { formatRangeLabel } from "./i18n";

export async function assembleReportInput({
  clientId,
  range,
  language,
  generatedBy,
  priorities,
  contextNote,
}: {
  clientId: string;
  range: DateRange;
  language: ReportLanguage;
  generatedBy?: string;
  priorities?: ReportPriority[];
  contextNote?: string;
}): Promise<ReportInput> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      adAccounts: { select: { currency: true } },
    },
  });
  if (!client) throw new Error("Client not found");

  const start = new Date(range.since + "T00:00:00Z");
  const end = new Date(range.until + "T23:59:59Z");
  const daysCount = differenceInCalendarDays(end, start) + 1;
  const currency = client.adAccounts[0]?.currency ?? "EUR";

  const insights = await assembleClientInsights({ clientId, range });

  // Backend orders for the orders table (per-row Meta orders only — Google
  // manual entry is aggregate-only).
  const backendOrders = await prisma.order.findMany({
    where: {
      clientId,
      occurredAt: {
        gte: new Date(range.since + "T00:00:00Z"),
        lte: new Date(range.until + "T23:59:59Z"),
      },
    },
    orderBy: { occurredAt: "asc" },
  });

  const metaOrders: ChannelOrder[] = backendOrders.map((o) => ({
    reference: o.reference ?? `#${o.id.slice(-4)}`,
    customer: undefined,
    country: undefined,
    line: undefined,
    value: Number(o.value),
    tracked: false,
    occurredAt: o.occurredAt,
  }));

  const k = insights.meta.current;
  const profile: MetaSection["campaignProfile"] =
    k.leads > 0 && k.purchasesReal > 0
      ? "mixed"
      : k.leads > 0
        ? "lead_gen"
        : k.purchasesReal > 0
          ? "ecommerce"
          : "awareness";

  const meta: MetaSection = {
    spend: k.spend,
    realPurchases: k.purchasesReal,
    realRevenue: k.revenueReal,
    realRoas: k.roasReal,
    realCpa: k.cpaReal,
    pixelRoas: k.roasPixel,
    pixelPurchases: k.purchasesPixel,
    pixelRevenue: k.revenuePixel,
    leads: k.leads,
    costPerLead: k.costPerLead,
    campaignProfile: profile,
    reach: k.reach,
    impressions: k.impressions,
    frequency: k.frequency,
    cpm: k.cpm,
    cpcLink: k.cpcLink,
    ctrLink: k.ctrLink,
    linkClicks: k.linkClicks,
    landingPageViews: k.landingPageViews,
    costPerLpv: k.costPerLpv,
    addToCart: k.addToCart,
    initiateCheckout: k.initiateCheckout,
    daysActive: daysCount,
    orders: metaOrders.length > 0 ? metaOrders : undefined,
  };

  let google: GoogleSection | undefined;
  if (insights.google) {
    const g = insights.google.current;
    google = {
      spend: g.spend,
      realPurchases: g.purchasesReal,
      realRevenue: g.revenueReal,
      realRoas: g.roasReal,
      realCpa: g.cpaReal,
      trackedConversions: g.purchasesPixel,
      trackedRevenue: g.revenuePixel,
      daysActive: daysCount,
      orders: undefined,
    };
  }

  return {
    client: {
      name: client.name,
      brandColor: client.brandColor ?? undefined,
    },
    period: {
      start,
      end,
      daysCount,
      label: formatRangeLabel(start, end, language),
    },
    language,
    currency,
    contextNote,
    meta,
    google,
    priorities,
    generatedBy,
  };
}
