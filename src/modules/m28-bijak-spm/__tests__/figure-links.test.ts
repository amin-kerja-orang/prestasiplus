import { describe, expect, it } from 'vitest'

import { figureKeys, referencingQuestionIds, stimulusKey } from '../admin/intake/domain/figure-links'
import type { IntakeQuestion } from '../admin/intake/types'
import { BijakServer, MemoryStorage } from '../server/store'

function q(label: string, stem: string, stimulusId?: string): IntakeQuestion {
  return {
    id: `q${label}`, label, type: 'short', stem, options: [], marks: 1, mode: 'short_text', parts: [],
    tag: { subject: 'MAT', level: 'T4', unit: 'MAT-T4-02', unitLabel: 'x', sp: ['1'], tp: 2, formOrigin: 'T4' },
    page: 1, lowFields: [], confirmed: [], ...(stimulusId ? { stimulusId } : {}),
  }
}

describe('one figure, every question that names it (D90)', () => {
  it('reads figure names the way the API does', () => {
    expect(figureKeys('Berdasarkan Rajah 1 dan figure 2')).toEqual(['rajah1', 'rajah2'])
    expect(stimulusKey('Petikan A')).toBeNull()
    expect(stimulusKey('Jadual 3')).toBe('jadual3')
  })

  it('finds the unlinked questions that name the stimulus', () => {
    const qs = [q('1', 'Rajah 1 menunjukkan', 's'), q('2', 'Lihat Rajah 1'), q('3', 'Tiada'), q('4', 'Rajah 2 sahaja')]
    expect(referencingQuestionIds(qs, { label: 'Rajah 1' })).toEqual(['q2'])
  })

  it('the mock server links them and gathers the group', async () => {
    const s = new BijakServer({ storage: new MemoryStorage() })
    const b = await s.getIntakeBatch('ek-demo-1')
    const stimulus = { ...b.stimuli[0]!, id: 'st-new', label: 'Rajah 9' }
    b.stimuli = [stimulus]
    b.questions = [q('1', 'Rajah 9 satu'), q('2', 'tiada rujukan'), q('3', 'Rajah 9 dua')]
    await s.saveExtracted(b.id, { questions: b.questions, stimuli: b.stimuli })
    const res = await s.linkStimulusReferences(b.id, 'st-new')
    expect(res.linkedItemIds).toEqual(['q1', 'q3'])
    const after = await s.getIntakeBatch(b.id)
    expect(after.questions.map((x) => [x.label, x.stimulusId ?? null])).toEqual([['1', 'st-new'], ['3', 'st-new'], ['2', null]])
    expect((await s.linkStimulusReferences(b.id, 'st-new')).linkedItemIds).toEqual([])
    await expect(s.linkStimulusReferences(b.id, 'nope')).rejects.toMatchObject({ code: 'not_found' })
  })
})
