import type { AiProviderId } from '@pp/contract'
import { z } from 'zod'

import { AiConfig } from '../ai.config'
import { HttpExtractionProvider, estimateTokens, type CompleteRequest, type CompleteResult } from './http-provider'
import { ProviderAttemptError } from './provider-errors'
import { ProviderHttp } from './provider-http'
import { checkUrlShape, UnsafeUrlError } from '../net/safe-url'

/** Fixed vendor hosts. The three first-party adapters never take a base URL from configuration. */
export const VENDOR_HOSTS = {
  anthropic: 'api.anthropic.com',
  openai: 'api.openai.com',
  gemini: 'generativelanguage.googleapis.com',
} as const

const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/

const count = z.number().int().min(0).optional()
const AnthropicReply = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })).default([]),
  usage: z.object({ input_tokens: count, output_tokens: count }).optional(),
})
const ChatReply = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable().optional() }).optional() })).default([]),
  usage: z.object({ prompt_tokens: count, completion_tokens: count }).optional(),
})
const GeminiReply = z.object({
  candidates: z.array(z.object({ content: z.object({ parts: z.array(z.object({ text: z.string().optional() })).default([]) }).optional() })).default([]),
  usageMetadata: z.object({ promptTokenCount: count, candidatesTokenCount: count }).optional(),
})

/**
 * A 2xx reply was billed whatever its content. When it cannot be used the failure still carries the tokens (the vendor's
 * `usage`, else an estimate of the request) so the pipeline logs one usage row for it.
 */
function decode<T extends z.ZodType>(
  schema: T,
  json: unknown,
  req: CompleteRequest,
  pick: (reply: z.output<T>) => { text: string; tin: number | undefined; tout: number | undefined },
): CompleteResult {
  const estimatedIn = estimateTokens(req.system) + estimateTokens(req.user)
  const r = schema.safeParse(json)
  if (!r.success) throw new ProviderAttemptError('fatal', undefined, undefined, { tokensIn: estimatedIn, tokensOut: 0 })
  const { text, tin, tout } = pick(r.data)
  const tokensIn = tin ?? estimatedIn
  const tokensOut = tout ?? estimateTokens(text)
  if (text.trim() === '') throw new ProviderAttemptError('fatal', undefined, undefined, { tokensIn, tokensOut })
  return { text, tokensIn, tokensOut }
}

/** Anthropic Messages API. */
export class AnthropicProvider extends HttpExtractionProvider {
  readonly id: AiProviderId = 'anthropic'
  readonly model: string

  constructor(private readonly config: AiConfig, private readonly http: ProviderHttp) {
    super(config.maxOutputTokens)
    this.model = config.model
  }

  isConfigured(): boolean {
    return this.config.hasApiKey() && MODEL_ID.test(this.model) && this.config.hasPrice(this.id, this.model)
  }

  protected async complete(req: CompleteRequest): Promise<CompleteResult> {
    const { json } = await this.http.postJson({
      url: `https://${VENDOR_HOSTS.anthropic}/v1/messages`,
      allowlist: [VENDOR_HOSTS.anthropic],
      headers: { 'x-api-key': this.config.apiKey(), 'anthropic-version': '2023-06-01' },
      body: { model: this.model, max_tokens: req.maxTokens, system: req.system, messages: [{ role: 'user', content: req.user }] },
      signal: req.signal,
    })
    return decode(AnthropicReply, json, req, (r) => ({
      text: r.content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join(''),
      tin: r.usage?.input_tokens,
      tout: r.usage?.output_tokens,
    }))
  }
}

/** Shared by OpenAI and OpenAI-compatible gateways (chat completions). */
abstract class ChatCompletionsProvider extends HttpExtractionProvider {
  protected abstract endpoint(): string
  protected abstract allowlist(): readonly string[]
  protected abstract tokenLimitField: 'max_completion_tokens' | 'max_tokens'

  constructor(protected readonly config: AiConfig, protected readonly http: ProviderHttp) {
    super(config.maxOutputTokens)
  }

  protected async complete(req: CompleteRequest): Promise<CompleteResult> {
    const { json } = await this.http.postJson({
      url: this.endpoint(),
      allowlist: this.allowlist(),
      headers: { authorization: `Bearer ${this.config.apiKey()}` },
      body: {
        model: this.model,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
        [this.tokenLimitField]: req.maxTokens,
        ...(req.json ? { response_format: { type: 'json_object' } } : {}),
      },
      signal: req.signal,
    })
    return decode(ChatReply, json, req, (r) => ({ text: r.choices[0]?.message?.content ?? '', tin: r.usage?.prompt_tokens, tout: r.usage?.completion_tokens }))
  }
}

/** OpenAI chat completions on the fixed vendor host. */
export class OpenAiProvider extends ChatCompletionsProvider {
  readonly id: AiProviderId = 'openai'
  readonly model: string
  protected readonly tokenLimitField = 'max_completion_tokens' as const

  constructor(config: AiConfig, http: ProviderHttp) {
    super(config, http)
    this.model = config.model
  }

  isConfigured(): boolean {
    return this.config.hasApiKey() && MODEL_ID.test(this.model) && this.config.hasPrice(this.id, this.model)
  }

  protected endpoint(): string {
    return `https://${VENDOR_HOSTS.openai}/v1/chat/completions`
  }

  protected allowlist(): readonly string[] {
    return [VENDOR_HOSTS.openai]
  }
}

/**
 * Any OpenAI-compatible gateway or self-hosted server. The base URL comes from `AI_BASE_URL` and is the one URL in the
 * service that configuration controls, so it is checked twice (AC8): statically when the adapter is built
 * (https, allow-listed host, no private literal) and again before every call, after DNS resolution (every resolved
 * address must be public, and the connection is pinned to those addresses).
 */
export class OpenAiCompatibleProvider extends ChatCompletionsProvider {
  readonly id: AiProviderId = 'openai-compatible'
  readonly model: string
  protected readonly tokenLimitField = 'max_tokens' as const
  private readonly base: string | null

  constructor(config: AiConfig, http: ProviderHttp) {
    super(config, http)
    this.model = config.model
    this.base = OpenAiCompatibleProvider.safeBase(config)
  }

  private static safeBase(config: AiConfig): string | null {
    try {
      const url = checkUrlShape(config.baseUrl, config.baseUrlAllowlist)
      return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
    } catch (err) {
      if (err instanceof UnsafeUrlError) return null
      throw err
    }
  }

  isConfigured(): boolean {
    return this.base !== null && this.config.hasApiKey() && MODEL_ID.test(this.model) && this.config.hasPrice(this.id, this.model)
  }

  protected endpoint(): string {
    return `${this.base ?? ''}/chat/completions`
  }

  protected allowlist(): readonly string[] {
    return this.config.baseUrlAllowlist
  }
}

/** Google Gemini generateContent. The key travels in a header, never in the URL. */
export class GeminiProvider extends HttpExtractionProvider {
  readonly id: AiProviderId = 'gemini'
  readonly model: string

  constructor(private readonly config: AiConfig, private readonly http: ProviderHttp) {
    super(config.maxOutputTokens)
    this.model = config.model
  }

  isConfigured(): boolean {
    return this.config.hasApiKey() && MODEL_ID.test(this.model) && this.config.hasPrice(this.id, this.model)
  }

  protected async complete(req: CompleteRequest): Promise<CompleteResult> {
    const { json } = await this.http.postJson({
      url: `https://${VENDOR_HOSTS.gemini}/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
      allowlist: [VENDOR_HOSTS.gemini],
      headers: { 'x-goog-api-key': this.config.apiKey() },
      body: {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: 'user', parts: [{ text: req.user }] }],
        generationConfig: { maxOutputTokens: req.maxTokens, ...(req.json ? { responseMimeType: 'application/json' } : {}) },
      },
      signal: req.signal,
    })
    return decode(GeminiReply, json, req, (r) => ({
      text: (r.candidates[0]?.content?.parts ?? []).map((p) => p.text ?? '').join(''),
      tin: r.usageMetadata?.promptTokenCount,
      tout: r.usageMetadata?.candidatesTokenCount,
    }))
  }
}
