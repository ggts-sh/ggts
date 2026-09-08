/**
 * OpenRouterResponder: plain fetch against the OpenRouter chat-completions
 * API (https://openrouter.ai/api/v1 — OpenAI-compatible; NO sdk dependency,
 * the harness adds zero deps). The eval workflow deliberately does NOT use
 * the Anthropic API (user mandate; see docs/decisions/0012-m3-notes.md,
 * Amendment). Model comes from EVAL_MODEL (default "openai/gpt-5.5" — a
 * strong non-Anthropic frontier model on OpenRouter), max_tokens 4000,
 * temperature 0, 60s timeout per call. Attribution headers HTTP-Referer /
 * X-Title are sent per OpenRouter's recommendation.
 *
 * STRUCTURED-OUTPUT MODE: schema-in-prompt + validate-and-repair, NOT
 * json_schema response_format. Rationale: (1) a reply is a UNION of
 * PortableSpec | the refusal shape, so a strict schema would need a
 * top-level union of the full v0 spec schema, whose keywords are exactly
 * what provider structured-output implementations choke on (see
 * docs/decisions/0004-schema-source.md); (2) OpenRouter routes across
 * providers with uneven response_format support, while plain text works
 * everywhere; (3) decode-time schema enforcement would hollow out the
 * metric this harness exists to measure (validity pre/post ONE repair
 * round). The grammar cheat-sheet in the system prompt is the schema.
 */
import type { Responder } from "./types.ts";

export const DEFAULT_MODEL = "openai/gpt-5.5";
export const CALL_TIMEOUT_MS = 60_000;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const REPO_URL = "https://github.com/ggts-sh/ggts";

interface ChatCompletionsResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
}

export class OpenRouterResponder implements Responder {
  readonly name: string;
  readonly #apiKey: string;
  readonly #timeoutMs: number;

  constructor(apiKey: string, model?: string, timeoutMs: number = CALL_TIMEOUT_MS) {
    this.#apiKey = apiKey;
    this.name = model ?? process.env["EVAL_MODEL"] ?? DEFAULT_MODEL;
    this.#timeoutMs = timeoutMs;
  }

  async complete(system: string, user: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.#timeoutMs);
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.#apiKey}`,
          "content-type": "application/json",
          // OpenRouter attribution headers (optional but recommended).
          "http-referer": REPO_URL,
          "x-title": "ggts evals",
        },
        body: JSON.stringify({
          model: this.name,
          max_tokens: 4000,
          temperature: 0,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 500);
        throw new Error(`OpenRouter API error ${response.status}: ${detail}`);
      }
      const body = (await response.json()) as ChatCompletionsResponse;
      const text = body.choices?.[0]?.message?.content ?? "";
      if (text === "") throw new Error("OpenRouter API returned no text content");
      return text;
    } finally {
      clearTimeout(timer);
    }
  }
}
