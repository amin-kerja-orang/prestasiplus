/**
 * DSKP-T05: tag audit in the history (AC-10.1 to AC-10.4, design 2.7): `tagChanges` (pure) and the
 * two places the server writes it: batch submit (first tagging, with the AI suggestion) and Sunting
 * submit (live tag vs edited tag).
 */
import { afterEach, describe, expect, it } from 'vitest'

import { blankQuestion } from '../admin/intake/domain/blank'
import type { IntakeQuestion, ManualMeta } from '../admin/intake/types'
import { BANK } from '../data/registry'
import type { TagSuggestion } from '../domain/admin-types'
import { tagChanges } from '../domain/tag-audit'
import { BijakServer, MemoryStorage } from '../server/store'
import { MAT_T4_SP, MAT_T4_SP2, MAT_T4_UNIT, matTag, t13Tag } from './tag-fixtures'

const meta: ManualMeta = {
  subject: 'MAT',
  kertas: 2,
  year: 2026,
  paperType: 'Soalan Umum',
  source: 'Latihan sekolah fiksyen',
  copyright: 'sendiri',
  notes: '',
}

const snapshot = {
  questions: new Map(BANK.questions),
  schemes: new Map(BANK.schemes),
  stimuli: new Map(BANK.stimuli),
  groups: new Map(BANK.groups),
}
afterEach(() => {
  for (const [k, m] of [
    ['questions', BANK.questions],
    ['schemes', BANK.schemes],
    ['stimuli', BANK.stimuli],
    ['groups', BANK.groups],
  ] as const) {
    m.clear()
    for (const [id, v] of snapshot[k] as Map<string, never>) (m as Map<string, never>).set(id, v)
  }
})

const mcq = (q: IntakeQuestion, over: Partial<IntakeQuestion> = {}): IntakeQuestion => ({
  ...q,
  type: 'mcq',
  stem: 'Nilai $2 + 3$ ialah',
  options: ['4', '5', '6', '7'].map((text, i) => ({ id: 'ABCD'[i]!, text })),
  marks: 1,
  scheme: { kind: 'option', marks: 1, correct: 'B', reason: '2 + 3 = 5' },
  ...over,
})

describe('tagChanges (pure)', () => {
  it('first tagging has no before; fields the AI never mentioned have no ai (AC-10.2)', () => {
    const changes = tagChanges(undefined, matTag({ tp: 3 }))
    expect(changes.map((c) => c.field)).toEqual(['formOrigin', 'unit', 'sp', 'tp'])
    for (const c of changes) {
      expect('before' in c).toBe(false)
      expect('ai' in c).toBe(false)
      expect('confidence' in c).toBe(false)
    }
    expect(changes.find((c) => c.field === 'sp')?.after).toEqual([MAT_T4_SP])
    expect(changes.find((c) => c.field === 'unit')?.after).toBe(MAT_T4_UNIT)
    // KBAT stays out while it is empty
    expect(changes.some((c) => c.field === 'kbat')).toBe(false)
  })

  it('records the AI value and its confidence beside the final value (AC-10.1)', () => {
    const s: TagSuggestion = {
      providerId: 'mock',
      model: 'heuristik-1',
      unitId: MAT_T4_UNIT,
      spIds: [MAT_T4_SP],
      tp: 3,
      confidence: { unit: 'tinggi', sp: 'sederhana', tp: 'rendah' },
    }
    const changes = tagChanges(undefined, matTag({ tp: 4, spIds: [MAT_T4_SP, MAT_T4_SP2] }), s)
    expect(changes.find((c) => c.field === 'unit')).toEqual({
      field: 'unit',
      after: MAT_T4_UNIT,
      ai: MAT_T4_UNIT,
      confidence: 'tinggi',
    })
    expect(changes.find((c) => c.field === 'tp')).toMatchObject({ after: 4, ai: 3, confidence: 'rendah' })
    expect(changes.find((c) => c.field === 'sp')).toMatchObject({
      after: [MAT_T4_SP, MAT_T4_SP2],
      ai: [MAT_T4_SP],
      confidence: 'sederhana',
    })
  })

  it('a suggestion the person did not keep is recorded even when nothing else changed', () => {
    const s: TagSuggestion = { providerId: 'mock', model: 'm', kbat: 'menilai', confidence: { kbat: 'rendah' } }
    const changes = tagChanges(undefined, t13Tag({ tp: 2 }), s)
    expect(changes.find((c) => c.field === 'kbat')).toEqual({
      field: 'kbat',
      after: null,
      ai: 'menilai',
      confidence: 'rendah',
    })
  })

  it('a revision lists only the fields that changed, with before and after (AC-10.3)', () => {
    const before = matTag({ tp: 2 })
    expect(tagChanges(before, { ...before })).toEqual([])
    expect(tagChanges(before, { ...before, tp: 4 })).toEqual([{ field: 'tp', before: 2, after: 4 }])
    expect(tagChanges(before, { ...before, spIds: [MAT_T4_SP2], kbat: 'mencipta' })).toEqual([
      { field: 'sp', before: [MAT_T4_SP], after: [MAT_T4_SP2] },
      { field: 'kbat', before: null, after: 'mencipta' },
    ])
    expect(tagChanges(before, t13Tag({ tp: 2 })).map((c) => c.field)).toEqual(['formOrigin', 'unit', 'sp'])
  })

  it('does not alias the tag arrays', () => {
    const t = matTag()
    const [sp] = tagChanges(undefined, t).filter((c) => c.field === 'sp')
    ;(sp!.after as string[]).push('x')
    expect(t.spIds).toEqual([MAT_T4_SP])
  })
})

describe('history written by the server', () => {
  it('batch submit: the "Dihantar untuk semakan" entry carries the first tagging with the AI suggestion', async () => {
    const server = new BijakServer({ storage: new MemoryStorage() })
    const b = await server.createManualBatch(1, meta)
    const suggestion: TagSuggestion = {
      providerId: 'mock',
      model: 'heuristik-1',
      unitId: MAT_T4_UNIT,
      spIds: [MAT_T4_SP],
      tp: 2,
      confidence: { unit: 'tinggi', sp: 'tinggi', tp: 'rendah' },
    }
    const q1 = mcq(b.questions[0]!, {
      tag: matTag({ tp: 3 }),
      tagSuggestion: suggestion,
      lowFields: ['tag.tp'],
      confirmed: ['tag.tp'],
    })
    const q2 = mcq({ ...blankQuestion('MAT', 2), label: '2' }, { tag: t13Tag({ tp: 2 }) })
    await server.saveExtracted(b.id, { questions: [q1, q2], stimuli: [] })
    const res = await server.submitForReview(b.id)
    expect(res.ok).toBe(true)

    const first = (await server.getReviewItem(`${b.id}-q1`)).history[0]!
    expect(first.action).toBe('Dihantar untuk semakan')
    expect(first.tag).toEqual([
      { field: 'formOrigin', after: 'T4' },
      { field: 'unit', after: MAT_T4_UNIT, ai: MAT_T4_UNIT, confidence: 'tinggi' },
      { field: 'sp', after: [MAT_T4_SP], ai: [MAT_T4_SP], confidence: 'tinggi' },
      { field: 'tp', after: 3, ai: 2, confidence: 'rendah' },
    ])
    // no AI suggestion: the final value only, the suggestion empty (AC-10.2)
    const second = (await server.getReviewItem(`${b.id}-q2`)).history[0]!
    expect(second.tag).toEqual([
      { field: 'formOrigin', after: 'T1-T3' },
      { field: 'tp', after: 2 },
    ])
    expect(JSON.stringify(second.tag)).not.toContain('"ai"')
  })

  it('Sunting submit: the "Versi n dicipta" entry shows the tag before and after (AC-10.3)', async () => {
    const storage = new MemoryStorage()
    const server = new BijakServer({ storage })
    const id = 'mat2-kuadratik-v1'
    const e = await server.getBankEditable(id)
    const res = await server.reviseQuestionFull(
      id,
      { ...e.question, tag: { ...e.question.tag, tp: 5, kbat: 'menganalisis' } },
      undefined,
      'Naikkan TP',
    )
    expect(res.ok).toBe(true)
    const entry = (await server.getReviewItem(`v:${id}`)).history.at(-1)!
    expect(entry).toMatchObject({ version: 2, note: 'Naikkan TP' })
    expect(entry.action).toBe('Versi 2 dicipta (Draf, dihantar untuk semakan)')
    expect(entry.tag).toEqual([
      { field: 'tp', before: 2, after: 5 },
      { field: 'kbat', before: null, after: 'menganalisis' },
    ])
    // kept with the record: a reload shows the same lines, and no entry is edited or removed
    const again = new BijakServer({ storage })
    expect((await again.getReviewItem(`v:${id}`)).history.at(-1)!.tag).toEqual(entry.tag)
  })

  it('a revision that leaves the tag alone, or only the stem, writes no tag lines', async () => {
    const server = new BijakServer({ storage: new MemoryStorage() })
    const e = await server.getBankEditable('mat2-kuadratik-v1')
    expect(
      (await server.reviseQuestionFull('mat2-kuadratik-v1', { ...e.question, stem: `${e.question.stem} Ulang.` }, undefined, '')).ok,
    ).toBe(true)
    expect((await server.getReviewItem('v:mat2-kuadratik-v1')).history.at(-1)!.tag).toBeUndefined()

    expect((await server.reviseQuestion('mat1-pub-1', 'Selesaikan $2x = 8$.', '')).ok).toBe(true)
    expect((await server.getReviewItem('v:mat1-pub-1')).history.at(-1)!.tag).toBeUndefined()
  })

  it('approving the revision keeps the tag lines and the published tag is the edited one', async () => {
    const server = new BijakServer({ storage: new MemoryStorage() })
    const id = 'mat2-kuadratik-v1'
    const e = await server.getBankEditable(id)
    await server.reviseQuestionFull(id, { ...e.question, tag: { ...e.question.tag, tp: 6 } }, undefined, '')
    expect((await server.reviewDecision(`v:${id}`, { action: 'terbit' })).ok).toBe(true)
    const d = await server.getBankDetail(id)
    expect(d.row.tp).toBe(6)
    expect(d.history.some((h) => h.tag?.some((c) => c.field === 'tp' && c.after === 6))).toBe(true)
  })
})
