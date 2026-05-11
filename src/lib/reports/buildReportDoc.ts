import {
  AlignmentType,
  Document,
  Footer,
  Packer,
  Paragraph,
  TextRun,
  type FileChild,
} from "docx";

import {
  calloutBox,
  dataTable,
  h1,
  metricsRow,
  p,
  priorityRow,
  sectionTitle,
  spacer,
  subtitle,
  type DataCellInput,
  type CalloutLine,
} from "./components";
import {
  formatMoney,
  formatNumberR,
  formatPercentR,
  formatRangeLabel,
  formatRoas,
  strings,
} from "./i18n";
import { PALETTE, PAGE } from "./style";
import type {
  PriorityTone,
  ReportInput,
  ReportPriority,
} from "./types";

const FONT = "Arial";

function toneFill(tone: PriorityTone): string {
  switch (tone) {
    case "meta":
      return PALETTE.meta;
    case "google":
      return PALETTE.google;
    case "good":
      return PALETTE.good;
    case "warn":
      return PALETTE.warn;
    case "bad":
      return PALETTE.bad;
    case "brand":
      return PALETTE.brand;
    case "accent":
      return PALETTE.accent;
    case "purple":
      return PALETTE.purple;
  }
}

export async function buildReportDoc(
  input: ReportInput,
): Promise<Buffer> {
  const t = strings(input.language);
  const periodLabel =
    input.period.label ||
    formatRangeLabel(input.period.start, input.period.end, input.language);
  const days = input.period.daysCount;
  const cur = input.currency;

  const meta = input.meta;
  const google = input.google ?? null;

  // Combined totals
  const combinedSpend = meta.spend + (google?.spend ?? 0);
  const combinedRevenue = meta.realRevenue + (google?.realRevenue ?? 0);
  const combinedPurchases =
    meta.realPurchases + (google?.realPurchases ?? 0);
  const combinedRoas =
    combinedSpend > 0 ? combinedRevenue / combinedSpend : null;
  const combinedCpa =
    combinedPurchases > 0 ? combinedSpend / combinedPurchases : null;

  const channelsLine = google
    ? `${input.client.name}  ·  Meta + Google Ads  ·  ${periodLabel}`
    : `${input.client.name}  ·  Meta Ads  ·  ${periodLabel}`;

  const children: FileChild[] = [];

  // === HEADER ===
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: input.client.name.toUpperCase(),
          bold: true,
          size: 30,
          color: PALETTE.brand,
          font: FONT,
        }),
      ],
    }),
    h1(t.reportTitle),
    subtitle(channelsLine),
  );

  // === CONTEXT ===
  const contextBody: CalloutLine[] = input.contextNote
    ? [[{ text: input.contextNote }]]
    : [
        [
          { text: t.contextPeriod(periodLabel, days), bold: true },
        ],
        ...(google
          ? [
              [
                { text: `  •  ${t.contextMeta}`, bold: true, color: PALETTE.meta },
                {
                  text: meta.daysActive
                    ? `${meta.daysActive} ${input.language === "it" ? "giorni di attività" : "days of activity"}.`
                    : "",
                },
              ] as CalloutLine,
              [
                { text: `  •  ${t.contextGoogle}`, bold: true, color: PALETTE.google },
                {
                  text: google.daysActive
                    ? `${google.daysActive} ${input.language === "it" ? "giorni di attività" : "days of activity"}.`
                    : "",
                },
              ] as CalloutLine,
            ]
          : []),
        [
          { text: t.contextOrders, bold: true },
          {
            text:
              input.language === "it"
                ? "verificati da backend. Alcune vendite "
                : "verified from backend. Some sales ",
          },
          { text: t.contextNotTracked, bold: true, color: PALETTE.bad },
          { text: t.contextOrdersTail },
        ],
      ];

  children.push(
    calloutBox({ title: t.contextTitle, body: contextBody }),
  );

  // === VITTORIA INSIGHT (AI executive summary) ===
  if (input.narrative?.executive_summary) {
    const insightTitle =
      input.language === "it"
        ? "Vittoria  ·  Sintesi del periodo"
        : "Vittoria  ·  Period summary";
    const insightBody: CalloutLine[] = [
      [{ text: input.narrative.executive_summary }],
      ...(input.narrative.performance_highlights ?? []).map(
        (h): CalloutLine => [{ text: `  •  ${h}` }],
      ),
    ];
    children.push(
      calloutBox({
        title: insightTitle,
        body: insightBody,
        titleColor: PALETTE.brand,
      }),
    );
  }

  // === SECTION 1 — COMBINED ===
  children.push(sectionTitle(t.section1, PALETTE.brand));
  children.push(
    p(t.section1Sub(periodLabel), {
      size: 20,
      color: PALETTE.textMuted,
      italics: true,
      spacing: { after: 160 },
    }),
  );

  // Lead-gen clients have no purchases / revenue / ROAS — showing zeros there
  // is misleading. We swap the second pair of cards to Leads + CPL when the
  // detected profile is lead_gen.
  const isLeadGen = meta.campaignProfile === "lead_gen";
  const card1Cards = isLeadGen
    ? [
        {
          value: formatMoney(combinedSpend, cur, input.language, 2),
          label: t.card1Spend,
          sub: google
            ? `Meta ${formatMoney(meta.spend, cur, input.language, 2)} + Google ${formatMoney(google.spend, cur, input.language, 2)}`
            : "",
          color: PALETTE.brand,
        },
        {
          value: formatNumberR(meta.leads, input.language),
          label: input.language === "it" ? "Lead Acquisiti" : "Leads Acquired",
          sub:
            input.language === "it"
              ? "Modulo Meta + pixel"
              : "Meta form + pixel",
          color: PALETTE.good,
        },
        {
          value:
            meta.costPerLead != null
              ? formatMoney(meta.costPerLead, cur, input.language, 2)
              : "—",
          label: input.language === "it" ? "Costo per Lead" : "Cost per Lead",
          sub:
            input.language === "it"
              ? "Spesa Meta / lead"
              : "Meta spend / lead",
          color: PALETTE.accent,
        },
        {
          value: formatNumberR(meta.reach, input.language),
          label: "Reach",
          sub:
            meta.frequency != null
              ? `${input.language === "it" ? "Frequenza" : "Frequency"} ${meta.frequency.toFixed(2)}×`
              : "",
          color: PALETTE.purple,
        },
      ]
    : [
        {
          value: formatMoney(combinedSpend, cur, input.language, 2),
          label: t.card1Spend,
          sub: google
            ? `Meta ${formatMoney(meta.spend, cur, input.language, 2)} + Google ${formatMoney(google.spend, cur, input.language, 2)}`
            : "",
          color: PALETTE.brand,
        },
        {
          value: formatNumberR(combinedPurchases, input.language),
          label: t.card1Purchases,
          sub: google
            ? `${formatNumberR(meta.realPurchases, input.language)} Meta + ${formatNumberR(google.realPurchases, input.language)} Google`
            : `${formatNumberR(meta.pixelPurchases, input.language)} pixel + ${formatNumberR(meta.realPurchases - meta.pixelPurchases, input.language)} backend`,
          color: PALETTE.good,
        },
        {
          value: formatMoney(combinedRevenue, cur, input.language, 2),
          label: t.card1Revenue,
          sub:
            input.language === "it"
              ? "Da ordini verificati"
              : "From verified orders",
          color: PALETTE.accent,
        },
        {
          value: formatRoas(combinedRoas, input.language),
          label: t.card1Roas,
          sub:
            combinedCpa != null
              ? `CPA ${formatMoney(combinedCpa, cur, input.language, 2)}`
              : "",
          color: PALETTE.purple,
        },
      ];

  children.push(metricsRow(card1Cards));

  children.push(spacer());

  // Channel comparison table
  children.push(
    new Paragraph({
      spacing: { before: 120, after: 80 },
      children: [
        new TextRun({
          text: t.channelComparisonTitle,
          bold: true,
          size: 22,
          color: PALETTE.brand,
          font: FONT,
        }),
      ],
    }),
  );

  const comparisonRows: DataCellInput[][] = [];
  comparisonRows.push([
    { text: "Meta Ads", bold: true, color: PALETTE.meta, fill: PALETTE.metaSoft },
    {
      text: meta.daysActive
        ? `${periodLabel}${meta.daysActive ? ` (${meta.daysActive} gg)` : ""}`
        : periodLabel,
      fill: PALETTE.metaSoft,
    },
    { text: formatMoney(meta.spend, cur, input.language, 2), bold: true, fill: PALETTE.metaSoft },
    { text: formatNumberR(meta.realPurchases, input.language), bold: true, fill: PALETTE.metaSoft },
    { text: formatMoney(meta.realRevenue, cur, input.language, 2), bold: true, fill: PALETTE.metaSoft },
    {
      text: formatRoas(meta.realRoas, input.language),
      bold: true,
      color:
        meta.realRoas != null && meta.realRoas < 1
          ? PALETTE.bad
          : PALETTE.good,
      fill: PALETTE.metaSoft,
    },
    {
      text: meta.realCpa != null ? formatMoney(meta.realCpa, cur, input.language, 2) : "—",
      fill: PALETTE.metaSoft,
    },
  ]);

  if (google) {
    comparisonRows.push([
      { text: "Google Ads", bold: true, color: PALETTE.google, fill: PALETTE.googleSoft },
      {
        text: google.daysActive
          ? `${periodLabel} (${google.daysActive} gg)`
          : periodLabel,
        fill: PALETTE.googleSoft,
      },
      { text: formatMoney(google.spend, cur, input.language, 2), bold: true, fill: PALETTE.googleSoft },
      { text: formatNumberR(google.realPurchases, input.language), bold: true, fill: PALETTE.googleSoft },
      { text: formatMoney(google.realRevenue, cur, input.language, 2), bold: true, fill: PALETTE.googleSoft },
      {
        text: formatRoas(google.realRoas, input.language),
        bold: true,
        color:
          google.realRoas != null && google.realRoas < 1
            ? PALETTE.bad
            : PALETTE.good,
        fill: PALETTE.googleSoft,
      },
      {
        text:
          google.realCpa != null
            ? formatMoney(google.realCpa, cur, input.language, 2)
            : "—",
        fill: PALETTE.googleSoft,
      },
    ]);
  }

  comparisonRows.push([
    { text: t.total, bold: true, fill: PALETTE.brandSoft, color: PALETTE.brand },
    { text: periodLabel, fill: PALETTE.brandSoft, bold: true },
    { text: formatMoney(combinedSpend, cur, input.language, 2), bold: true, fill: PALETTE.brandSoft, color: PALETTE.brand },
    { text: formatNumberR(combinedPurchases, input.language), bold: true, fill: PALETTE.brandSoft, color: PALETTE.brand },
    { text: formatMoney(combinedRevenue, cur, input.language, 2), bold: true, fill: PALETTE.brandSoft, color: PALETTE.brand },
    { text: formatRoas(combinedRoas, input.language), bold: true, fill: PALETTE.brandSoft, color: PALETTE.brand },
    {
      text:
        combinedCpa != null
          ? formatMoney(combinedCpa, cur, input.language, 2)
          : "—",
      bold: true,
      fill: PALETTE.brandSoft,
    },
  ]);

  children.push(
    dataTable({
      headers: t.comparisonHeaders,
      columnWidths: [1700, 1500, 1200, 1000, 1200, 1100, 1324],
      rows: comparisonRows,
    }),
  );

  // === SECTION 2 — META ===
  children.push(sectionTitle(t.section2, PALETTE.meta));
  children.push(
    p(t.section2Sub, {
      size: 20,
      color: PALETTE.textMuted,
      italics: true,
      spacing: { after: 160 },
    }),
  );

  children.push(
    metricsRow([
      {
        value: formatMoney(meta.spend, cur, input.language, 2),
        label: t.card2Spend,
        sub: meta.daysActive
          ? `${meta.daysActive} ${input.language === "it" ? "giorni di delivery" : "days of delivery"}`
          : "",
        color: PALETTE.meta,
      },
      {
        value: formatNumberR(meta.realPurchases, input.language),
        label: t.card2Purchases,
        sub: `${formatNumberR(meta.pixelPurchases, input.language)} pixel + ${formatNumberR(meta.realPurchases - meta.pixelPurchases, input.language)} backend`,
        color: PALETTE.good,
      },
      {
        value: formatMoney(meta.realRevenue, cur, input.language, 2),
        label: t.card2Revenue,
        sub: "",
        color: PALETTE.accent,
      },
      {
        value: formatRoas(meta.realRoas, input.language),
        label: t.card2Roas,
        sub:
          meta.realCpa != null
            ? `CPA ${formatMoney(meta.realCpa, cur, input.language, 2)}`
            : "",
        color:
          meta.realRoas != null && meta.realRoas < 1
            ? PALETTE.bad
            : PALETTE.good,
      },
    ]),
  );

  children.push(spacer());

  // Funnel
  children.push(
    new Paragraph({
      spacing: { before: 120, after: 80 },
      children: [
        new TextRun({
          text: t.funnelTitle,
          bold: true,
          size: 22,
          color: PALETTE.meta,
          font: FONT,
        }),
      ],
    }),
  );

  const ratio = (a: number, b: number) =>
    b > 0 ? formatPercentR(a / b, input.language, 2) : "—";

  children.push(
    dataTable({
      headers: t.funnelHeaders,
      columnWidths: [4500, 2200, 2324],
      headerFill: PALETTE.meta,
      rows: [
        [
          { text: t.funnelStageImpression, align: AlignmentType.LEFT, bold: true },
          formatNumberR(meta.impressions, input.language),
          "—",
        ],
        [
          { text: t.funnelStageLinkClick, align: AlignmentType.LEFT, bold: true },
          formatNumberR(meta.linkClicks, input.language),
          ratio(meta.linkClicks, meta.impressions),
        ],
        [
          { text: t.funnelStageLpv, align: AlignmentType.LEFT, bold: true },
          formatNumberR(meta.landingPageViews, input.language),
          ratio(meta.landingPageViews, meta.linkClicks),
        ],
        [
          { text: t.funnelStageAtc, align: AlignmentType.LEFT, bold: true },
          formatNumberR(meta.addToCart, input.language),
          ratio(meta.addToCart, meta.landingPageViews),
        ],
        [
          { text: t.funnelStageCheckout, align: AlignmentType.LEFT, bold: true },
          formatNumberR(meta.initiateCheckout, input.language),
          ratio(meta.initiateCheckout, meta.addToCart),
        ],
        [
          {
            text: t.funnelStagePurchasePixel,
            align: AlignmentType.LEFT,
            bold: true,
            color: PALETTE.warn,
          },
          formatNumberR(meta.pixelPurchases, input.language),
          ratio(meta.pixelPurchases, meta.initiateCheckout),
        ],
        [
          {
            text: t.funnelStagePurchaseReal,
            align: AlignmentType.LEFT,
            bold: true,
            color: PALETTE.good,
          },
          {
            text: formatNumberR(meta.realPurchases, input.language),
            bold: true,
            color: PALETTE.good,
          },
          {
            text:
              meta.pixelPurchases > 0 && meta.realPurchases > meta.pixelPurchases
                ? `+${(((meta.realPurchases - meta.pixelPurchases) / meta.pixelPurchases) * 100).toFixed(0)}% vs pixel`
                : "—",
            color: PALETTE.good,
            bold: true,
          },
        ],
      ],
    }),
  );

  children.push(spacer());

  // Delivery
  children.push(
    new Paragraph({
      spacing: { before: 120, after: 80 },
      children: [
        new TextRun({
          text: t.deliveryTitle,
          bold: true,
          size: 22,
          color: PALETTE.meta,
          font: FONT,
        }),
      ],
    }),
  );

  children.push(
    dataTable({
      headers: t.deliveryHeaders,
      columnWidths: [1100, 1300, 1100, 1000, 1100, 1100, 1000, 1324],
      headerFill: PALETTE.meta,
      rows: [
        [
          formatNumberR(meta.reach, input.language),
          formatNumberR(meta.impressions, input.language),
          meta.frequency != null ? meta.frequency.toFixed(2) : "—",
          meta.cpm != null ? formatMoney(meta.cpm, cur, input.language, 2) : "—",
          meta.cpcLink != null
            ? formatMoney(meta.cpcLink, cur, input.language, 2)
            : "—",
          formatPercentR(meta.ctrLink, input.language, 2),
          formatNumberR(meta.landingPageViews, input.language),
          meta.costPerLpv != null
            ? formatMoney(meta.costPerLpv, cur, input.language, 2)
            : "—",
        ],
      ],
    }),
  );

  // Meta orders table (if any)
  if (meta.orders && meta.orders.length > 0) {
    children.push(spacer());
    const total = meta.orders.reduce((acc, o) => acc + o.value, 0);
    children.push(
      new Paragraph({
        spacing: { before: 120, after: 80 },
        children: [
          new TextRun({
            text: t.ordersMetaTitle(
              meta.orders.length,
              formatMoney(total, cur, input.language, 2),
            ),
            bold: true,
            size: 22,
            color: PALETTE.meta,
            font: FONT,
          }),
        ],
      }),
    );
    const orderRows: DataCellInput[][] = meta.orders.map((o) => [
      o.reference,
      o.customer ?? "—",
      o.country ?? "—",
      o.line ?? "—",
      formatMoney(o.value, cur, input.language, 2),
      o.tracked
        ? { text: t.yes, color: PALETTE.good, bold: true }
        : { text: t.no, color: PALETTE.bad, bold: true },
      o.occurredAt.toLocaleString(input.language === "it" ? "it-IT" : "en-US", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    ]);
    const trackedCount = meta.orders.filter((o) => o.tracked).length;
    orderRows.push([
      { text: t.total, bold: true, fill: PALETTE.metaSoft, color: PALETTE.meta },
      {
        text: `${meta.orders.length} ${input.language === "it" ? "ordini" : "orders"}`,
        bold: true,
        fill: PALETTE.metaSoft,
        color: PALETTE.meta,
      },
      { text: "—", fill: PALETTE.metaSoft },
      { text: "—", fill: PALETTE.metaSoft },
      {
        text: formatMoney(total, cur, input.language, 2),
        bold: true,
        fill: PALETTE.metaSoft,
        color: PALETTE.meta,
      },
      {
        text: `${trackedCount} ${t.yes} · ${meta.orders.length - trackedCount} ${t.no.replace(" *", "")}`,
        fill: PALETTE.metaSoft,
        bold: true,
      },
      { text: "—", fill: PALETTE.metaSoft },
    ]);
    children.push(
      dataTable({
        headers: t.ordersHeadersMeta,
        columnWidths: [950, 1850, 1250, 1250, 1100, 1100, 1524],
        headerFill: PALETTE.meta,
        rows: orderRows,
      }),
    );
    children.push(
      p(t.ordersFootnoteMeta, {
        size: 16,
        color: PALETTE.textMuted,
        italics: true,
        spacing: { before: 60, after: 200 },
      }),
    );
  }

  // === SECTION 3 — GOOGLE ===
  if (google) {
    children.push(sectionTitle(t.section3, PALETTE.google));
    children.push(
      p(t.section3Sub, {
        size: 20,
        color: PALETTE.textMuted,
        italics: true,
        spacing: { after: 160 },
      }),
    );

    children.push(
      metricsRow([
        {
          value: formatMoney(google.spend, cur, input.language, 2),
          label: t.card3Spend,
          sub: google.daysActive
            ? `${google.daysActive} ${input.language === "it" ? "giorni" : "days"}`
            : "",
          color: PALETTE.google,
        },
        {
          value: formatNumberR(google.realPurchases, input.language),
          label: t.card3Conversions,
          sub: `${formatNumberR(google.trackedConversions, input.language)} ${input.language === "it" ? "tracciati" : "tracked"} + ${formatNumberR(google.realPurchases - google.trackedConversions, input.language)} backend`,
          color: PALETTE.good,
        },
        {
          value: formatMoney(google.realRevenue, cur, input.language, 2),
          label: t.card3Revenue,
          sub: "",
          color: PALETTE.accent,
        },
        {
          value: formatRoas(google.realRoas, input.language),
          label: t.card3Roas,
          sub:
            google.realCpa != null
              ? `CPA ${formatMoney(google.realCpa, cur, input.language, 2)}`
              : "",
          color:
            google.realRoas != null && google.realRoas < 1
              ? PALETTE.bad
              : PALETTE.good,
        },
      ]),
    );

    if (google.orders && google.orders.length > 0) {
      children.push(spacer());
      const total = google.orders.reduce((acc, o) => acc + o.value, 0);
      children.push(
        new Paragraph({
          spacing: { before: 120, after: 80 },
          children: [
            new TextRun({
              text: t.ordersGoogleTitle(
                google.orders.length,
                formatMoney(total, cur, input.language, 2),
              ),
              bold: true,
              size: 22,
              color: PALETTE.google,
              font: FONT,
            }),
          ],
        }),
      );
      const orderRows: DataCellInput[][] = google.orders.map((o) => [
        o.reference,
        o.customer ?? "—",
        o.country ?? "—",
        o.line ?? "—",
        formatMoney(o.value, cur, input.language, 2),
        o.tracked
          ? { text: t.yes, color: PALETTE.good, bold: true }
          : { text: t.no, color: PALETTE.bad, bold: true },
        o.occurredAt.toLocaleString(
          input.language === "it" ? "it-IT" : "en-US",
          {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          },
        ),
      ]);
      const trackedCount = google.orders.filter((o) => o.tracked).length;
      orderRows.push([
        {
          text: t.total,
          bold: true,
          fill: PALETTE.googleSoft,
          color: PALETTE.google,
        },
        {
          text: `${google.orders.length} ${input.language === "it" ? "ordini" : "orders"}`,
          bold: true,
          fill: PALETTE.googleSoft,
          color: PALETTE.google,
        },
        { text: "—", fill: PALETTE.googleSoft },
        { text: "—", fill: PALETTE.googleSoft },
        {
          text: formatMoney(total, cur, input.language, 2),
          bold: true,
          fill: PALETTE.googleSoft,
          color: PALETTE.google,
        },
        {
          text: `${trackedCount} ${t.yes} · ${google.orders.length - trackedCount} ${t.no.replace(" *", "")}`,
          fill: PALETTE.googleSoft,
          bold: true,
        },
        { text: "—", fill: PALETTE.googleSoft },
      ]);
      children.push(
        dataTable({
          headers: t.ordersHeadersGoogle,
          columnWidths: [950, 1850, 1250, 1250, 1100, 1100, 1524],
          headerFill: PALETTE.google,
          rows: orderRows,
        }),
      );
      children.push(
        p(t.ordersFootnoteGoogle, {
          size: 16,
          color: PALETTE.textMuted,
          italics: true,
          spacing: { before: 60, after: 200 },
        }),
      );
    }
  }

  // === SECTION 4 — TRACKING ANALYSIS ===
  const metaUntracked = Math.max(
    0,
    meta.realPurchases - meta.pixelPurchases,
  );
  const metaTrackedRevenue = meta.pixelRevenue;
  const metaUntrackedRevenue = Math.max(
    0,
    meta.realRevenue - meta.pixelRevenue,
  );
  const metaPctUntracked =
    meta.realRevenue > 0 ? metaUntrackedRevenue / meta.realRevenue : 0;

  const trackingHasData =
    metaUntracked > 0 ||
    metaTrackedRevenue > 0 ||
    !!google;

  if (trackingHasData) {
    children.push(sectionTitle(t.section4, PALETTE.warn));
    children.push(
      p(t.section4Sub, {
        size: 20,
        color: PALETTE.textMuted,
        italics: true,
        spacing: { after: 160 },
      }),
    );

    const trackingRows: DataCellInput[][] = [
      [
        { text: "Meta Ads", bold: true, color: PALETTE.meta, fill: PALETTE.metaSoft },
        { text: formatNumberR(meta.pixelPurchases, input.language), fill: PALETTE.metaSoft },
        {
          text: formatNumberR(metaUntracked, input.language),
          fill: PALETTE.metaSoft,
          color: metaUntracked > 0 ? PALETTE.bad : undefined,
          bold: metaUntracked > 0,
        },
        { text: formatNumberR(meta.realPurchases, input.language), fill: PALETTE.metaSoft, bold: true },
        { text: formatMoney(metaTrackedRevenue, cur, input.language, 2), fill: PALETTE.metaSoft },
        {
          text: formatMoney(metaUntrackedRevenue, cur, input.language, 2),
          fill: PALETTE.metaSoft,
          color: metaUntrackedRevenue > 0 ? PALETTE.bad : undefined,
          bold: metaUntrackedRevenue > 0,
        },
        {
          text: formatPercentR(metaPctUntracked, input.language, 1),
          fill: PALETTE.metaSoft,
          color: metaPctUntracked > 0.2 ? PALETTE.bad : undefined,
          bold: true,
        },
      ],
    ];

    if (google) {
      const gUntracked = Math.max(
        0,
        google.realPurchases - google.trackedConversions,
      );
      const gUntrackedRev = Math.max(
        0,
        google.realRevenue - google.trackedRevenue,
      );
      const gPctUntracked =
        google.realRevenue > 0 ? gUntrackedRev / google.realRevenue : 0;
      trackingRows.push([
        { text: "Google Ads", bold: true, color: PALETTE.google, fill: PALETTE.googleSoft },
        { text: formatNumberR(google.trackedConversions, input.language), fill: PALETTE.googleSoft },
        {
          text: formatNumberR(gUntracked, input.language),
          fill: PALETTE.googleSoft,
          color: gUntracked > 0 ? PALETTE.bad : undefined,
          bold: gUntracked > 0,
        },
        { text: formatNumberR(google.realPurchases, input.language), fill: PALETTE.googleSoft, bold: true },
        { text: formatMoney(google.trackedRevenue, cur, input.language, 2), fill: PALETTE.googleSoft },
        {
          text: formatMoney(gUntrackedRev, cur, input.language, 2),
          fill: PALETTE.googleSoft,
          color: gUntrackedRev > 0 ? PALETTE.bad : undefined,
          bold: gUntrackedRev > 0,
        },
        {
          text: formatPercentR(gPctUntracked, input.language, 1),
          fill: PALETTE.googleSoft,
          color: gPctUntracked > 0.2 ? PALETTE.bad : undefined,
          bold: true,
        },
      ]);
    }

    // TOTALE row
    const totalTracked =
      meta.pixelPurchases + (google?.trackedConversions ?? 0);
    const totalReal = combinedPurchases;
    const totalUntracked = totalReal - totalTracked;
    const totalTrackedRev =
      metaTrackedRevenue + (google?.trackedRevenue ?? 0);
    const totalUntrackedRev = combinedRevenue - totalTrackedRev;
    const pctTotal =
      combinedRevenue > 0 ? totalUntrackedRev / combinedRevenue : 0;
    trackingRows.push([
      { text: t.total, bold: true, fill: PALETTE.brandSoft, color: PALETTE.brand },
      { text: formatNumberR(totalTracked, input.language), bold: true, fill: PALETTE.brandSoft },
      {
        text: formatNumberR(totalUntracked, input.language),
        bold: true,
        fill: PALETTE.brandSoft,
        color: totalUntracked > 0 ? PALETTE.bad : undefined,
      },
      { text: formatNumberR(totalReal, input.language), bold: true, fill: PALETTE.brandSoft, color: PALETTE.brand },
      { text: formatMoney(totalTrackedRev, cur, input.language, 2), bold: true, fill: PALETTE.brandSoft },
      {
        text: formatMoney(totalUntrackedRev, cur, input.language, 2),
        bold: true,
        fill: PALETTE.brandSoft,
        color: totalUntrackedRev > 0 ? PALETTE.bad : undefined,
      },
      {
        text: formatPercentR(pctTotal, input.language, 1),
        bold: true,
        fill: PALETTE.brandSoft,
        color: pctTotal > 0.2 ? PALETTE.bad : undefined,
      },
    ]);

    children.push(
      dataTable({
        headers: t.trackingHeaders,
        columnWidths: [1200, 1100, 1300, 1200, 1400, 1500, 1324],
        rows: trackingRows,
      }),
    );
  }

  // === VITTORIA RECOMMENDATIONS (AI suggestions) ===
  if (
    input.narrative?.recommendations &&
    input.narrative.recommendations.length > 0
  ) {
    const recsTitle =
      input.language === "it"
        ? "Raccomandazioni  ·  Suggerimenti di Vittoria"
        : "Recommendations  ·  Vittoria's suggestions";
    children.push(sectionTitle(recsTitle, PALETTE.brand));
    input.narrative.recommendations.forEach((rec, i) => {
      children.push(
        priorityRow(
          PALETTE.brand,
          `R${i + 1}`,
          rec,
          input.narrative?.flags?.[i] ?? "",
        ),
      );
      if (i < (input.narrative?.recommendations?.length ?? 0) - 1) {
        children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
      }
    });
    children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
  }

  // === SECTION 5 — PRIORITIES (manager-curated) ===
  const priorities: ReportPriority[] = input.priorities ?? [];
  if (priorities.length > 0) {
    children.push(sectionTitle(t.section5, PALETTE.brand));
    priorities.forEach((pr, i) => {
      children.push(priorityRow(toneFill(pr.tone), pr.tag, pr.title, pr.body));
      if (i < priorities.length - 1) {
        children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
      }
    });
  }

  // === FOOTER LINE ===
  children.push(new Paragraph({ spacing: { before: 400 }, children: [] }));
  children.push(
    p(
      t.generatedAt(
        input.period.end.toLocaleDateString(
          input.language === "it" ? "it-IT" : "en-US",
        ),
      ),
      {
        size: 16,
        color: PALETTE.textMuted,
        italics: true,
        align: AlignmentType.CENTER,
      },
    ),
  );

  // === BUILD DOCUMENT ===
  const doc = new Document({
    creator: "Vittoria — Alpha Digital",
    title: `${t.reportTitle} — ${input.client.name}`,
    styles: {
      default: { document: { run: { font: FONT, size: 22 } } },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE.width, height: PAGE.height },
            margin: {
              top: PAGE.margin,
              right: PAGE.margin,
              bottom: PAGE.margin,
              left: PAGE.margin,
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `Vittoria  ·  ${input.client.name}  ·  ${periodLabel}`,
                    size: 16,
                    color: PALETTE.textMuted,
                    italics: true,
                    font: FONT,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
