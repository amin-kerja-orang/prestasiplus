import { inspect } from 'node:util'

import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AI_PROVIDER_IDS, aiUnknownProviderMessage, type AiProviderId } from '@pp/contract'

import { AI_DEFAULTS } from './ai.constants'
import { parsePriceTable, priceFor, type ParsedPriceTable } from './pricing'

function intOr(value: unknown, fallback: number, min = 1): number {
  const n = Number(value)
  return value !== undefined && value !== null && String(value).trim() !== '' && Number.isInteger(n) && n >= min ? n : fallback
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/**
 * Settings of the AI service, read from the environment only (plan 15.3, `.env.api.example` PC-5 block).
 * The API key is reachable only through `apiKey()`, so a config object that is logged, serialised or inspected by
 * mistake never prints it (BE-NFR-32).
 */
@Injectable()
export class AiConfig {
  readonly provider: AiProviderId
  readonly model: string
  readonly baseUrl: string
  /** Lower-case host names (or `*.suffix` patterns) the openai-compatible base URL may use. */
  readonly baseUrlAllowlist: readonly string[]
  readonly timeoutMs: number
  readonly maxConcurrency: number
  readonly ratePerMin: number
  readonly ratePerUserPerMin: number
  readonly ratePerSchoolPerMin: number
  readonly maxRetries: number
  readonly retryBaseMs: number
  readonly retryMaxMs: number
  readonly maxOutputTokens: number
  /** `AI_MONTHLY_BUDGET_SEN`, or null when unset or malformed (a malformed value is ignored, as BE-40 does). */
  readonly envBudgetSen: number | null
  readonly prices: ParsedPriceTable
  readonly #apiKey: string

  constructor(@Inject(ConfigService) config: ConfigService) {
    const provider = text(config.get('AI_PROVIDER')) || 'mock'
    // An unknown id is a start-up error, never a silent fallback (prototype registry.ts).
    if (!(AI_PROVIDER_IDS as readonly string[]).includes(provider)) throw new Error(aiUnknownProviderMessage(provider))
    this.provider = provider as AiProviderId
    this.model = text(config.get('AI_MODEL'))
    this.baseUrl = text(config.get('AI_BASE_URL'))
    this.baseUrlAllowlist = text(config.get('AI_BASE_URL_ALLOWLIST'))
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean)
    this.timeoutMs = intOr(config.get('AI_TIMEOUT_MS'), AI_DEFAULTS.timeoutMs, 100)
    this.maxConcurrency = intOr(config.get('AI_MAX_CONCURRENCY'), AI_DEFAULTS.maxConcurrency)
    this.ratePerMin = intOr(config.get('AI_RATE_LIMIT_PER_MIN'), AI_DEFAULTS.ratePerMin)
    this.ratePerUserPerMin = intOr(config.get('AI_RATE_LIMIT_PER_USER_PER_MIN'), AI_DEFAULTS.ratePerUserPerMin)
    this.ratePerSchoolPerMin = intOr(config.get('AI_RATE_LIMIT_PER_SCHOOL_PER_MIN'), AI_DEFAULTS.ratePerSchoolPerMin)
    this.maxRetries = intOr(config.get('AI_MAX_RETRIES'), AI_DEFAULTS.maxRetries, 0)
    this.retryBaseMs = intOr(config.get('AI_RETRY_BASE_MS'), AI_DEFAULTS.retryBaseMs, 1)
    this.retryMaxMs = AI_DEFAULTS.retryMaxMs
    this.maxOutputTokens = AI_DEFAULTS.maxOutputTokens
    const budget = text(config.get('AI_MONTHLY_BUDGET_SEN'))
    this.envBudgetSen = /^\d{1,12}$/.test(budget) ? Number(budget) : null
    this.prices = parsePriceTable(text(config.get('AI_PRICE_TABLE_JSON')))
    this.#apiKey = text(config.get('AI_API_KEY'))
  }

  /** The key. Only the HTTP adapters call this, and only to build a request header. */
  apiKey(): string {
    return this.#apiKey
  }

  /**
   * A paid provider is usable only when the price table prices its model (exact id or `*`). Without a price every call
   * would be logged at cost 0 and the monthly cap could never be reached, so a missing entry or an unreadable table means
   * "not configured" (fail closed). The mock costs nothing and needs no entry.
   */
  hasPrice(provider: AiProviderId, model: string): boolean {
    return provider === 'mock' || priceFor(this.prices.table, provider, model) !== undefined
  }

  hasApiKey(): boolean {
    return this.#apiKey.length > 0
  }

  toJSON(): Record<string, unknown> {
    return { provider: this.provider, model: this.model, configured: this.hasApiKey() }
  }

  [inspect.custom](): string {
    return 'AiConfig { <redacted> }'
  }
}
