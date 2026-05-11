import OpenAI from "openai";

// One OpenAI-compatible client pointed at OpenRouter. OpenRouter accepts the
// OpenAI Chat Completions schema and dispatches to whichever upstream model
// you ask for via slug (e.g. "anthropic/claude-sonnet-4.5", "google/gemini-…").
//
// HTTP-Referer + X-Title are OpenRouter's analytics/attribution headers;
// they make traffic show up under the right app in the OpenRouter dashboard.
let cached: OpenAI | null = null;

export function getLlmClient(): OpenAI {
  if (cached) return cached;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set on the server. Add it to .env.",
    );
  }
  cached = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.OPENROUTER_APP_URL ?? "http://localhost:3001",
      "X-Title": process.env.OPENROUTER_APP_TITLE ?? "Vittoria",
    },
  });
  return cached;
}

export function hasLlmCredentials(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}
