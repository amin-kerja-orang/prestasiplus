import { aiUnknownProviderMessage, type AiProviderId } from '@pp/contract'

import { AiConfig } from '../ai.config'
import type { AiFetch, AiResolver, ExtractionProvider } from '../ai.types'
import { MockProvider } from './mock/mock.provider'
import { ProviderHttp } from './provider-http'
import { AnthropicProvider, GeminiProvider, OpenAiCompatibleProvider, OpenAiProvider } from './vendors'

/**
 * Provider registry (plan 15.2): one adapter, chosen by `AI_PROVIDER` (default `mock`). Swapping the provider changes no
 * caller code. An unknown id is a start-up error, never a silent fallback to the mock.
 */
export function createProvider(config: AiConfig, fetchImpl: AiFetch, resolver: AiResolver): ExtractionProvider {
  const id: AiProviderId = config.provider
  const http = new ProviderHttp(fetchImpl, resolver, id)
  switch (id) {
    case 'mock':
      return new MockProvider()
    case 'anthropic':
      return new AnthropicProvider(config, http)
    case 'openai':
      return new OpenAiProvider(config, http)
    case 'gemini':
      return new GeminiProvider(config, http)
    case 'openai-compatible':
      return new OpenAiCompatibleProvider(config, http)
    default:
      throw new Error(aiUnknownProviderMessage(String(id)))
  }
}
