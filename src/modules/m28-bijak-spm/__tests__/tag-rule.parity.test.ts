/**
 * DSKP-T03, partial parity (design 5.2, risk R7): one matrix of tags goes to the entry points that
 * use `tagIssues` today (batch submit and Sunting revision) and both must report exactly the
 * messages of the rule. The publish gate joins in DSKP-T05, which completes this test.
 */
import { beforeAll, describe, expect, it } from 'vitest'

import { validateBatch, validateRevision } from '../admin/intake/domain/validation'
import type { IntakeQuestion } from '../admin/intake/types'
import { emptyTag } from '../domain/tag-edit'
import { tagIssues } from '../domain/tag-rule'
import type { TagLookup } from '../domain/tag-rule'
import type { CurriculumTag, TpLevel } from '../domain/types'
import { gateErrors } from '../server/admin'
import {
  BI_T4_SLOT,
  MAT_T4_OTHER_SP,
  MAT_T4_SP,
  MAT_T5_SP,
  MAT_T5_UNIT,
  loadTagLookup,
  matTag,
  t13Tag,
} from './tag-fixtures'

let lookup: TagLookup
beforeAll(async () => {
  lookup = await loadTagLookup()
})

const question = (tag: CurriculumTag): IntakeQuestion => ({
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
  tag,
  page: 1,
  lowFields: [],
  confirmed: [],
})

const bad = (n: number): TpLevel => n as TpLevel

const MATRIX: { name: string; tag: CurriculumTag }[] = [
  { name: 'complete T4', tag: matTag() },
  { name: 'complete T5', tag: matTag({ formOrigin: 'T5', unitId: MAT_T5_UNIT, spIds: [MAT_T5_SP] }) },
  { name: 'complete T1-T3', tag: t13Tag() },
  { name: 'T4 without unit and SP', tag: matTag({ unitId: null, spIds: [] }) },
  { name: 'T4 without SP', tag: matTag({ spIds: [] }) },
  { name: 'T4 with an SP of another unit', tag: matTag({ spIds: [MAT_T4_OTHER_SP] }) },
  {
    name: 'T4 with a non-selectable slot',
    tag: matTag({ subject: 'BI', unitId: 'BI:T4:u:1.0' as never, spIds: [BI_T4_SLOT] }),
  },
  { name: 'T4 with a unit of T5', tag: matTag({ unitId: MAT_T5_UNIT }) },
  { name: 'T4 with an invented unit', tag: matTag({ unitId: 'MAT-T4-02' as never }) },
  { name: 'tingkatan not chosen', tag: matTag({ formOrigin: null }) },
  { name: 'untagged', tag: emptyTag('MAT') },
  { name: 'flagged seed', tag: { ...emptyTag('MAT'), tp: 2, review: 'perlu-semakan' } },
  { name: 'T1-T3 with a unit', tag: t13Tag({ unitId: matTag().unitId }) },
  { name: 'T1-T3 with an SP', tag: t13Tag({ spIds: [MAT_T4_SP] }) },
  { name: 'TP not chosen', tag: matTag({ tp: null }) },
  { name: 'TP 0', tag: matTag({ tp: bad(0) }) },
  { name: 'TP 7', tag: matTag({ tp: bad(7) }) },
  { name: 'T1-T3 without TP', tag: t13Tag({ tp: null }) },
  { name: 'KBAT set', tag: matTag({ kbat: 'menganalisis' }) },
  { name: 'KBAT invalid', tag: matTag({ kbat: 'x' as never }) },
]

describe('tag rule parity (partial: submit and revision)', () => {
  for (const { name, tag } of MATRIX) {
    it(`${name}: batch submit and Sunting revision report the messages of the rule`, () => {
      const expected = tagIssues(tag, lookup).map((i) => i.message)
      const q = question(tag)
      const submit = validateBatch(
        { questions: [q], stimuli: [], source: 'x', copyright: 'sendiri' },
        lookup,
      )
      expect(submit.map((i) => i.message)).toEqual(expected)
      expect(validateRevision(q, undefined, lookup)).toEqual(expected.map((m) => `Soalan: ${m}`))
    })
  }

  it('the interim publish gate agrees on the unit check for T1-T3 and for T4/T5 without a unit', () => {
    const scheme = () => ({ kind: 'option' as const, marks: 1, correct: 'A', reason: 'Kunci' })
    const def = (tag: CurriculumTag) => ({
      id: 'q1',
      curriculum: tag,
      stem: 'x',
      mcq: {
        options: [
          { id: 'A', text: '5' },
          { id: 'B', text: '6' },
        ],
      },
    })
    const unitMissing = (tag: CurriculumTag) =>
      tagIssues(tag, lookup).some((i) => i.field === 'unit')
    const cases = [
      t13Tag(),
      matTag(),
      matTag({ unitId: null, spIds: [] }),
      matTag({ formOrigin: 'T5', unitId: null, spIds: [] }),
    ]
    for (const tag of cases) expect(gateErrors([def(tag)], scheme).length > 0).toBe(unitMissing(tag))
  })

  it.todo('publish (gateErrors) runs tagIssues on every question of the unit: completed in DSKP-T05')
})
