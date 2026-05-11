import { getLlmClient, hasLlmCredentials } from "@/lib/llm/client";
import { getAgent } from "@/lib/llm/agents";

import type { ReportInput, ReportNarrative } from "./types";

// Asks the report_narrator agent (Sonnet 4.5 via OpenRouter) to write the
// executive summary, performance highlights, and recommendations sections of
// the report based on the actual numbers and the detected campaign profile
// (lead-gen vs ecommerce vs mixed). Returns null if the API isn't configured
// or the model returns malformed output — callers should treat that as "no
// AI section" and continue.
export async function generateReportNarrative(
  input: ReportInput,
): Promise<ReportNarrative | null> {
  if (!hasLlmCredentials()) return null;

  const agent = getAgent("report_narrator");
  const client = getLlmClient();

  const lang = input.language === "it" ? "Italian" : "English";
  const profile = input.meta.campaignProfile;
  const meta = input.meta;
  const google = input.google;
  const cur = input.currency;

  const dataDump = `
## Client
- Name: ${input.client.name}
- Period: ${input.period.label} (${input.period.daysCount} days)
- Currency: ${cur}
- Campaign profile: ${profile}

## Meta Ads
- Spend: ${cur} ${meta.spend.toFixed(2)}
- Impressions: ${meta.impressions.toLocaleString()}
- Reach: ${meta.reach.toLocaleString()}${meta.frequency != null ? ` (frequency ${meta.frequency.toFixed(2)}×)` : ""}
- CTR (link): ${meta.ctrLink != null ? (meta.ctrLink * 100).toFixed(2) + "%" : "—"}
- CPC (link): ${meta.cpcLink != null ? cur + " " + meta.cpcLink.toFixed(2) : "—"}
- CPM: ${meta.cpm != null ? cur + " " + meta.cpm.toFixed(2) : "—"}
- Link clicks: ${meta.linkClicks.toLocaleString()}
- Landing page views: ${meta.landingPageViews.toLocaleString()}
- Add-to-cart: ${meta.addToCart}
- Initiate checkout: ${meta.initiateCheckout}
- Leads: ${meta.leads}${meta.costPerLead != null ? ` (CPL ${cur} ${meta.costPerLead.toFixed(2)})` : ""}
- Purchases (pixel): ${meta.pixelPurchases}
- Purchases (real, incl. backend): ${meta.realPurchases}
- Revenue (real): ${cur} ${meta.realRevenue.toFixed(2)}
- ROAS (real): ${meta.realRoas != null ? meta.realRoas.toFixed(2) + "×" : "—"}
- CPA (real): ${meta.realCpa != null ? cur + " " + meta.realCpa.toFixed(2) : "—"}
${
  google
    ? `
## Google Ads (manual entry)
- Spend: ${cur} ${google.spend.toFixed(2)}
- Conversions: ${google.realPurchases}
- Revenue: ${cur} ${google.realRevenue.toFixed(2)}
- ROAS: ${google.realRoas != null ? google.realRoas.toFixed(2) + "×" : "—"}
`
    : "\n## Google Ads\nNo Google Ads totals for this period."
}
${
  input.contextNote
    ? `
## Manager note
${input.contextNote}
`
    : ""
}
`.trim();

  const profileGuidance = (() => {
    switch (profile) {
      case "lead_gen":
        return [
          "This is a LEAD-GEN client. ROAS / revenue / purchases are all 0 because the campaigns drive lead-form submissions, not sales.",
          "Focus the narrative on leads, cost-per-lead, lead-form fill quality, audience signals.",
          "Do NOT mention ROAS or purchases negatively — those metrics don't apply here.",
        ].join(" ");
      case "ecommerce":
        return [
          "This is an ECOMMERCE client. Focus on purchases, revenue, ROAS, AOV, the funnel from impressions to purchase.",
          "Pixel-vs-real attribution gap is worth flagging if material.",
        ].join(" ");
      case "mixed":
        return [
          "This client runs BOTH lead-gen and sales campaigns.",
          "Cover both — but lead-gen and sales should be assessed separately, with their own metrics.",
        ].join(" ");
      case "awareness":
        return [
          "This client has spend with NO conversion events recorded — pure awareness/reach.",
          "Focus the narrative on reach efficiency (CPM, frequency, CTR) and flag the lack of conversion events as a tracking issue if appropriate.",
        ].join(" ");
    }
  })();

  const systemPrompt = `You are a senior performance-marketing analyst at an Italian agency. You're writing the analytical sections of a client report (.docx output). Be direct, number-driven, and specific. Quote real numbers from the data. Never invent figures.

LANGUAGE: write the response in **${lang}**.

OUTPUT FORMAT — return ONE JSON object, no prose around it. Schema:
{
  "executive_summary": string (2–4 sentences, the headline read of the period),
  "performance_highlights": string[] (3–5 short bullets — what worked, what didn't, with numbers),
  "recommendations": string[] (3–5 actionable bullets — specific levers to pull next period),
  "flags": string[] (optional — tracking issues, sync errors, suspicious gaps)
}

CONTEXT GUIDANCE FOR THIS CLIENT:
${profileGuidance}

Keep bullets concise — one line each, max ~25 words. Currency: ${cur}, two decimals, e.g. "${cur} 1.234,56".`;

  const userPrompt = `Generate the narrative sections for this report. Data:\n\n${dataDump}`;

  const response = await client.chat.completions.create({
    model: agent.model,
    max_tokens: agent.maxOutputTokens,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim();
  if (!raw) return null;
  try {
    const stripped = raw.startsWith("```")
      ? raw.replace(/^```(?:json)?\s*/u, "").replace(/```\s*$/u, "")
      : raw;
    const parsed = JSON.parse(stripped) as ReportNarrative;
    if (
      typeof parsed.executive_summary !== "string" ||
      !Array.isArray(parsed.performance_highlights) ||
      !Array.isArray(parsed.recommendations)
    ) {
      return null;
    }
    return {
      executive_summary: parsed.executive_summary,
      performance_highlights: parsed.performance_highlights.map(String),
      recommendations: parsed.recommendations.map(String),
      flags: Array.isArray(parsed.flags) ? parsed.flags.map(String) : undefined,
    };
  } catch {
    return null;
  }
}
