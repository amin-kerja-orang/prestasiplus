import { beforeAll, describe, expect, it } from 'vitest'

import { validateBatch } from '../admin/intake/domain/validation'
import type { IntakeQuestion } from '../admin/intake/types'
import { emptyTag } from '../domain/tag-edit'
import type { TagLookup } from '../domain/tag-rule'
import type { CurriculumTag, QuestionDef, SchemeDef } from '../domain/types'
import { REVIEW_TOPIC, T1_T3_TOPIC, studentTopicOf, topicOf } from '../domain/topic'
import { gateErrors } from '../server/admin'
import { BijakServer, MemoryStorage } from '../server/store'
import { loadTagLookup, matTag, t13Tag } from './tag-fixtures'

let lookup: TagLookup
beforeAll(async () => {
  lookup = await loadTagLookup()
})

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

const tag = (over: Partial<CurriculumTag>): CurriculumTag => matTag(over)

describe('publish gate: DSKP topic (FB-004)', () => {
  it('a T1-T3 question without a unit can be published', () => {
    const t = t13Tag()
    expect(gateErrors([question(t)], scheme)).toEqual([])
  })

  it('T4 and T5 questions still need the unit', () => {
    for (const formOrigin of ['T4', 'T5'] as const) {
      const t = tag({ unitId: null, spIds: [], formOrigin })
      expect(gateErrors([question(t)], scheme)).toEqual(['Soalan 1: topik DSKP belum dipilih'])
    }
  })

  it('a flagged question (perlu semakan) is not refused by this check yet (DSKP-T05 wires tagIssues)', () => {
    const t = tag({ formOrigin: null, unitId: null, spIds: [], review: 'perlu-semakan' })
    expect(gateErrors([question(t)], scheme)).toEqual([])
  })

  it('a T4 question with a unit passes', () => {
    expect(gateErrors([question(tag({}))], scheme)).toEqual([])
  })

  it('other gate rules are unchanged for T1-T3', () => {
    const t = t13Tag()
    expect(gateErrors([question(t)], () => undefined)).toEqual(['Soalan 1: skema jawapan belum ada'])
  })

  it('the intake gate and the publish gate agree on a T1-T3 question', () => {
    const tagged: CurriculumTag = t13Tag()
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
    const intake = validateBatch({ questions: [q], stimuli: [], source: 'x', copyright: 'sendiri' }, lookup)
    expect(intake.filter((i) => i.message.includes('Unit DSKP'))).toEqual([])
    expect(gateErrors([question(tagged)], scheme)).toEqual([])
    // and a T4 question without a unit is refused by both
    const t4 = { ...emptyTag('MAT'), formOrigin: 'T4' as const, tp: 3 as const }
    const intakeT4 = validateBatch({ questions: [{ ...q, tag: t4 }], stimuli: [], source: 'x', copyright: 'sendiri' }, lookup)
    expect(intakeT4.some((i) => i.message.includes('Unit DSKP'))).toBe(true)
    expect(gateErrors([question(t4)], scheme)).toHaveLength(1)
  })
})

describe('topic display (FB-004 follow-up, DSKP v2)', () => {
  it('T1-T3 shows the editor copy, whatever the unit id', () => {
    expect(topicOf(t13Tag(), lookup)).toBe(T1_T3_TOPIC)
    expect(T1_T3_TOPIC).toBe('Tingkatan 1-3 (di luar DSKP)')
    expect(topicOf(tag({ formOrigin: 'T1-T3' }), lookup)).toBe(T1_T3_TOPIC)
  })

  it('a tagged question shows the catalogue unit title as printed', () => {
    expect(topicOf(tag({}), lookup)).toBe('Fungsi dan Persamaan Kuadratik dalam Satu Pemboleh Ubah')
  })

  it('a flagged question shows the "perlu semakan" copy and an untagged one nothing', () => {
    expect(topicOf(tag({ formOrigin: null, unitId: null, spIds: [], review: 'perlu-semakan' }), lookup)).toBe(REVIEW_TOPIC)
    expect(topicOf(tag({ formOrigin: 'T4', unitId: null, spIds: [] }), lookup)).toBe('')
  })

  it('an old-shape tag (no unitId at all) does not throw before the migration runs', () => {
    const old = {
      subject: 'MAT',
      level: 'T4',
      unit: 'MAT-T4-02',
      unitLabel: 'Asas Nombor',
      sp: ['1.1'],
      tp: 2,
      formOrigin: 'T4',
    } as unknown as CurriculumTag
    expect(topicOf(old, lookup)).toBe('')
    expect(studentTopicOf(old, lookup)).toBe('')
    expect(topicOf({ ...old, formOrigin: 'T1-T3' }, lookup)).toBe(T1_T3_TOPIC)
  })

  it('a student never sees the admin "perlu semakan" copy', () => {
    const flagged = tag({ formOrigin: null, unitId: null, spIds: [], review: 'perlu-semakan' })
    expect(studentTopicOf(flagged, lookup)).toBe('')
    expect(studentTopicOf(tag({}), lookup)).toBe('Fungsi dan Persamaan Kuadratik dalam Satu Pemboleh Ubah')
    expect(studentTopicOf(t13Tag(), lookup)).toBe(T1_T3_TOPIC)
  })

  it('a unit the lookup does not know (subject not loaded) shows nothing, not a guess', () => {
    const none: Pick<TagLookup, 'unit'> = { unit: () => undefined }
    expect(topicOf(tag({}), none)).toBe('')
  })

  it('a published T1-T3 question without a unit shows the fallback topic in the bank', async () => {
    const server = new BijakServer({ storage: new MemoryStorage() })
    const id = 'mat1-pub-1'
    const e = await server.getBankEditable(id)
    const edited: IntakeQuestion = {
      ...e.question,
      tag: { ...e.question.tag, ...t13Tag({ tp: e.question.tag.tp }) },
    }
    expect((await server.reviseQuestionFull(id, edited, undefined, '')).ok).toBe(true)
    expect((await server.reviewDecision(`v:${id}`, { action: 'terbit' })).ok).toBe(true)
    expect((await server.getBankDetail(id)).row.topic).toBe(T1_T3_TOPIC)
    expect((await server.listBank()).find((r) => r.id === id)?.topic).toBe(T1_T3_TOPIC)
  })
})
