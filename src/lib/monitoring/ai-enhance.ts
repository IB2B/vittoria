import { prisma } from "@/lib/db";
import { getLlmClient, hasLlmCredentials } from "@/lib/llm/client";
import { getAgent } from "@/lib/llm/agents";

// Calls Haiku (via OpenRouter `quick_classifier` agent) to refine the template
// suggestion on a per-alert basis. Cheap, fast, and adds the specific-to-
// this-client flavor the templated text can't have. Falls back silently if
// no API key is configured.
//
// We process alerts in small batches so a single bad payload doesn't block
// the rest; each alert update is awaited so the DB state is consistent.
export async function enhanceAlertsForClient(clientId: string): Promise<{
  enhanced: number;
  skipped: number;
}> {
  let enhanced = 0;
  let skipped = 0;
  if (!hasLlmCredentials()) return { enhanced, skipped };

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { name: true },
  });
  if (!client) return { enhanced, skipped };

  // Only enhance OPEN alerts created within the last 24h that haven't been
  // refined yet (we mark refined by prefixing the suggestion with "✦").
  const alerts = await prisma.monitoringAlert.findMany({
    where: {
      clientId,
      status: "OPEN",
      detectedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      NOT: { suggestion: { startsWith: "✦" } },
    },
    take: 10,
  });
  if (alerts.length === 0) return { enhanced, skipped };

  const llm = getLlmClient();
  const agent = getAgent("quick_classifier");

  for (const alert of alerts) {
    try {
      const prompt = `You are advising an Italian ads agency. A nightly monitor flagged this issue for client "${client.name}":

ISSUE: ${alert.title}
DETAIL: ${alert.description}
NUMBERS: ${JSON.stringify(alert.metrics)}
DEFAULT SUGGESTION: ${alert.suggestion}

Rewrite the suggestion in 2-3 short sentences, in English, weaving in the actual numbers from NUMBERS where it makes sense. Be specific and actionable. No filler ("It seems that…", "It might be worth…"). Open with the most likely cause, then 1-2 concrete actions. Return ONLY the rewritten suggestion text — no preamble, no markdown, no quotes.`;

      const response = await llm.chat.completions.create({
        model: agent.model,
        max_tokens: agent.maxOutputTokens,
        messages: [{ role: "user", content: prompt }],
      });
      const text = response.choices[0]?.message?.content?.trim();
      if (!text) {
        skipped += 1;
        continue;
      }
      await prisma.monitoringAlert.update({
        where: { id: alert.id },
        data: { suggestion: `✦ ${text}` },
      });
      enhanced += 1;
    } catch (err) {
      console.warn(
        `[monitoring] enhancement failed for alert ${alert.id}:`,
        err instanceof Error ? err.message : err,
      );
      skipped += 1;
    }
  }

  return { enhanced, skipped };
}

// Convenience: enhance every client's open alerts. Called by the cron route
// after detection finishes.
export async function enhanceAllOpenAlerts(): Promise<{
  enhanced: number;
  skipped: number;
}> {
  if (!hasLlmCredentials()) return { enhanced: 0, skipped: 0 };
  const clients = await prisma.client.findMany({
    where: { archived: false },
    select: { id: true },
  });
  let enhanced = 0;
  let skipped = 0;
  for (const c of clients) {
    const r = await enhanceAlertsForClient(c.id);
    enhanced += r.enhanced;
    skipped += r.skipped;
  }
  return { enhanced, skipped };
}
