import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type OpenAI from "openai";
import { Role } from "@prisma/client";

import { auth } from "@/auth";
import { getLlmClient, hasLlmCredentials } from "@/lib/llm/client";
import { getAgent } from "@/lib/llm/agents";
import { getToolsForRole, runTool, type ToolContext } from "@/lib/bi/tools";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(40),
});

const SYSTEM_PROMPT = `You are Vittoria, an embedded AI assistant inside a multi-client ads dashboard for an Italian agency that runs Meta + Google Ads.

Your job: answer questions about clients, spot what's working / what isn't, and propose specific next steps. Be direct and number-driven — no fluff, no hedging.

GROUND RULES
- You have TOOLS to fetch live performance data. Use them. Don't guess numbers — query \`list_clients\` first to discover slugs, then \`get_client_summary\` or \`list_campaigns\` for specifics.
- For lead-gen campaigns, focus on leads, cost-per-lead, lead-form fill rate trends.
- For sales campaigns, focus on ROAS, AOV (revenue/purchases), purchase volume.
- Italian or English — match the user's language. Default to English.
- Always cite specific numbers. e.g. "Quality Form sas spent €1.234 with 12 leads at CPL €103."

DESTRUCTIVE ACTIONS
- The \`set_campaign_status\` tool pauses or activates real campaigns on Meta. ALWAYS describe what you're about to do and ASK for explicit confirmation in plain text BEFORE invoking the tool. The user must reply 'yes' / 'go' / 'pausa' / 'attiva' or similar.
- After any change, summarize what was done and the new state.

FORMATTING
- Respond in plain prose with light markdown. Use short paragraphs and bullet lists. No headers unless absolutely needed.
- Money in the client's currency (default EUR). Format with thousands separators and 2 decimals.`;

const MAX_TOOL_ITERATIONS = 6;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const role = (session.user as { role?: Role }).role ?? Role.CLIENT;
  if (role === Role.CLIENT) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!hasLlmCredentials()) {
    return NextResponse.json(
      {
        error:
          "OPENROUTER_API_KEY is not set on the server. Add it to .env and restart.",
      },
      { status: 503 },
    );
  }

  let parsed;
  try {
    const body = await req.json();
    parsed = bodySchema.parse(body);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bad request" },
      { status: 400 },
    );
  }

  const client = getLlmClient();
  const agent = getAgent("vittoria_chat");

  // Translate our internal tool definitions (Anthropic-style {name, description,
  // input_schema}) to OpenAI-style ({type:"function", function:{name, description,
  // parameters}}) — OpenRouter expects the OpenAI shape.
  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] =
    getToolsForRole(role).map(
      (t) =>
        ({
          type: "function",
          function: {
            name: t.name,
            description: t.description,
            parameters: t.input_schema as Record<string, unknown>,
          },
        }) as OpenAI.Chat.Completions.ChatCompletionTool,
    );

  const ctx: ToolContext = {
    userId: (session.user as { id?: string }).id ?? "",
    role,
  };

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...parsed.messages.map(
      (m) =>
        ({
          role: m.role,
          content: m.content,
        }) as OpenAI.Chat.Completions.ChatCompletionMessageParam,
    ),
  ];

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const send = (s: string) => controller.enqueue(encoder.encode(s));

      try {
        for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
          // Stream a chat completion. OpenAI/OpenRouter sends incremental
          // delta chunks: text in `delta.content`, tool calls in
          // `delta.tool_calls` (one per tool, indexed; arguments stream as
          // a JSON string in fragments that we concatenate).
          const stream = await client.chat.completions.create({
            model: agent.model,
            max_tokens: agent.maxOutputTokens,
            tools: tools.length > 0 ? tools : undefined,
            messages,
            stream: true,
          });

          let textBuffer = "";
          // Map<index, accumulated tool call> — index because OpenAI assigns
          // each parallel tool call an index, and the id arrives separately
          // from the function name + arguments fragments.
          const toolCallsAcc = new Map<
            number,
            { id: string; name: string; args: string }
          >();
          let finishReason: string | null = null;

          for await (const chunk of stream) {
            const choice = chunk.choices[0];
            if (!choice) continue;

            if (choice.delta.content) {
              textBuffer += choice.delta.content;
              send(choice.delta.content);
            }

            const deltaTools = choice.delta.tool_calls;
            if (deltaTools) {
              for (const tc of deltaTools) {
                const idx = tc.index;
                const acc = toolCallsAcc.get(idx) ?? {
                  id: "",
                  name: "",
                  args: "",
                };
                if (tc.id) acc.id = tc.id;
                if (tc.function?.name) acc.name = tc.function.name;
                if (tc.function?.arguments) acc.args += tc.function.arguments;
                toolCallsAcc.set(idx, acc);
              }
            }

            if (choice.finish_reason) finishReason = choice.finish_reason;
          }

          // Append the assistant turn to the conversation.
          const toolCalls = Array.from(toolCallsAcc.entries())
            .sort(([a], [b]) => a - b)
            .map(([, v]) => v);

          if (toolCalls.length > 0) {
            messages.push({
              role: "assistant",
              content: textBuffer || null,
              tool_calls: toolCalls.map((c) => ({
                id: c.id,
                type: "function" as const,
                function: { name: c.name, arguments: c.args },
              })),
            });
          } else {
            messages.push({
              role: "assistant",
              content: textBuffer,
            });
          }

          if (finishReason !== "tool_calls" || toolCalls.length === 0) {
            break;
          }

          send("\n\n");

          // Run tools, append role:"tool" results, loop.
          for (const call of toolCalls) {
            let parsedInput: unknown;
            try {
              parsedInput = call.args ? JSON.parse(call.args) : {};
            } catch {
              parsedInput = {};
            }
            try {
              const result = await runTool(call.name, parsedInput, ctx);
              messages.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify(result),
              });
            } catch (err) {
              messages.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify({
                  error: err instanceof Error ? err.message : "Tool failed",
                }),
              });
            }
          }
        }
        controller.close();
      } catch (err) {
        send(
          `\n\n[error] ${err instanceof Error ? err.message : "stream failed"}`,
        );
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
