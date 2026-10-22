import type { AiExtractedPaper, AiQuestionDraft } from '@pp/contract'
import { describe, expect, expectTypeOf, it } from 'vitest'

import { AiExtractionService, assertDraftsOnly } from '../../src/modules/ai-extraction'
import { AiError } from '../../src/modules/ai-extraction/ai.errors'
import type { ExtractionProvider } from '../../src/modules/ai-extraction/ai.types'
import { parsePaper } from '../../src/modules/ai-extraction/providers/mock/mock-parser'
import { fixture } from './helpers'

/**
 * AC7: the service can only return drafts. Type level: the status of a question is the literal 'draft' and the provider
 * interface and the service have no approving operation. Runtime: a result with any other status or a confirmed field is
 * refused, and the service exposes no approve / accept / confirm / publish method.
 */
describe('draft-only output (AC7)', () => {
  it('type level: the only status is "draft"; nothing can be confirmed', () => {
    expectTypeOf<AiQuestionDraft['status']>().toEqualTypeOf<'draft'>()
    expectTypeOf<AiExtractedPaper['questions'][number]['status']>().toEqualTypeOf<'draft'>()
    expectTypeOf<AiQuestionDraft['confirmed']>().toEqualTypeOf<string[]>()
    // @ts-expect-error 'approved' is not a status of a draft
    const bad: AiQuestionDraft['status'] = 'approved'
    expect(bad).toBe('approved') // the assignment above is a compile-time failure; this keeps the value used
  })

  it('type level: no approving operation on the provider interface or the service', () => {
    type ProviderKeys = keyof ExtractionProvider
    expectTypeOf<ProviderKeys>().toEqualTypeOf<'id' | 'model' | 'capabilities' | 'isConfigured' | 'extractPaper' | 'suggestTags' | 'generateText' | 'healthCheck'>()
    type ServiceKeys = keyof AiExtractionService
    expectTypeOf<Extract<ServiceKeys, `${string}pprove${string}` | `${string}ccept${string}` | `${string}onfirm${string}` | `${string}ublish${string}`>>().toEqualTypeOf<never>()
  })

  it('runtime: the service has no approve / accept / confirm / publish method', () => {
    const names = Object.getOwnPropertyNames(AiExtractionService.prototype)
    expect(names.sort()).toEqual(['constructor', 'extractPaper', 'generateText', 'healthCheck', 'providerId', 'suggestTags'].sort())
    expect(names.filter((n) => /approv|accept|confirm|publish|status/i.test(n))).toEqual([])
  })

  it('runtime: assertDraftsOnly refuses a non-draft or a confirmed field and accepts what the mock returns', () => {
    const golden = fixture<Record<string, { input: never }>>('golden-frontend-mock.json')
    const paper = parsePaper(golden.sample?.input as never)
    expect(() => assertDraftsOnly(paper)).not.toThrow()
    const approved = { questions: [{ ...paper.questions[0], status: 'approved' }] } as unknown as AiExtractedPaper
    expect(() => assertDraftsOnly(approved)).toThrow(AiError)
    const confirmed = { questions: [{ ...paper.questions[0], confirmed: ['stem'] }] } as unknown as AiExtractedPaper
    expect(() => assertDraftsOnly(confirmed)).toThrow(AiError)
  })
})
