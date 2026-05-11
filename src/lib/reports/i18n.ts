import type { ReportLanguage } from "./types";

export type ReportStrings = {
  reportTitle: string;
  channelsLine: (channels: string) => string;
  contextTitle: string;
  contextPeriod: (label: string, days: number) => string;
  contextMeta: string;
  contextGoogle: string;
  contextOrders: string;
  contextNotTracked: string;
  contextOrdersTail: string;

  section1: string;
  section1Sub: (label: string) => string;
  card1Spend: string;
  card1Purchases: string;
  card1Revenue: string;
  card1Roas: string;

  channelComparisonTitle: string;
  comparisonHeaders: string[];
  total: string;

  readingGlobalTitle: string;

  section2: string;
  section2Sub: string;
  card2Spend: string;
  card2Purchases: string;
  card2Revenue: string;
  card2Roas: string;

  funnelTitle: string;
  funnelHeaders: string[];
  funnelStageImpression: string;
  funnelStageLinkClick: string;
  funnelStageLpv: string;
  funnelStageAtc: string;
  funnelStageCheckout: string;
  funnelStagePurchasePixel: string;
  funnelStagePurchaseReal: string;

  deliveryTitle: string;
  deliveryHeaders: string[];

  ordersMetaTitle: (count: number, total: string) => string;
  ordersHeadersMeta: string[];
  ordersFootnoteMeta: string;

  section3: string;
  section3Sub: string;
  card3Spend: string;
  card3Conversions: string;
  card3Revenue: string;
  card3Roas: string;
  ordersGoogleTitle: (count: number, total: string) => string;
  ordersHeadersGoogle: string[];
  ordersFootnoteGoogle: string;
  readingGoogleTitle: string;

  section4: string;
  section4Sub: string;
  trackingHeaders: string[];
  implicationsTitle: string;

  section5: string;
  inProgress: string;

  yes: string;
  no: string;

  generatedAt: (date: string) => string;

  defaultPriorityNotes: string;
};

const it: ReportStrings = {
  reportTitle: "Report Performance Campagne Advertising",
  channelsLine: (c) => c,
  contextTitle: "Contesto del report",
  contextPeriod: (label, days) =>
    `Periodo analizzato: ${label} (${days} giorn${days === 1 ? "o" : "i"}).`,
  contextMeta: "Meta (Facebook / Instagram): ",
  contextGoogle: "Google Ads: ",
  contextOrders: "Dati ordini: ",
  contextNotTracked: "non sono state tracciate dal pixel/tag",
  contextOrdersTail:
    " — verificate da backend e attribuite alle campagne. I valori reali integrano queste vendite.",

  section1: "1.  Risultati Globali",
  section1Sub: (label) =>
    `Vista consolidata di entrambi i canali advertising nel periodo ${label}, integrando le vendite tracciate e quelle attribuibili da backend.`,
  card1Spend: "Spesa Totale Ads",
  card1Purchases: "Acquisti Reali",
  card1Revenue: "Ricavi Generati",
  card1Roas: "ROAS Globale",

  channelComparisonTitle: "Confronto Canali  —  Meta vs Google Ads",
  comparisonHeaders: [
    "Canale",
    "Periodo",
    "Spesa",
    "Ordini",
    "Ricavi",
    "ROAS",
    "CPA",
  ],
  total: "TOTALE",

  readingGlobalTitle: "Lettura  ·  Bilancio Globale",

  section2: "2.  Meta Ads  ·  Facebook / Instagram",
  section2Sub:
    "Dati pixel Meta + integrazione backend. Le metriche reali includono gli ordini non tracciati dal pixel.",
  card2Spend: "Spesa Meta",
  card2Purchases: "Acquisti Reali",
  card2Revenue: "Ricavi Meta",
  card2Roas: "ROAS Meta",

  funnelTitle: "Funnel di Conversione",
  funnelHeaders: ["Fase", "N°", "Tasso"],
  funnelStageImpression: "Impression",
  funnelStageLinkClick: "Click sul link",
  funnelStageLpv: "Visualizzazioni pagina prodotto (LPV)",
  funnelStageAtc: "Aggiunte al carrello",
  funnelStageCheckout: "Checkout iniziati",
  funnelStagePurchasePixel: "Acquisti tracciati dal pixel",
  funnelStagePurchaseReal: "Acquisti reali (backend)",

  deliveryTitle: "Metriche di Consegna ed Engagement",
  deliveryHeaders: [
    "Reach",
    "Impression",
    "Frequenza",
    "CPM",
    "CPC link",
    "CTR link",
    "LPV",
    "€ / LPV",
  ],

  ordersMetaTitle: (count, total) =>
    `Ordini Attribuibili a Meta Ads  ·  ${count} ordini  ·  ${total}`,
  ordersHeadersMeta: ["#", "Cliente", "Paese", "Linea", "Valore", "Pixel", "Data"],
  ordersFootnoteMeta:
    "* Ordini non tracciati dal pixel Meta — verificati manualmente da backend e attribuibili alla campagna.",

  section3: "3.  Google Ads",
  section3Sub:
    "Dati conversioni Google + integrazione backend. Verificare il setup del Conversion Tracking se la differenza rispetto al backend è ampia.",
  card3Spend: "Spesa Google",
  card3Conversions: "Acquisti",
  card3Revenue: "Ricavi Google",
  card3Roas: "ROAS Google",
  ordersGoogleTitle: (count, total) =>
    `Ordini Attribuibili a Google Ads  ·  ${count} ordini  ·  ${total}`,
  ordersHeadersGoogle: ["#", "Cliente", "Paese", "Linea", "Valore", "Tag", "Data"],
  ordersFootnoteGoogle:
    "* Ordini non tracciati dal tag Google — verificati manualmente da backend.",
  readingGoogleTitle: "Lettura  ·  Google Ads",

  section4: "4.  Analisi del Tracciamento",
  section4Sub:
    "Sintesi degli ordini tracciati dai sistemi pubblicitari rispetto a quelli effettivamente attribuibili da backend.",
  trackingHeaders: [
    "Canale",
    "Tracciati",
    "Non Tracciati",
    "Totale Reali",
    "Ricavi tracciati",
    "Ricavi non tracciati",
    "% non tracciato",
  ],
  implicationsTitle: "Implicazioni del tracciamento",

  section5: "5.  Priorità e Prossimi Passi",
  inProgress: "In corso",

  yes: "SÌ",
  no: "NO *",

  generatedAt: (date) =>
    `Dati estratti alla data del ${date} da Meta Ads Manager, Google Ads e backend ordini.`,

  defaultPriorityNotes: "",
};

const en: ReportStrings = {
  reportTitle: "Advertising Campaign Performance Report",
  channelsLine: (c) => c,
  contextTitle: "Report context",
  contextPeriod: (label, days) =>
    `Reporting period: ${label} (${days} day${days === 1 ? "" : "s"}).`,
  contextMeta: "Meta (Facebook / Instagram): ",
  contextGoogle: "Google Ads: ",
  contextOrders: "Order data: ",
  contextNotTracked: "were not tracked by the pixel/tag",
  contextOrdersTail:
    " — verified from the backend and attributed to the campaigns. The real values include these sales.",

  section1: "1.  Global Results",
  section1Sub: (label) =>
    `Consolidated view of both advertising channels for ${label}, including tracked and backend-attributed sales.`,
  card1Spend: "Total Ad Spend",
  card1Purchases: "Real Purchases",
  card1Revenue: "Revenue Generated",
  card1Roas: "Blended ROAS",

  channelComparisonTitle: "Channel comparison  —  Meta vs Google Ads",
  comparisonHeaders: [
    "Channel",
    "Period",
    "Spend",
    "Orders",
    "Revenue",
    "ROAS",
    "CPA",
  ],
  total: "TOTAL",

  readingGlobalTitle: "Reading  ·  Global view",

  section2: "2.  Meta Ads  ·  Facebook / Instagram",
  section2Sub:
    "Meta pixel data + backend integration. Real metrics include orders not tracked by the pixel.",
  card2Spend: "Meta Spend",
  card2Purchases: "Real Purchases",
  card2Revenue: "Meta Revenue",
  card2Roas: "Meta ROAS",

  funnelTitle: "Conversion Funnel",
  funnelHeaders: ["Stage", "N°", "Rate"],
  funnelStageImpression: "Impressions",
  funnelStageLinkClick: "Link clicks",
  funnelStageLpv: "Landing page views (LPV)",
  funnelStageAtc: "Add to cart",
  funnelStageCheckout: "Initiate checkout",
  funnelStagePurchasePixel: "Pixel-tracked purchases",
  funnelStagePurchaseReal: "Real purchases (backend)",

  deliveryTitle: "Delivery & Engagement",
  deliveryHeaders: [
    "Reach",
    "Impressions",
    "Frequency",
    "CPM",
    "Link CPC",
    "Link CTR",
    "LPV",
    "Cost / LPV",
  ],

  ordersMetaTitle: (count, total) =>
    `Orders attributed to Meta Ads  ·  ${count} orders  ·  ${total}`,
  ordersHeadersMeta: ["#", "Customer", "Country", "Line", "Value", "Pixel", "Date"],
  ordersFootnoteMeta:
    "* Orders not tracked by Meta pixel — manually verified in backend and attributable to the campaign.",

  section3: "3.  Google Ads",
  section3Sub:
    "Google conversions + backend integration. If the gap is large, verify Conversion Tracking setup.",
  card3Spend: "Google Spend",
  card3Conversions: "Conversions",
  card3Revenue: "Google Revenue",
  card3Roas: "Google ROAS",
  ordersGoogleTitle: (count, total) =>
    `Orders attributed to Google Ads  ·  ${count} orders  ·  ${total}`,
  ordersHeadersGoogle: ["#", "Customer", "Country", "Line", "Value", "Tag", "Date"],
  ordersFootnoteGoogle:
    "* Orders not tracked by the Google tag — manually verified in backend.",
  readingGoogleTitle: "Reading  ·  Google Ads",

  section4: "4.  Tracking Analysis",
  section4Sub:
    "Summary of orders tracked by the ad platforms vs orders attributable from the backend.",
  trackingHeaders: [
    "Channel",
    "Tracked",
    "Untracked",
    "Total Real",
    "Tracked revenue",
    "Untracked revenue",
    "% untracked",
  ],
  implicationsTitle: "Implications of tracking",

  section5: "5.  Priorities & Next Steps",
  inProgress: "In progress",

  yes: "YES",
  no: "NO *",

  generatedAt: (date) =>
    `Data pulled on ${date} from Meta Ads Manager, Google Ads, and the order backend.`,

  defaultPriorityNotes: "",
};

export function strings(language: ReportLanguage): ReportStrings {
  return language === "it" ? it : en;
}

// Italian formats currency as €1.234,56 — Intl handles this via "it-IT".
export function formatMoney(
  value: number,
  currency: string,
  language: ReportLanguage,
  digits = 2,
): string {
  const locale = language === "it" ? "it-IT" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatRoas(
  value: number | null,
  language: ReportLanguage,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const locale = language === "it" ? "it-IT" : "en-US";
  const num = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${num}x`;
}

export function formatNumberR(
  value: number,
  language: ReportLanguage,
): string {
  const locale = language === "it" ? "it-IT" : "en-US";
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercentR(
  value: number | null,
  language: ReportLanguage,
  digits = 2,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const locale = language === "it" ? "it-IT" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatRangeLabel(
  start: Date,
  end: Date,
  language: ReportLanguage,
): string {
  const locale = language === "it" ? "it-IT" : "en-US";
  const fmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: language === "it" ? "long" : "short",
  });
  const yearFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: language === "it" ? "long" : "short",
    year: "numeric",
  });
  return `${fmt.format(start)} – ${yearFmt.format(end)}`;
}
