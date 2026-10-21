import type {
  AiCapabilities,
  AiExtractedPaper,
  AiExtractRequest,
  AiGenerateTextRequest,
  AiGenerateTextResult,
  AiHealth,
  AiProviderId,
  AiSuggestTagsRequest,
  AiTagSuggestionSchema,
} from '@pp/contract'
import type { z } from 'zod'

/** One tag suggestion (the contract exports the schema, not the type). */
export type AiTagSuggestion = z.infer<typeof AiTagSuggestionSchema>

/** What a provider adds to a result: the tokens it reports (the service prices them and writes the usage row). */
export interface Tokens {
  tokensIn: number
  tokensOut: number
}

export type ProviderHealth = Pick<AiHealth, 'ok' | 'latencyMs'> & Tokens

/** The part of `AiExtractedPaper` a provider produces; the service adds `usage` and `redaction`. */
export type ExtractedDraftPaper = Omit<AiExtractedPaper, 'usage' | 'redaction'>

export interface ProviderCallOptions {
  /** Aborted when the caller cancels or the per-call timeout expires. */
  signal: AbortSignal
}

/**
 * The adapter interface of plan 15.2 (BE-36 card Outputs). Every method receives input that has ALREADY been through the
 * redaction step: the service is the only caller and it redacts first, so an adapter never sees raw page text.
 * Adapters do not retry, rate limit, price or log usage; the service does (one place, the same rules for every adapter).
 */
export interface ExtractionProvider {
  readonly id: AiProviderId
  /** Model id the adapter reports (the mock has its own); empty when none is configured. */
  readonly model: string
  readonly capabilities: AiCapabilities
  /** True when the adapter has what it needs to make a call (the mock always has). */
  isConfigured(): boolean
  extractPaper(input: AiExtractRequest, options: ProviderCallOptions): Promise<{ paper: ExtractedDraftPaper } & Tokens>
  suggestTags(input: AiSuggestTagsRequest, options: ProviderCallOptions): Promise<{ suggestions: AiTagSuggestion[] } & Tokens>
  generateText(input: AiGenerateTextRequest, options: ProviderCallOptions): Promise<AiGenerateTextResult>
  /** A tiny call on a built-in sample. The service stamps `checkedAt` from the injected clock. */
  healthCheck(options: ProviderCallOptions): Promise<ProviderHealth>
}

/** A fetch-shaped transport (the subset this service uses). `pinnedAddresses` is ignored by a plain `fetch`. */
export interface AiFetchInit {
  method: 'POST'
  headers: Record<string, string>
  body: string
  signal: AbortSignal
  /** Always `manual`: a redirect is an error here, never followed (it could bypass the SSRF check). */
  redirect: 'manual'
  /** Addresses the host resolved to and that passed the SSRF check; the default transport connects only to these. */
  pinnedAddresses?: readonly string[]
}
export type AiFetch = (url: string, init: AiFetchInit) => Promise<Response>

/** Resolves a host name to every address (A and AAAA). Injectable so tests never touch DNS. */
export type AiResolver = (hostname: string) => Promise<string[]>

export type AiSleep = (ms: number, signal?: AbortSignal) => Promise<void>

/** Who is calling, for the cost log and the rate limits only. NEVER forwarded to a provider (AC-04.8). */
export interface AiCallerContext {
  /** Admin or Guru who triggered the call; absent for a system call (a job without a person). */
  actorId?: string | null
  batchId?: string | null
  /** An `ai_extraction_runs` id created by the caller (BE-38) through `AiRunsService.create`. */
  runId?: string | null
}
