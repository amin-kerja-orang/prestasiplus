/**
 * Provider registry for question extraction (ADR 0019). The provider is chosen by configuration,
 * never by code: `VITE_AI_PROVIDER` (+ `VITE_AI_MODEL`, `VITE_AI_BASE_URL`). No API key ever lives in
 * the frontend; real providers run server-side and the browser only sends page text and images to
 * the Kuasa Pusat API. In the prototype only `mock` runs.
 */
import type { QuestionExtractor } from '../types'
import { mockExtractor } from './mock-extractor'
import { serverProvider } from './providers'

export const PROVIDER_IDS = ['mock', 'anthropic', 'openai', 'gemini', 'openai-compatible'] as const
export type ProviderId = (typeof PROVIDER_IDS)[number]

export interface AiConfig {
  provider: string
  model: string
  baseUrl: string
}

export function aiConfigFromEnv(env: Record<string, unknown> = import.meta.env): AiConfig {
  const str = (v: unknown): string => (typeof v === 'string' ? v : '')
  return {
    provider: str(env.VITE_AI_PROVIDER) || 'mock',
    model: str(env.VITE_AI_MODEL),
    baseUrl: str(env.VITE_AI_BASE_URL),
  }
}

type Factory = (config: AiConfig) => QuestionExtractor

const factories: Record<ProviderId, Factory> = {
  mock: () => mockExtractor,
  anthropic: (c) => serverProvider('anthropic', 'Anthropic Claude', c),
  openai: (c) => serverProvider('openai', 'OpenAI', c),
  gemini: (c) => serverProvider('gemini', 'Google Gemini', c),
  'openai-compatible': (c) => serverProvider('openai-compatible', 'Serasi OpenAI', c),
}

export function isProviderId(id: string): id is ProviderId {
  return (PROVIDER_IDS as readonly string[]).includes(id)
}

/** Build the extractor for a provider id. An unknown id is a configuration error, not a fallback. */
export function createExtractor(config: AiConfig = aiConfigFromEnv()): QuestionExtractor {
  if (!isProviderId(config.provider))
    throw new Error(`Penyedia AI tidak dikenali: ${config.provider}`)
  return factories[config.provider](config)
}
