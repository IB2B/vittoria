// Named "agents" — really just (model, defaults) presets so swapping the
// model behind a task is a one-line change. Each agent corresponds to one
// task pattern in the app.
//
// To swap a model: edit the `model` field below; no other code changes
// required. To compare models, route a percentage of traffic by adding a
// router function later.

export type AgentName =
  | "vittoria_chat"
  | "report_narrator"
  | "quick_classifier"
  | "creative_writer";

export type AgentSpec = {
  name: AgentName;
  model: string;
  description: string;
  /** Soft cap on output tokens. Models cap higher; this is just our budget. */
  maxOutputTokens: number;
};

export const AGENTS: Record<AgentName, AgentSpec> = {
  vittoria_chat: {
    name: "vittoria_chat",
    // Best-in-class agentic + Italian fluency in OpenRouter's catalog.
    model: "anthropic/claude-sonnet-4.5",
    description: "Conversational BI chat with tool use",
    maxOutputTokens: 1500,
  },
  report_narrator: {
    name: "report_narrator",
    model: "anthropic/claude-sonnet-4.5",
    description: "One-shot structured JSON for the .docx report",
    maxOutputTokens: 2000,
  },
  quick_classifier: {
    name: "quick_classifier",
    // Cheap + fast for high-volume tagging tasks (anomaly labels, etc.).
    model: "anthropic/claude-haiku-4.5",
    description: "Fast labeling / anomaly tagging",
    maxOutputTokens: 600,
  },
  creative_writer: {
    name: "creative_writer",
    // Premium model for long-form ad copy / scripts when quality matters.
    model: "anthropic/claude-opus-4.7",
    description: "Long-form creative writing",
    maxOutputTokens: 3000,
  },
};

export function getAgent(name: AgentName): AgentSpec {
  return AGENTS[name];
}
