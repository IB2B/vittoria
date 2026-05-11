import { describe, expect, it } from "vitest";

import {
  classifyObjective,
  dailyTimeSeries,
  summarizeByCampaign,
  summarizeInsights,
} from "./insights";
import type { MetaInsightRow } from "./types";

const baseRow = (overrides: Partial<MetaInsightRow> = {}): MetaInsightRow => ({
  date_start: "2026-04-01",
  date_stop: "2026-04-01",
  ...overrides,
});

describe("summarizeInsights", () => {
  it("returns zeroes for empty input without crashing on division", () => {
    const k = summarizeInsights([], {});
    expect(k.spend).toBe(0);
    expect(k.impressions).toBe(0);
    expect(k.frequency).toBeNull();
    expect(k.cpm).toBeNull();
    expect(k.cpcLink).toBeNull();
    expect(k.ctrLink).toBeNull();
    expect(k.roasPixel).toBeNull();
    expect(k.cpaPixel).toBeNull();
  });

  it("sums spend, impressions, link clicks across rows", () => {
    const rows: MetaInsightRow[] = [
      baseRow({
        spend: "10.00",
        impressions: "1000",
        inline_link_clicks: "50",
      }),
      baseRow({
        spend: "20.50",
        impressions: "2000",
        inline_link_clicks: "100",
      }),
    ];
    const k = summarizeInsights(rows, { accountReach: 800 });

    expect(k.spend).toBeCloseTo(30.5, 5);
    expect(k.impressions).toBe(3000);
    expect(k.linkClicks).toBe(150);
    // CPM = spend / impressions * 1000 = 30.5 / 3000 * 1000
    expect(k.cpm).toBeCloseTo((30.5 / 3000) * 1000, 5);
    // CTR (link) = linkClicks / impressions
    expect(k.ctrLink).toBeCloseTo(150 / 3000, 5);
    // CPC (link) = spend / linkClicks
    expect(k.cpcLink).toBeCloseTo(30.5 / 150, 5);
    // Frequency = impressions / reach (account-level)
    expect(k.frequency).toBeCloseTo(3000 / 800, 5);
  });

  it("sums purchase + revenue actions and computes both ROAS variants", () => {
    const rows: MetaInsightRow[] = [
      baseRow({
        spend: "100",
        impressions: "10000",
        actions: [
          { action_type: "offsite_conversion.fb_pixel_purchase", value: "5" },
          { action_type: "landing_page_view", value: "120" },
        ],
        action_values: [
          {
            action_type: "offsite_conversion.fb_pixel_purchase",
            value: "250.00",
          },
        ],
      }),
    ];
    const k = summarizeInsights(rows, {
      backendOrderCount: 2,
      backendOrderRevenue: 100,
    });

    expect(k.purchasesPixel).toBe(5);
    expect(k.purchasesReal).toBe(7);
    expect(k.revenuePixel).toBe(250);
    expect(k.revenueReal).toBe(350);
    // Pixel ROAS = pixel revenue / spend
    expect(k.roasPixel).toBeCloseTo(2.5, 5);
    // Real ROAS = real revenue / spend
    expect(k.roasReal).toBeCloseTo(3.5, 5);
    // CPA pixel = spend / pixel purchases
    expect(k.cpaPixel).toBeCloseTo(100 / 5, 5);
    expect(k.cpaReal).toBeCloseTo(100 / 7, 5);
    expect(k.landingPageViews).toBe(120);
  });

  it("dedups overlapping lead aliases — picks the highest-priority match per row", () => {
    // Real-world Meta payload: a single lead-form submission gets returned as
    // BOTH `lead` AND `onsite_conversion.lead_grouped` with the same value.
    // We must NOT sum both — that's the bug a user hit (3 actual leads showing
    // as 6).
    const rows: MetaInsightRow[] = [
      baseRow({
        spend: "60",
        actions: [
          { action_type: "lead", value: "3" }, // umbrella
          { action_type: "onsite_conversion.lead_grouped", value: "3" }, // higher priority
          { action_type: "post_engagement", value: "999" },
        ],
      }),
    ];
    const k = summarizeInsights(rows, {});
    expect(k.leads).toBe(3); // not 6
    expect(k.costPerLead).toBeCloseTo(60 / 3, 5);
  });

  it("falls back to legacy `lead` alias when no specific match", () => {
    const rows: MetaInsightRow[] = [
      baseRow({
        spend: "30",
        actions: [{ action_type: "lead", value: "5" }],
      }),
    ];
    const k = summarizeInsights(rows, {});
    expect(k.leads).toBe(5);
  });

  it("dedups overlapping purchase aliases the same way", () => {
    const rows: MetaInsightRow[] = [
      baseRow({
        spend: "100",
        actions: [
          { action_type: "purchase", value: "10" }, // umbrella
          { action_type: "offsite_conversion.fb_pixel_purchase", value: "10" }, // higher priority
        ],
        action_values: [
          { action_type: "purchase", value: "500" },
          { action_type: "offsite_conversion.fb_pixel_purchase", value: "500" },
        ],
      }),
    ];
    const k = summarizeInsights(rows, {});
    expect(k.purchasesPixel).toBe(10); // not 20
    expect(k.revenuePixel).toBe(500); // not 1000
  });

  it("returns null cost-per-lead when no leads were recorded", () => {
    const rows: MetaInsightRow[] = [
      baseRow({
        spend: "100",
        actions: [{ action_type: "post_engagement", value: "10" }],
      }),
    ];
    const k = summarizeInsights(rows, {});
    expect(k.leads).toBe(0);
    expect(k.costPerLead).toBeNull();
  });

  it("picks highest-priority ATC and IC alias per row (no double-count)", () => {
    const rows: MetaInsightRow[] = [
      baseRow({
        spend: "10",
        actions: [
          // Pixel takes priority over umbrella
          { action_type: "offsite_conversion.fb_pixel_add_to_cart", value: "20" },
          { action_type: "add_to_cart", value: "20" }, // duplicate umbrella
          // Pixel takes priority over omni
          {
            action_type: "offsite_conversion.fb_pixel_initiate_checkout",
            value: "8",
          },
          { action_type: "omni_initiated_checkout", value: "8" }, // duplicate
        ],
      }),
    ];
    const k = summarizeInsights(rows, {});
    expect(k.addToCart).toBe(20); // not 40
    expect(k.initiateCheckout).toBe(8); // not 16
  });

  it("ignores unrelated action types", () => {
    const rows: MetaInsightRow[] = [
      baseRow({
        spend: "5",
        actions: [
          { action_type: "post_engagement", value: "999" },
          { action_type: "offsite_conversion.fb_pixel_purchase", value: "1" },
        ],
        action_values: [
          { action_type: "post_engagement", value: "9999" },
          {
            action_type: "offsite_conversion.fb_pixel_purchase",
            value: "50",
          },
        ],
      }),
    ];
    const k = summarizeInsights(rows, {});
    expect(k.purchasesPixel).toBe(1);
    expect(k.revenuePixel).toBe(50);
  });

  it("falls back to null on division by zero rather than NaN/Infinity", () => {
    const rows: MetaInsightRow[] = [
      baseRow({ spend: "0", impressions: "0", inline_link_clicks: "0" }),
    ];
    const k = summarizeInsights(rows, {});
    expect(k.cpm).toBeNull();
    expect(k.cpcLink).toBeNull();
    expect(k.ctrLink).toBeNull();
    expect(k.frequency).toBeNull();
    expect(k.cpaPixel).toBeNull();
    expect(k.roasPixel).toBeNull();
  });
});

describe("classifyObjective", () => {
  it("maps lead-gen objectives to leads", () => {
    expect(classifyObjective("OUTCOME_LEADS")).toBe("leads");
    expect(classifyObjective("LEAD_GENERATION")).toBe("leads");
    expect(classifyObjective("outcome_leads")).toBe("leads");
  });
  it("maps sales/conversion objectives to sales", () => {
    expect(classifyObjective("OUTCOME_SALES")).toBe("sales");
    expect(classifyObjective("CONVERSIONS")).toBe("sales");
    expect(classifyObjective("PRODUCT_CATALOG_SALES")).toBe("sales");
  });
  it("falls back to other for unknown / undefined / engagement objectives", () => {
    expect(classifyObjective(undefined)).toBe("other");
    expect(classifyObjective(null)).toBe("other");
    expect(classifyObjective("OUTCOME_TRAFFIC")).toBe("other");
    expect(classifyObjective("BRAND_AWARENESS")).toBe("other");
  });
});

describe("summarizeByCampaign", () => {
  it("buckets rows by campaign_id and preserves campaign_name", () => {
    const rows: MetaInsightRow[] = [
      baseRow({
        campaign_id: "1",
        campaign_name: "Brand",
        spend: "10",
        impressions: "100",
      }),
      baseRow({
        campaign_id: "1",
        campaign_name: "Brand",
        spend: "5",
        impressions: "50",
      }),
      baseRow({
        campaign_id: "2",
        campaign_name: "Prospecting",
        spend: "20",
        impressions: "200",
      }),
    ];
    const out = summarizeByCampaign(rows);
    expect(out).toHaveLength(2);
    const brand = out.find((c) => c.campaignId === "1")!;
    const pros = out.find((c) => c.campaignId === "2")!;
    expect(brand.campaignName).toBe("Brand");
    expect(brand.spend).toBeCloseTo(15, 5);
    expect(brand.impressions).toBe(150);
    expect(pros.spend).toBeCloseTo(20, 5);
  });

  it("skips rows with no campaign_id", () => {
    const rows: MetaInsightRow[] = [
      baseRow({ spend: "10" }),
      baseRow({ campaign_id: "1", campaign_name: "X", spend: "5" }),
    ];
    const out = summarizeByCampaign(rows);
    expect(out).toHaveLength(1);
    expect(out[0].campaignId).toBe("1");
  });
});

describe("dailyTimeSeries", () => {
  it("groups by date_start and sums spend/revenue/purchases", () => {
    const rows: MetaInsightRow[] = [
      baseRow({
        date_start: "2026-04-01",
        spend: "10",
        actions: [
          { action_type: "offsite_conversion.fb_pixel_purchase", value: "1" },
        ],
        action_values: [
          {
            action_type: "offsite_conversion.fb_pixel_purchase",
            value: "100",
          },
        ],
      }),
      baseRow({
        date_start: "2026-04-01",
        spend: "5",
        actions: [
          { action_type: "offsite_conversion.fb_pixel_purchase", value: "2" },
        ],
        action_values: [
          {
            action_type: "offsite_conversion.fb_pixel_purchase",
            value: "200",
          },
        ],
      }),
      baseRow({ date_start: "2026-04-02", spend: "20" }),
    ];
    const series = dailyTimeSeries(rows);
    expect(series).toHaveLength(2);
    expect(series[0].date).toBe("2026-04-01");
    expect(series[0].spend).toBeCloseTo(15, 5);
    expect(series[0].purchases).toBe(3);
    expect(series[0].revenue).toBe(300);
    expect(series[1].date).toBe("2026-04-02");
    expect(series[1].spend).toBe(20);
  });
});
