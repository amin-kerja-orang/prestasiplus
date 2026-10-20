import {
  BijakAttemptStimulusSchema,
  BijakBuilderGroupSchema,
  BijakBuilderPreviewSchema,
  BijakBuilderQuestionSchema,
} from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { POC_BANK, pocQuestionId, pocQuestionMarks } from '../../src/modules/bijak/papers/poc'
import { PocBuilderQuestionSource } from '../../src/modules/exam/builder/poc-builder-source'

const source = new PocBuilderQuestionSource()
const wire = (key: string): string => pocQuestionId(key).toString()
const scopes = [
  { subject: 'MAT', kertas: 1 },
  { subject: 'MAT', kertas: 2 },
  { subject: 'SN', kertas: 2 },
  { subject: 'SEJ', kertas: 2 },
]

describe('PocBuilderQuestionSource', () => {
  it.each(scopes)('candidates of $subject kertas $kertas are published and in scope', async (scope) => {
    const ids = await source.candidates(scope)
    expect(ids.length).toBeGreaterThan(0)
    const info = await source.describe(ids.map((id) => ({ id })))
    expect(info.size).toBe(ids.length)
    for (const id of ids) {
      const q = info.get(id)!
      expect(q.status).toBe('published')
      expect(q.subject).toBe(scope.subject)
      expect(q.kertas).toBe(scope.kertas)
      expect(q.versionNo).toBe(1)
    }
  })

  it('candidates are decimal wire ids, never PoC keys', async () => {
    for (const id of await source.candidates({ subject: 'MAT', kertas: 1 })) expect(id).toMatch(/^[1-9][0-9]*$/)
  })

  it('describe returns contract-valid questions; absent ids are absent; versionNo is ignored', async () => {
    const all = POC_BANK.questions.map((q) => wire(q.id))
    const info = await source.describe([...all.map((id) => ({ id, versionNo: 7 })), { id: '1' }, { id: 'abc' }])
    expect(info.size).toBe(all.length)
    expect(info.has('1')).toBe(false)
    expect(info.has('abc')).toBe(false)
    for (const [id, q] of info) {
      const { versionNo, groupId, ...rest } = q
      // the wire question omits `groupId` when there is no group (the port carries null)
      const wireQuestion = groupId === null ? rest : { ...rest, groupId }
      expect(versionNo).toBe(1)
      expect(BijakBuilderQuestionSchema.parse(wireQuestion)).toEqual(wireQuestion)
      expect(q.id).toBe(id)
    }
  })

  it('kinds: MCQ objektif, others berstruktur or esei', async () => {
    const info = await source.describe(POC_BANK.questions.map((q) => ({ id: wire(q.id) })))
    for (const q of POC_BANK.questions) {
      const kind = info.get(wire(q.id))!.kind
      if (q.mcq) expect(kind).toBe('objektif')
      else expect(['berstruktur', 'esei']).toContain(kind)
    }
  })

  it('groups() returns members in published order with a valid stimulus', async () => {
    const ids = POC_BANK.groups.map((g) => g.id)
    const groups = await source.groups([...ids, 'nope'])
    expect(groups.has('nope')).toBe(false)
    expect(groups.size).toBeGreaterThan(0)
    for (const g of POC_BANK.groups) {
      const got = groups.get(g.id)
      if (!got) continue
      expect(BijakBuilderGroupSchema.parse(got)).toEqual(got)
      expect(BijakAttemptStimulusSchema.parse(got.stimulus)).toEqual(got.stimulus)
      expect(got.questionIds).toEqual(g.questionIds.map(wire))
    }
    const info = await source.describe(POC_BANK.groups.flatMap((g) => g.questionIds.map((id) => ({ id: wire(id) }))))
    for (const q of info.values()) {
      expect(q.groupId).not.toBeNull()
      expect(q.stimulusLabel).toBe(groups.get(q.groupId!)?.stimulus.label)
    }
  })

  it('review() parses with the contract; an MCQ carries the correct option and the first scheme line', async () => {
    const mcq = POC_BANK.questions.find((q) => q.mcq)!
    const structured = POC_BANK.questions.find((q) => !q.mcq)!
    const grouped = POC_BANK.questions.find((q) => q.groupId)!
    const out = await source.review([wire(mcq.id), '1', wire(structured.id), 'x', wire(grouped.id)])
    expect(BijakBuilderPreviewSchema.parse(out)).toEqual(out)
    expect(out.questions.map((q) => q.id)).toEqual([wire(mcq.id), wire(structured.id), wire(grouped.id)])
    const m = out.questions[0]!
    expect(m.mcq?.correct).toBeTruthy()
    expect(m.scheme[m.id]?.lines[0]?.text).toMatch(/^Jawapan betul: [A-H]$/)
    const letter = 'ABCDEFGH'[m.mcq!.options.findIndex((o) => o.id === m.mcq!.correct)]
    expect(m.scheme[m.id]?.lines[0]?.text).toBe(`Jawapan betul: ${letter}`)
    const s = out.questions[1]!
    expect(s.mcq).toBeUndefined()
    expect(Object.keys(s.scheme).length).toBeGreaterThan(0)
    expect(Object.keys(s.scheme)).not.toContain(s.id)
    expect(out.stimuli[grouped.groupId!]).toBeDefined()
  })

  it('every PoC question reviews to a contract-valid shape', async () => {
    const out = await source.review(POC_BANK.questions.map((q) => wire(q.id)))
    expect(out.questions).toHaveLength(POC_BANK.questions.length)
    expect(BijakBuilderPreviewSchema.parse(out)).toEqual(out)
  })

  it('marks of every PoC paper section placement agree with pocQuestionMarks', async () => {
    const info = await source.describe(POC_BANK.questions.map((q) => ({ id: wire(q.id) })))
    for (const paper of POC_BANK.papers)
      for (const section of paper.sections)
        for (const key of section.questionIds) {
          const q = POC_BANK.questions.find((x) => x.id === key)!
          expect(info.get(wire(key))!.marks).toBe(pocQuestionMarks(q))
        }
  })
})
