import { AiExtractRequestSchema, AiIntakeStimulusSchema, AiQuestionDraftSchema } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { parsePaper } from '../../src/modules/ai-extraction/providers/mock/mock-parser'
import { fixture } from './helpers'

/**
 * AC1 golden test: the server `mock` provider returns the same ExtractedPaper as the frontend prototype's mock extractor
 * (admin/intake/ai/mock-extractor.ts at 9af43134) for the same input. The fixture holds the prototype's own output for
 * four fictitious papers (its sample paper, a scheme entry without a question, an empty paper, and a Sains paper with a
 * passage, nested parts, ECF and an any-N group). Ids are time based in the prototype and `stim-<n>` / `q-<label>-<n>`
 * here, so both sides are compared after ids are replaced by their position. The server-only draft fields
 * (status, fieldConfidence, warnings) do not exist in the prototype and are removed before the comparison.
 */
interface Golden {
  [name: string]: { input: unknown; output: Record<string, unknown> }
}
const golden = fixture<Golden>('golden-frontend-mock.json')

type Json = Record<string, unknown>
function normalise(paper: unknown): Json {
  const p = JSON.parse(JSON.stringify(paper)) as { questions: Json[]; stimuli: Json[] } & Json
  const stimIds = new Map<string, string>()
  p.stimuli.forEach((s, i) => {
    stimIds.set(s.id as string, `S${String(i + 1)}`)
    s.id = `S${String(i + 1)}`
  })
  p.questions.forEach((q, i) => {
    q.id = `Q${String(i + 1)}`
    if (typeof q.stimulusId === 'string') q.stimulusId = stimIds.get(q.stimulusId)
    delete q.status
    delete q.fieldConfidence
    delete q.warnings
    delete q.region
    // The prototype's scheme point ids and part ids are positional already.
  })
  return p
}

describe('mock provider equals the frontend mock extractor (golden)', () => {
  for (const [name, c] of Object.entries(golden)) {
    it(`case "${name}": same questions, parts, schemes, tags, stimuli, unmatched and warnings`, () => {
      const request = AiExtractRequestSchema.parse(c.input)
      const ours = parsePaper(request)
      expect(normalise(ours)).toEqual(normalise(c.output))
    })
  }

  it('every question and stimulus validates against the contract schemas and is a draft', () => {
    for (const c of Object.values(golden)) {
      const out = parsePaper(AiExtractRequestSchema.parse(c.input))
      for (const q of out.questions) {
        expect(AiQuestionDraftSchema.safeParse(q).success).toBe(true)
        expect(q.status).toBe('draft')
        expect(q.confirmed).toEqual([])
      }
      for (const s of out.stimuli) expect(AiIntakeStimulusSchema.safeParse(s).success).toBe(true)
    }
  })

  it('is deterministic: the same input gives byte-identical output, ids included', () => {
    const request = AiExtractRequestSchema.parse(golden.sample?.input)
    expect(JSON.stringify(parsePaper(request))).toBe(JSON.stringify(parsePaper(request)))
    expect(parsePaper(request).stimuli[0]?.id).toBe('stim-1')
    expect(parsePaper(request).questions[0]?.id).toBe('q-1-1')
  })

  it('picks a unit only from the request taxonomy when one is given (AC-05.2)', () => {
    const request = AiExtractRequestSchema.parse(golden.sample?.input)
    const only = parsePaper({ ...request, taxonomy: [{ code: 'MAT-T4-09', label: 'Statistik', form: 'T4' }] })
    const units = only.questions.map((q) => q.tag.unit)
    expect(units.every((u) => u === null || u === 'MAT-T4-09')).toBe(true)
    expect(only.questions.find((q) => q.label === '2')?.tag.unit).toBe('MAT-T4-09')
    const none = parsePaper({ ...request, taxonomy: [{ code: 'ZZZ-T4-01', label: 'Tidak berkaitan', form: 'T4' }] })
    expect(none.questions.every((q) => q.tag.unit === null && q.lowFields.includes('tag.unit'))).toBe(true)
  })
})
