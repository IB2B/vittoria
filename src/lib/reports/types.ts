export type ReportLanguage = "it" | "en";

export type PriorityTone =
  | "meta"
  | "google"
  | "good"
  | "warn"
  | "bad"
  | "brand"
  | "accent"
  | "purple";

export type ChannelOrder = {
  reference: string;
  customer?: string;
  country?: string;
  line?: string;
  value: number;
  tracked: boolean;
  occurredAt: Date;
};

export type CampaignProfile =
  | "lead_gen" // leads > 0, no purchases
  | "ecommerce" // purchases > 0, no leads
  | "mixed" // both
  | "awareness"; // neither

export type MetaSection = {
  spend: number;
  realPurchases: number;
  realRevenue: number;
  realRoas: number | null;
  realCpa: number | null;
  pixelRoas: number | null;
  pixelPurchases: number;
  pixelRevenue: number;
  leads: number;
  costPerLead: number | null;
  campaignProfile: CampaignProfile;
  reach: number;
  impressions: number;
  frequency: number | null;
  cpm: number | null;
  cpcLink: number | null;
  ctrLink: number | null;
  linkClicks: number;
  landingPageViews: number;
  costPerLpv: number | null;
  addToCart: number;
  initiateCheckout: number;
  daysActive?: number;
  activeCampaigns?: string[];
  orders?: ChannelOrder[];
};

export type GoogleSection = {
  spend: number;
  realPurchases: number;
  realRevenue: number;
  realRoas: number | null;
  realCpa: number | null;
  trackedConversions: number;
  trackedRevenue: number;
  daysActive?: number;
  orders?: ChannelOrder[];
};

export type ReportPriority = {
  tone: PriorityTone;
  tag: string;
  title: string;
  body: string;
};

export type ReportNarrative = {
  executive_summary: string;
  performance_highlights: string[];
  recommendations: string[];
  flags?: string[];
};

export type ReportInput = {
  client: { name: string; brandColor?: string };
  period: {
    start: Date;
    end: Date;
    daysCount: number;
    label: string;
  };
  language: ReportLanguage;
  currency: string; // ISO code, e.g. "EUR"
  contextNote?: string;
  meta: MetaSection;
  google?: GoogleSection;
  priorities?: ReportPriority[];
  narrative?: ReportNarrative;
  nextUpdateOn?: Date;
  generatedBy?: string;
};
