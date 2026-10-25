/**
 * DSKP-T05: the storage migration is wired into the server's `load()` (design 2.8). A state saved
 * before v2 (no `schema`, tags with `level` and `unitLabel`) loads without error, its old tags are
 * flagged for a person to tag again (never matched to a "closest" unit), `schema: 2` is stored, and
 * loading again changes nothing.
 */
import { afterEach, describe, expect, it } from 'vitest'

import type { ManualMeta } from '../admin/intake/types'
import { BANK } from '../data/registry'
import { isLegacyTag, TAG_STATE_SCHEMA } from '../lib/tag-migrate'
import { BijakServer, MemoryStorage, SERVER_STORAGE_KEY } from '../server/store'
import { matTag } from './tag-fixtures'

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

const oldTag = (over: Record<string, unknown> = {}) => ({
  subject: 'MAT',
  level: 'T4+T5',
  unit: 'MAT-T4-02',
  unitLabel: 'Asas Nombor',
  sp: ['1.1'],
  tp: 4,
  formOrigin: 'T4',
  ...over,
})

type Doc = {
  schema?: number
  intake: Record<string, { questions: { tag: unknown }[] }>
  dynSeeds: Record<string, { questions: { curriculum: unknown }[] }>
  review: Record<string, { revision?: { content?: { question: { curriculum: unknown } } } }>
}

/** A saved v1 state: one submitted batch (a review unit), a Draf batch and a pending full edit. */
async function legacyStorage(): Promise<{ storage: MemoryStorage; unitQuestion: string; drafId: string }> {
  const storage = new MemoryStorage()
  const server = new BijakServer({ storage })
  const b = await server.createManualBatch(1, meta)
  await server.saveExtracted(b.id, {
    questions: [
      {
        ...b.questions[0]!,
        type: 'mcq',
        stem: 'Nilai $2 + 3$ ialah',
        options: ['4', '5', '6', '7'].map((text, i) => ({ id: 'ABCD'[i]!, text })),
        marks: 1,
        scheme: { kind: 'option', marks: 1, correct: 'B', reason: '2 + 3 = 5' },
        tag: matTag({ tp: 2 }),
      },
    ],
    stimuli: [],
  })
  expect((await server.submitForReview(b.id)).ok).toBe(true)
  const draf = await server.createManualBatch(1, meta)
  const e = await server.getBankEditable('mat2-kuadratik-v1')
  expect((await server.reviseQuestionFull('mat2-kuadratik-v1', e.question, undefined, '')).ok).toBe(true)

  const doc = JSON.parse(storage.getItem(SERVER_STORAGE_KEY)!) as Doc
  delete doc.schema
  const unitQuestion = `${b.id}-q1`
  doc.dynSeeds[unitQuestion]!.questions[0]!.curriculum = oldTag()
  doc.intake[draf.id]!.questions[0]!.tag = oldTag({ formOrigin: 'T1-T3', unit: null, unitLabel: 'Pecahan', sp: [], tp: 3 })
  doc.review['mat2-kuadratik-v1']!.revision!.content!.question.curriculum = oldTag({ tp: 2 })
  storage.setItem(SERVER_STORAGE_KEY, JSON.stringify(doc))
  return { storage, unitQuestion, drafId: draf.id }
}

describe('server load() migrates a saved state to schema 2', () => {
  it('flags old tingkatan-bound tags, keeps T1-T3, stores schema 2 and never matches a unit', async () => {
    const { storage, unitQuestion, drafId } = await legacyStorage()
    const server = new BijakServer({ storage })

    // the saved document is migrated in storage (not only in memory)
    const saved = JSON.parse(storage.getItem(SERVER_STORAGE_KEY)!) as Doc
    expect(saved.schema).toBe(TAG_STATE_SCHEMA)
    const tags = [
      ...Object.values(saved.dynSeeds).flatMap((s) => s.questions.map((q) => q.curriculum)),
      ...Object.values(saved.intake).flatMap((b) => b.questions.map((q) => q.tag)),
      ...Object.values(saved.review).flatMap((r) => (r.revision?.content ? [r.revision.content.question.curriculum] : [])),
    ]
    expect(tags.length).toBeGreaterThan(3)
    expect(tags.some(isLegacyTag)).toBe(false)

    // the submitted unit: flagged, TP kept, shown with the admin copy, blocked at publish
    const detail = await server.getReviewItem(unitQuestion)
    expect(detail.questions[0]!.curriculum).toMatchObject({
      formOrigin: null,
      unitId: null,
      spIds: [],
      tp: 4,
      review: 'perlu-semakan',
    })
    expect(detail.item.topic).toBe('Perlu semakan tag')
    expect(detail.gate).toEqual(['Soalan 1: Subjek dan tingkatan perlu ditetapkan.'])
    expect((await server.reviewDecision(unitQuestion, { action: 'terbit' })).ok).toBe(false)

    // the pending full edit carries a flagged tag and cannot be approved either
    const rev = await server.getReviewItem('v:mat2-kuadratik-v1')
    expect(rev.item.topic).toBe('Perlu semakan tag')
    expect(rev.gate.length).toBeGreaterThan(0)
    expect((await server.reviewDecision('v:mat2-kuadratik-v1', { action: 'terbit' })).ok).toBe(false)

    // the Draf batch (T1-T3 old tag) is a v2 tag again
    expect(saved.intake[drafId]!.questions[0]!.tag).toMatchObject({ formOrigin: 'T1-T3', unitId: null, spIds: [], tp: 3 })
  })

  it('loading again changes nothing (idempotent), and a fresh state starts at schema 2', async () => {
    const { storage } = await legacyStorage()
    new BijakServer({ storage })
    const once = storage.getItem(SERVER_STORAGE_KEY)
    new BijakServer({ storage })
    new BijakServer({ storage }).reload()
    expect(storage.getItem(SERVER_STORAGE_KEY)).toBe(once)

    const fresh = new MemoryStorage()
    const server = new BijakServer({ storage: fresh })
    expect(fresh.getItem(SERVER_STORAGE_KEY)).toBeNull() // loading alone writes nothing
    await server.createManualBatch(1, meta)
    expect((JSON.parse(fresh.getItem(SERVER_STORAGE_KEY)!) as Doc).schema).toBe(TAG_STATE_SCHEMA)
  })

  it('an unreadable or empty saved state still boots', async () => {
    const storage = new MemoryStorage()
    storage.setItem(SERVER_STORAGE_KEY, '{ not json')
    expect((await new BijakServer({ storage }).listBank()).length).toBeGreaterThan(0)
    storage.setItem(SERVER_STORAGE_KEY, '{}')
    expect((await new BijakServer({ storage }).listBank()).length).toBeGreaterThan(0)
  })

  it('a published question with a v2 tag is untouched by the migration', async () => {
    const { storage } = await legacyStorage()
    const server = new BijakServer({ storage })
    const row = (await server.listBank({ q: 'mat2-kuadratik-v1' })).find((r) => r.id === 'mat2-kuadratik-v1')!
    expect(row).toMatchObject({ formOrigin: 'T4', spCodes: ['1.1.6'], tagReview: false })
  })
})
