import { AI_PROVIDER_IDS, type AiProviderId } from '@pp/contract'
import { z } from 'zod'

/**
 * Price table from `AI_PRICE_TABLE_JSON` (non-secret configuration supplied by the lead; no price is invented in the
 * repository). Shape: provider id (wire form) -> model id (or `*` for any model of the provider) -> rates in sen.
 *
 *   { "anthropic": { "model-x": { "inSenPerMTok": 300, "outSenPerMTok": 1500 } },
 *     "openai-compatible": { "*": { "inSenPerMTok": 10, "outSenPerMTok": 20, "perPageSen": 0 } } }
 *
 * Cost of a call = ceil(tokensIn * inSenPerMTok / 1e6 + tokensOut * outSenPerMTok / 1e6 + pages * perPageSen), an integer
 * number of sen. Rounding up errs on the side of the budget. The mock provider always costs 0.
 */
const rate = z.number().finite().min(0).max(1e9)
const PriceEntrySchema = z
  .object({ inSenPerMTok: rate, outSenPerMTok: rate, perPageSen: rate.optional() })
  .strict()
const PriceTableSchema = z.partialRecord(z.enum(AI_PROVIDER_IDS), z.record(z.string().min(1).max(128), PriceEntrySchema))

export type PriceEntry = z.infer<typeof PriceEntrySchema>
export type PriceTable = z.infer<typeof PriceTableSchema>

export interface ParsedPriceTable {
  table: PriceTable
  /** Why the table is empty or partial (a configuration problem, never a secret). */
  problem: string | null
}

export function parsePriceTable(raw: string | undefined | null): ParsedPriceTable {
  if (raw === undefined || raw === null || raw.trim() === '') return { table: {}, problem: null }
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { table: {}, problem: 'AI_PRICE_TABLE_JSON is not valid JSON; every cost is 0' }
  }
  const parsed = PriceTableSchema.safeParse(json)
  if (!parsed.success) return { table: {}, problem: 'AI_PRICE_TABLE_JSON does not match the expected shape; every cost is 0' }
  return { table: parsed.data, problem: null }
}

/** The rates for a provider and model: the exact model first, then `*`. Undefined when none is configured. */
export function priceFor(table: PriceTable, provider: AiProviderId, model: string): PriceEntry | undefined {
  // Own keys only: AI_MODEL=constructor or __proto__ must not resolve to a prototype member.
  const byModel = Object.hasOwn(table, provider) ? table[provider] : undefined
  if (!byModel) return undefined
  if (Object.hasOwn(byModel, model)) return byModel[model]
  return Object.hasOwn(byModel, '*') ? byModel['*'] : undefined
}

export function costSenOf(entry: PriceEntry, usage: { tokensIn: number; tokensOut: number; pages: number }): number {
  const exact = (usage.tokensIn * entry.inSenPerMTok + usage.tokensOut * entry.outSenPerMTok) / 1_000_000 + usage.pages * (entry.perPageSen ?? 0)
  // Strip floating-point dust before rounding up (0.1 + 0.2 style errors must not add a sen).
  return Math.max(0, Math.ceil(Number(exact.toFixed(6))))
}
