/**
 * Typed stubs for the real AI providers. They carry the configuration (model, base URL) and throw
 * until the server-side integration exists: keys and calls stay on the server (ADR 0019).
 */
import type { ExtractedPaper, QuestionExtractor } from '../types'
import type { AiConfig } from './registry'

export const NOT_CONFIGURED_MESSAGE = 'Dikonfigurasi di pelayan'

export function serverProvider(id: string, label: string, config: AiConfig): QuestionExtractor {
  return {
    id,
    label,
    extract(): Promise<ExtractedPaper> {
      void config
      return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE))
    },
  }
}
