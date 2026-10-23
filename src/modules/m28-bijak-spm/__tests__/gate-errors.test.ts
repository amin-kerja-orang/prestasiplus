import { describe, expect, it } from 'vitest'

import { validateBatch } from '../admin/intake/domain/validation'
import { emptyTag } from '../admin/intake/lib/dskp'
import type { IntakeQuestion } from '../admin/intake/types'
import type { CurriculumTag, QuestionDef, SchemeDef } from '../domain/types'
import { T1_T3_TOPIC, topicOf } from '../domain/topic'
import { gateErrors } from '../server/admin'
import { BijakServer, MemoryStorage } from '../server/store'

const scheme = (id: string): SchemeDef | undefined =>
  id === 'q1' ? { kind: 'option', marks: 1, correct: 'A', reason: 'Kunci' } : undefined

function question(curriculum: CurriculumTag): QuestionDef {
  return {
    id: 'q1',
    curriculum,
    stem: 'Hitung $2 + 3$.',
    mcq: { options: [{ id: 'A', text: '5' }, { id: 'B', text: '6' }] },
  }
}

const tag = (over: Partial<CurriculumTag>): CurriculumTag => ({
  subject: 'MAT',
  level: 'T4',
  unit: 'MAT-T4-01',
  unitLabel: 'Asas Nombor',
  sp: ['1.1'],
  tp: 3,
  formOrigin: 'T4',
  ...over,
})

describe('publish gate: DSKP topic (FB-004)', () => {
  it('a T1-T3 question without a unit can be published', () => {
    const t = tag({ unit: null, unitLabel: '', level: 'T4+T5', formOrigin: 'T1-T3' })
    expect(gateErrors([question(t)], scheme)).toEqual([])
  })

  it('T4 and T5 questions still need the unit label', () => {
    for (const formOrigin of ['T4', 'T5'] as const) {
      const t = tag({ unit: null, unitLabel: '', formOrigin })
      expect(gateErrors([question(t)], scheme)).toEqual(['Soalan 1: topik DSKP belum dipilih'])
    }
  })

  it('a T4 question with a unit label passes', () => {
    expect(gateErrors([question(tag({}))], scheme)).toEqual([])
  })

  it('other gate rules are unchanged for T1-T3', () => {
    const t = tag({ unit: null, unitLabel: '', formOrigin: 'T1-T3' })
    expect(gateErrors([question(t)], () => undefined)).toEqual(['Soalan 1: skema jawapan belum ada'])
  })

  it('the intake gate and the publish gate agree on a T1-T3 question', () => {
    const tagged: CurriculumTag = { ...emptyTag('MAT'), formOrigin: 'T1-T3', unit: null, unitLabel: '', sp: ['1.1'] }
    const q: IntakeQuestion = {
      id: 'q1',
      label: '1',
      type: 'mcq',
      stem: 'Hitung $2 + 3$.',
      options: [
        { id: 'A', text: '5' },
        { id: 'B', text: '6' },
      ],
      marks: 1,
      mode: 'short_text',
      parts: [],
      scheme: { kind: 'option', marks: 1, correct: 'A', reason: 'Kunci' },
      tag: tagged,
      page: 1,
      lowFields: [],
      confirmed: [],
    }
    const intake = validateBatch({ questions: [q], stimuli: [], source: 'x', copyright: 'sendiri' })
    expect(intake.filter((i) => i.message.includes('Unit DSKP'))).toEqual([])
    expect(gateErrors([question(tagged)], scheme)).toEqual([])
    // and a T4 question without a unit is refused by both
    const t4 = { ...tagged, formOrigin: 'T4' as const }
    const intakeT4 = validateBatch({ questions: [{ ...q, tag: t4 }], stimuli: [], source: 'x', copyright: 'sendiri' })
    expect(intakeT4.some((i) => i.message.includes('Unit DSKP'))).toBe(true)
    expect(gateErrors([question(t4)], scheme)).toHaveLength(1)
  })
})

describe('T1-T3 topic display (FB-004 follow-up)', () => {
  it('falls back to the editor copy only for T1-T3 without a unit label', () => {
    expect(topicOf(tag({ unit: null, unitLabel: '', formOrigin: 'T1-T3' }))).toBe(T1_T3_TOPIC)
    expect(T1_T3_TOPIC).toBe('Tingkatan 1-3 (di luar DSKP)')
    expect(topicOf(tag({ unitLabel: 'Pemfaktoran', formOrigin: 'T1-T3' }))).toBe('Pemfaktoran')
    expect(topicOf(tag({ unit: null, unitLabel: '', formOrigin: 'T4' }))).toBe('')
  })

  it('a published T1-T3 question without a unit shows the fallback topic in the bank', async () => {
    const server = new BijakServer({ storage: new MemoryStorage() })
    const id = 'mat1-pub-1'
    const e = await server.getBankEditable(id)
    const edited: IntakeQuestion = {
      ...e.question,
      tag: { ...e.question.tag, formOrigin: 'T1-T3', unit: null, unitLabel: '' },
    }
    expect((await server.reviseQuestionFull(id, edited, undefined, '')).ok).toBe(true)
    expect((await server.reviewDecision(`v:${id}`, { action: 'terbit' })).ok).toBe(true)
    expect((await server.getBankDetail(id)).row.topic).toBe(T1_T3_TOPIC)
    expect((await server.listBank()).find((r) => r.id === id)?.topic).toBe(T1_T3_TOPIC)
  })
})
