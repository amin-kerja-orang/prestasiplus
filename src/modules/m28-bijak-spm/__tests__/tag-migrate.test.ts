/**
 * DSKP-T03: migration of old-shape tags (`legacyTagToV2`, `migrateTagsInState`), design 2.8.
 */
import { describe, expect, it } from 'vitest'

import { TAG_STATE_SCHEMA, isLegacyTag, legacyTagToV2, migrateTagsInState } from '../lib/tag-migrate'
import type { TagHoldingState } from '../lib/tag-migrate'
import { matTag } from './tag-fixtures'

const old = (over: Record<string, unknown> = {}) => ({
  subject: 'MAT',
  level: 'T4' as const,
  unit: 'MAT-T4-02',
  unitLabel: 'Asas Nombor',
  sp: ['1.1'],
  tp: 2,
  formOrigin: 'T4' as const,
  ...over,
})

describe('legacyTagToV2', () => {
  it('T1-T3 keeps its tingkatan and TP, with no unit or SP', () => {
    const t = legacyTagToV2(
      old({ formOrigin: 'T1-T3', unit: null, unitLabel: 'Pecahan', sp: [], level: 'T4+T5', tp: 3 }),
    )
    expect(t).toEqual({
      subject: 'MAT',
      formOrigin: 'T1-T3',
      unitId: null,
      spIds: [],
      tp: 3,
      kbat: null,
      catalogueVersion: null,
    })
  })

  it('T4/T5 with a unit or SP is flagged and nothing is carried (never "the closest", AC-08.4)', () => {
    for (const formOrigin of ['T4', 'T5'])
      expect(legacyTagToV2(old({ formOrigin }) as never)).toEqual({
        subject: 'MAT',
        formOrigin: null,
        unitId: null,
        spIds: [],
        tp: 2,
        kbat: null,
        catalogueVersion: null,
        review: 'perlu-semakan',
      })
  })

  it('a seed that only had a unit label is flagged too; an empty draft is simply untagged', () => {
    expect(legacyTagToV2(old({ unit: null, sp: [], unitLabel: 'Garis lurus' }) as never)).toMatchObject({
      formOrigin: null,
      review: 'perlu-semakan',
    })
    const draft = legacyTagToV2(old({ unit: null, sp: [], unitLabel: '' }))
    expect(draft.formOrigin).toBeNull()
    expect('review' in draft).toBe(false)
  })

  it('TP 1 to 6 is kept, anything else becomes null', () => {
    for (const tp of [1, 2, 3, 4, 5, 6]) expect(legacyTagToV2(old({ tp }) as never).tp).toBe(tp)
    for (const tp of [0, 7, 2.5, -1, undefined, null, '3'])
      expect(legacyTagToV2(old({ tp }) as never).tp).toBeNull()
  })

  it('KBAT is kept in its lower-case form, an unknown value is dropped', () => {
    expect(legacyTagToV2(old({ kbat: 'Menilai' }) as never).kbat).toBe('menilai')
    expect(legacyTagToV2(old({ kbat: 'Mencipta' }) as never).kbat).toBe('mencipta')
    expect(legacyTagToV2(old({ kbat: null }) as never).kbat).toBeNull()
    expect(legacyTagToV2(old({ kbat: 'Lain' }) as never).kbat).toBeNull()
    expect(legacyTagToV2(old() as never).kbat).toBeNull()
  })

  it('level and unitLabel are dropped', () => {
    const t = legacyTagToV2(old()) as unknown as Record<string, unknown>
    for (const k of ['level', 'unitLabel', 'unit', 'sp']) expect(k in t).toBe(false)
  })

  it('is idempotent: a v2 tag is returned as it is', () => {
    const v2 = matTag()
    expect(legacyTagToV2(v2)).toBe(v2)
    const once = legacyTagToV2(old())
    expect(legacyTagToV2(once)).toBe(once)
  })

  it('isLegacyTag tells the two shapes apart', () => {
    expect(isLegacyTag(old())).toBe(true)
    expect(isLegacyTag(matTag())).toBe(false)
    expect(isLegacyTag(null)).toBe(false)
    expect(isLegacyTag('x')).toBe(false)
  })
})

describe('migrateTagsInState', () => {
  const state = (): TagHoldingState => ({
    intake: { b1: { questions: [{ tag: old() }, { tag: matTag() }] } },
    dynSeeds: { s1: { questions: [{ curriculum: old({ formOrigin: 'T1-T3', unit: null, sp: [] }) }] } },
    review: {
      q1: {
        revision: { content: { question: { curriculum: old() } } },
        live: { question: { curriculum: old({ tp: 4 }) } },
      },
      q2: {},
    },
  })

  it('converts every place that holds a tag and stamps schema 2', () => {
    const s = state()
    expect(migrateTagsInState(s)).toBe(4)
    expect(s.schema).toBe(TAG_STATE_SCHEMA)
    expect(TAG_STATE_SCHEMA).toBe(2)
    expect(isLegacyTag(s.intake!.b1!.questions![0]!.tag)).toBe(false)
    expect(s.intake!.b1!.questions![0]!.tag).toMatchObject({ formOrigin: null, review: 'perlu-semakan' })
    expect(s.dynSeeds!.s1!.questions![0]!.curriculum).toMatchObject({ formOrigin: 'T1-T3' })
    expect(s.review!.q1!.revision!.content!.question!.curriculum).toMatchObject({ review: 'perlu-semakan' })
    expect(s.review!.q1!.live!.question!.curriculum).toMatchObject({ tp: 4 })
  })

  it('a second run changes nothing', () => {
    const s = state()
    migrateTagsInState(s)
    const snapshot = JSON.stringify(s)
    expect(migrateTagsInState(s)).toBe(0)
    expect(JSON.stringify(s)).toBe(snapshot)
  })

  it('an empty state is stamped and left alone', () => {
    const s: TagHoldingState = {}
    expect(migrateTagsInState(s)).toBe(0)
    expect(s).toEqual({ schema: 2 })
  })
})
