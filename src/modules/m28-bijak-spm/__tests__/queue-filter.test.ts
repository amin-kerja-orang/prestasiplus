/**
 * DSKP-T05b: the review queue has the bank's curriculum filters (Tingkatan, Unit, SP, TP, KBAT) and
 * its items carry the bank row's tag fields (design 6.1 / UQ-1, architecture 5.4). The queue has no
 * "Perlu semakan tag" filter. A unit or stimulus group is one item: it shows the tag of its first
 * question and matches a filter when ANY of its questions matches.
 *
 * The expected sets are computed independently: each oracle below reads the stored tags of the
 * questions of every item (from the review detail, not from the filter code) and applies the rule
 * written out by hand per filter.
 */
import { afterEach, describe, expect, it } from 'vitest'

import { BANK } from '../data/registry'
import type { QueueItem } from '../domain/admin-types'
import type { CurriculumTag } from '../domain/types'
import { BijakServer, MemoryStorage } from '../server/store'
import {
  MAT_T4_OTHER_SP,
  MAT_T4_OTHER_UNIT,
  MAT_T4_SP,
  MAT_T4_UNIT,
  MAT_T5_SP,
  MAT_T5_UNIT,
  matTag,
  t13Tag,
} from './tag-fixtures'

// The bank is a shared in-memory registry; approvals change it, so restore it after each test.
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

const keys = (items: { key: string }[]): string[] => items.map((i) => i.key).sort()

/**
 * A server whose queue also holds the submitted demo batch: one stimulus group of two questions
 * whose tags differ (the first is T4 / TP 2 / no KBAT, the second is T5 / TP 5 / Menilai), one T4
 * question of another unit and T1-T3 questions.
 */
async function serverWithGroup(): Promise<{ server: BijakServer; groupKey: string }> {
  const server = new BijakServer({ storage: new MemoryStorage() })
  const before = new Set(keys((await server.listReviewQueue({ status: 'semua' })).items))
  const b = await server.getIntakeBatch('ek-demo-1')
  let inGroup = 0
  let other = 0
  const questions = b.questions.map((x) => {
    let tag: CurriculumTag
    if (x.stimulusId) {
      tag =
        inGroup++ === 0
          ? matTag({ tp: 2, kbat: null })
          : matTag({
              formOrigin: 'T5',
              unitId: MAT_T5_UNIT,
              spIds: [MAT_T5_SP],
              tp: 5,
              kbat: 'menilai',
            })
    } else {
      tag =
        other++ === 0
          ? matTag({ unitId: MAT_T4_OTHER_UNIT, spIds: [MAT_T4_OTHER_SP], tp: 4 })
          : t13Tag({ tp: 1 })
    }
    return { ...x, confirmed: [...x.lowFields], tag }
  })
  const stimuli = b.stimuli.map((s) => ({ ...s, alt: s.alt || 'Rajah segi tiga' }))
  await server.saveExtracted(b.id, { questions, stimuli })
  expect((await server.submitForReview(b.id)).ok).toBe(true)
  const added = (await server.listReviewQueue({ status: 'semua' })).items.filter(
    (i) => !before.has(i.key),
  )
  const group = added.find((i) => i.questionIds.length === 2)
  expect(group).toBeDefined()
  return { server, groupKey: group!.key }
}

/** Every queue item with the stored tags of all its questions (the oracle's input). */
async function withTags(
  server: BijakServer,
): Promise<{ item: QueueItem; tags: CurriculumTag[] }[]> {
  const { items } = await server.listReviewQueue({ status: 'semua' })
  return Promise.all(
    items.map(async (item) => ({
      item,
      tags: (await server.getReviewItem(item.key)).questions.map((q) => q.curriculum),
    })),
  )
}

const expectKeys = (
  all: { item: QueueItem; tags: CurriculumTag[] }[],
  hit: (t: CurriculumTag) => boolean,
): string[] =>
  all
    .filter((e) => e.tags.some(hit))
    .map((e) => e.item.key)
    .sort()

describe('queue tag fields (design 5.4)', () => {
  it('a single-question item carries the same tag fields a bank row would', async () => {
    const server = new BijakServer({ storage: new MemoryStorage() })
    const { items } = await server.listReviewQueue({ status: 'semua' })
    const flagged = items.find((i) => i.key === 'sn1-rev-1')!
    expect(flagged).toMatchObject({
      formOrigin: null,
      unitId: null,
      unitTitle: null,
      spCodes: [],
      tp: 2,
      kbat: null,
      tagReview: true,
    })
    const t13 = items.find((i) => i.key === 'mat1-rev-1')!
    expect(t13).toMatchObject({ formOrigin: 'T1-T3', unitId: null, unitTitle: null, tagReview: false })
  })

  it('a group item shows the tag of its first question, like topic', async () => {
    const { server, groupKey } = await serverWithGroup()
    const item = (await server.listReviewQueue({ status: 'semua' })).items.find(
      (i) => i.key === groupKey,
    )!
    expect(item).toMatchObject({
      formOrigin: 'T4',
      unitId: MAT_T4_UNIT,
      unitTitle: 'Fungsi dan Persamaan Kuadratik dalam Satu Pemboleh Ubah',
      topic: 'Fungsi dan Persamaan Kuadratik dalam Satu Pemboleh Ubah',
      spCodes: ['1.1.6'],
      tp: 2,
      kbat: null,
      tagReview: false,
    })
    // the seed group: first question T1-T3, second flagged; the item shows the first
    const seedGroup = (await server.listReviewQueue({ status: 'semua' })).items.find(
      (i) => i.key === 'mat2-rev-g1',
    )!
    expect(seedGroup).toMatchObject({ formOrigin: 'T1-T3', tagReview: false })
  })

  it('a revision item shows the tag it would publish', async () => {
    const server = new BijakServer({ storage: new MemoryStorage() })
    const e = await server.getBankEditable('mat2-kuadratik-v1')
    const res = await server.reviseQuestionFull(
      'mat2-kuadratik-v1',
      {
        ...e.question,
        tag: {
          ...e.question.tag,
          formOrigin: 'T5',
          unitId: MAT_T5_UNIT,
          spIds: [MAT_T5_SP],
          tp: 5,
          kbat: 'mencipta',
        },
      },
      undefined,
      '',
    )
    expect(res.ok).toBe(true)
    const item = (await server.listReviewQueue()).items.find((i) => i.key === 'v:mat2-kuadratik-v1')!
    expect(item).toMatchObject({
      formOrigin: 'T5',
      unitId: MAT_T5_UNIT,
      spCodes: ['1.1.1'],
      tp: 5,
      kbat: 'mencipta',
      tagReview: false,
    })
    // the live question is still T4, but the queue judges the revision
    expect(keys((await server.listReviewQueue({ formOrigin: 'T5' })).items)).toContain(
      'v:mat2-kuadratik-v1',
    )
    expect(keys((await server.listReviewQueue({ formOrigin: 'T4' })).items)).not.toContain(
      'v:mat2-kuadratik-v1',
    )
    expect((await server.getReviewItem('v:mat2-kuadratik-v1')).item.tp).toBe(5)
  })
})

describe('listReviewQueue tag filters (design 6.1, UQ-1)', () => {
  it('Tingkatan, Unit, SP, TP and KBAT each return exactly the items that match', async () => {
    const { server } = await serverWithGroup()
    const all = await withTags(server)
    expect(all.length).toBeGreaterThan(8)
    const q = (f: object) => server.listReviewQueue({ status: 'semua', ...f })

    for (const [o, want] of [
      ['T4', 'T4'],
      ['T5', 'T5'],
      ['T1-T3', 'T1-T3'],
    ] as const) {
      const got = keys((await q({ formOrigin: o })).items)
      expect(got).toEqual(expectKeys(all, (t) => t.formOrigin === want))
      expect(got.length).toBeGreaterThan(0)
    }

    const byUnit = keys((await q({ unitId: MAT_T4_OTHER_UNIT })).items)
    expect(byUnit).toEqual(expectKeys(all, (t) => t.unitId === 'MAT:T4:u:2.0'))
    expect(byUnit).toHaveLength(1)

    const bySp = keys((await q({ spId: MAT_T4_SP })).items)
    expect(bySp).toEqual(expectKeys(all, (t) => t.spIds.some((s) => s === 'MAT:T4:sp:1.1.6')))
    expect(bySp.length).toBeGreaterThan(0)

    for (const tp of [1, 2, 3, 4, 5, 6]) {
      const got = keys((await q({ tp })).items)
      expect(got).toEqual(expectKeys(all, (t) => t.tp === tp))
    }
    expect((await q({ tp: 5 })).items.length).toBeGreaterThan(0)

    expect(keys((await q({ kbat: 'ya' })).items)).toEqual(expectKeys(all, (t) => t.kbat !== null))
    expect(keys((await q({ kbat: 'ya' })).items).length).toBeGreaterThan(0)
    expect(keys((await q({ kbat: 'tidak' })).items)).toEqual(expectKeys(all, (t) => t.kbat === null))
    expect(keys((await q({ kbat: 'menilai' })).items)).toEqual(
      expectKeys(all, (t) => t.kbat === 'menilai'),
    )
    expect(keys((await q({ kbat: 'mencipta' })).items)).toEqual([])
  })

  it('filters combine with each other and with Subjek, Kertas and Jenis', async () => {
    const { server } = await serverWithGroup()
    const all = await withTags(server)
    const got = (
      await server.listReviewQueue({ status: 'semua', subject: 'MAT', formOrigin: 'T4', tp: 4 })
    ).items
    // the one T4 question with TP 4: an item matches when one question has both (same question)
    expect(keys(got)).toEqual(
      all
        .filter((e) => e.item.subject === 'MAT')
        .filter((e) => e.tags.some((t) => t.formOrigin === 'T4' && t.tp === 4))
        .map((e) => e.item.key)
        .sort(),
    )
    expect(got.length).toBeGreaterThan(0)
    expect(
      (await server.listReviewQueue({ status: 'semua', subject: 'SN', formOrigin: 'T4' })).items,
    ).toEqual([])
  })

  it('an unset filter changes nothing, and an unknown unit or SP gives an empty list', async () => {
    const { server } = await serverWithGroup()
    const plain = await server.listReviewQueue()
    expect((await server.listReviewQueue({ kbat: undefined, tp: undefined })).items).toEqual(
      plain.items,
    )
    expect(
      (await server.listReviewQueue({ status: 'semua', unitId: 'MAT:T4:u:99.0' })).items,
    ).toEqual([])
    expect(
      (await server.listReviewQueue({ status: 'semua', spId: 'MAT:T4:sp:99.9.9' })).items,
    ).toEqual([])
  })

  it('the status counts stay unfiltered, as in the bank KPI strip', async () => {
    const { server } = await serverWithGroup()
    const plain = await server.listReviewQueue()
    const filtered = await server.listReviewQueue({ formOrigin: 'T5', tp: 5 })
    expect(filtered.items.length).toBeLessThan(plain.items.length)
    expect(filtered.counts).toEqual(plain.counts)
    expect(filtered.questions).toEqual(plain.questions)
  })

  it('there is no "Perlu semakan tag" filter on the queue', async () => {
    const server = new BijakServer({ storage: new MemoryStorage() })
    const plain = await server.listReviewQueue()
    // @ts-expect-error QueueFilter has no tagReview: the queue lists flagged items anyway
    const res = await server.listReviewQueue({ tagReview: true })
    expect(res.items).toEqual(plain.items)
    expect(plain.items.some((i) => i.tagReview)).toBe(true)
    expect(plain.items.some((i) => !i.tagReview)).toBe(true)
  })
})

describe('items with several questions match when ANY question matches', () => {
  it('the group matches a filter that only its second question satisfies', async () => {
    const { server, groupKey } = await serverWithGroup()
    const q = (f: object) => server.listReviewQueue({ status: 'semua', ...f })
    // the first question is T4 / TP 2 / no KBAT; the second is T5 / TP 5 / Menilai
    for (const f of [
      { formOrigin: 'T5' },
      { unitId: MAT_T5_UNIT },
      { spId: MAT_T5_SP },
      { tp: 5 },
      { kbat: 'menilai' },
      { kbat: 'ya' },
    ]) {
      expect(keys((await q(f)).items), JSON.stringify(f)).toContain(groupKey)
    }
    // and the first question's own tag still matches
    for (const f of [{ formOrigin: 'T4' }, { unitId: MAT_T4_UNIT }, { spId: MAT_T4_SP }, { tp: 2 }]) {
      expect(keys((await q(f)).items), JSON.stringify(f)).toContain(groupKey)
    }
  })

  it('the group is left out when no question matches, and appears once', async () => {
    const { server, groupKey } = await serverWithGroup()
    const q = (f: object) => server.listReviewQueue({ status: 'semua', ...f })
    for (const f of [{ tp: 6 }, { kbat: 'mencipta' }, { unitId: MAT_T4_OTHER_UNIT }]) {
      expect(keys((await q(f)).items), JSON.stringify(f)).not.toContain(groupKey)
    }
    const both = (await q({ formOrigin: 'T4' })).items.filter((i) => i.key === groupKey)
    expect(both).toHaveLength(1)
  })

  it('the combined filters must be met by one question, not spread over the two', async () => {
    const { server, groupKey } = await serverWithGroup()
    // T4 is the first question's, TP 5 the second's: no single question has both
    const res = await server.listReviewQueue({ status: 'semua', formOrigin: 'T4', tp: 5 })
    expect(keys(res.items)).not.toContain(groupKey)
    const ok = await server.listReviewQueue({ status: 'semua', formOrigin: 'T5', tp: 5 })
    expect(keys(ok.items)).toContain(groupKey)
  })

  it('the seed group (first T1-T3, second flagged) matches on its first question', async () => {
    const server = new BijakServer({ storage: new MemoryStorage() })
    const t13 = keys((await server.listReviewQueue({ formOrigin: 'T1-T3' })).items)
    expect(t13).toContain('mat2-rev-g1')
    // the flagged second question has no tingkatan, so no tingkatan other than T1-T3 reaches it
    expect(keys((await server.listReviewQueue({ formOrigin: 'T4' })).items)).not.toContain(
      'mat2-rev-g1',
    )
  })
})
