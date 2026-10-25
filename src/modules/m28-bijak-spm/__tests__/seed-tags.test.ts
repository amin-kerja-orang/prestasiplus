/**
 * Seed tags (DSKP-T04, D11): every seed question has exactly one authored row; tagged rows point at
 * real catalogue nodes and pass the tag rule; flagged rows are refused by it; T1-T3 rows carry no
 * unit or SP. The outcome counts are computed here from the data and printed (the architecture doc
 * section 6.3 quotes this output; no count is typed by hand).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { createDskpCatalog, dskpCatalog } from '@/modules/m03-curriculum'
import type { DskpSubjectInfo } from '@/modules/m03-curriculum'

import { untagged } from '../data/builders'
import { BANK } from '../data/registry'
import { REVIEW_SEEDS } from '../data/review-seed'
import { SEED_TAGS, applySeedTags, tagOfSpec } from '../data/seed-tags'
import type { SeedTagSpec } from '../data/seed-tags'
import { tagIssues } from '../domain/tag-rule'
import type { TagLookup } from '../domain/tag-rule'
import { T1_T3_TOPIC } from '../domain/topic'
import type { QuestionDef } from '../domain/types'
import { dskpSource, setDskpCatalogForTests, tagLookupFor } from '../lib/dskp-source'
import { BijakServer, MemoryStorage } from '../server/store'

/** Every seed question: the bank seeds and the review-queue seeds (by id). */
function seedQuestions(): Map<string, QuestionDef> {
  const all = new Map<string, QuestionDef>()
  for (const q of BANK.questions.values()) all.set(q.id, q)
  for (const s of REVIEW_SEEDS) for (const q of s.questions) all.set(q.id, q)
  return all
}

const rows = (): [string, SeedTagSpec][] => Object.entries(SEED_TAGS)
const ofKind = (k: SeedTagSpec['kind']) => rows().filter(([, s]) => s.kind === k)

let lookup: TagLookup

beforeAll(async () => {
  lookup = await tagLookupFor(rows().map(([, s]) => s.subject))
})

describe('seed tags: coverage', () => {
  it('every seed question has a row and every row belongs to a seed question', () => {
    const ids = [...seedQuestions().keys()].sort()
    expect(Object.keys(SEED_TAGS).sort()).toEqual(ids)
  })

  it('the review seeds are the same question objects the table was applied to', () => {
    for (const s of REVIEW_SEEDS)
      for (const q of s.questions) expect(q.curriculum).toEqual(tagOfSpec(SEED_TAGS[q.id]!))
  })

  it('each seed question carries the tag of its row (subject kept, TP 1 to 6 as authored)', () => {
    for (const [id, q] of seedQuestions()) {
      const spec = SEED_TAGS[id]!
      expect(q.curriculum).toEqual(tagOfSpec(spec))
      expect(q.curriculum.subject).toBe(spec.subject)
      expect(Number.isInteger(spec.tp) && spec.tp >= 1 && spec.tp <= 6).toBe(true)
      expect(q.curriculum.kbat).toBeNull()
    }
  })

  it('every row names its old unit label', () => {
    for (const [, s] of rows()) expect(s.label.trim()).not.toBe('')
  })
})

describe('seed tags: tagged rows', () => {
  it('have evidence and pass the tag rule against the real catalogue', () => {
    for (const [id, s] of ofKind('tagged')) {
      if (s.kind !== 'tagged') continue
      expect(s.evidence.trim().length, id).toBeGreaterThan(20)
      expect(tagIssues(tagOfSpec(s), lookup), id).toEqual([])
    }
  })

  it('every unit and SP key exists in the catalogue, in the same subject, tingkatan and unit', () => {
    for (const [id, s] of ofKind('tagged')) {
      if (s.kind !== 'tagged') continue
      const unit = lookup.unit(s.unitId)
      expect(unit, id).toBeDefined()
      expect(unit!.subject).toBe(s.subject)
      expect(unit!.tingkatan).toBe(s.formOrigin)
      expect(s.spIds.length).toBeGreaterThan(0)
      for (const sp of s.spIds) {
        expect(lookup.sp(sp), `${id} ${sp}`).toMatchObject({ unitId: s.unitId, selectable: true })
      }
    }
  })

  it('are stamped with the catalogue version', () => {
    for (const [, s] of ofKind('tagged'))
      expect(tagOfSpec(s).catalogueVersion).toBe(dskpSource().version)
  })
})

describe('seed tags: flagged rows', () => {
  it('have a note, the review marker and no tingkatan, unit or SP; the tag rule refuses them', () => {
    for (const [id, s] of ofKind('flagged')) {
      if (s.kind !== 'flagged') continue
      expect(s.note.trim().length, id).toBeGreaterThan(20)
      const tag = tagOfSpec(s)
      expect(tag).toMatchObject({
        formOrigin: null,
        unitId: null,
        spIds: [],
        review: 'perlu-semakan',
      })
      expect(tagIssues(tag, lookup).length, id).toBeGreaterThan(0)
    }
  })
})

describe('seed tags: Tingkatan 1-3 rows', () => {
  it('have no unit and no SP and pass the tag rule with their TP', () => {
    for (const [id, s] of ofKind('t1t3')) {
      const tag = tagOfSpec(s)
      expect(tag, id).toMatchObject({ formOrigin: 'T1-T3', unitId: null, spIds: [] })
      expect(tag.review).toBeUndefined()
      expect(tagIssues(tag, lookup), id).toEqual([])
    }
  })
})

describe('seed tags: outcome (computed, printed for the architecture doc 6.3)', () => {
  it('splits every seed question into exactly one of T1-T3, tagged and flagged', () => {
    const all = rows()
    const count = (kind: SeedTagSpec['kind'], subject?: string) =>
      all.filter(([, s]) => s.kind === kind && (!subject || s.subject === subject)).length
    expect(count('t1t3') + count('tagged') + count('flagged')).toBe(seedQuestions().size)

    const subjects = [...new Set(all.map(([, s]) => s.subject))].sort()
    const lines = [
      '',
      'SEED TAG OUTCOME',
      `total ${all.length} | T1-T3 ${count('t1t3')} | tagged ${count('tagged')} | flagged ${count('flagged')}`,
      ...subjects.map(
        (sub) =>
          `${sub}: total ${all.filter(([, s]) => s.subject === sub).length} | T1-T3 ${count('t1t3', sub)} | tagged ${count('tagged', sub)} | flagged ${count('flagged', sub)}`,
      ),
      '',
      'PER LABEL (subject | old label | result | count | tagged SP or reason)',
    ]
    const groups = new Map<string, { n: number; what: string }>()
    for (const [, s] of all) {
      const result = s.kind === 'tagged' ? 'tagged' : s.kind === 'flagged' ? 'flagged' : 'T1-T3'
      const what = s.kind === 'tagged' ? s.spIds.join(', ') : s.kind === 'flagged' ? s.note : ''
      const key = `${s.subject} | ${s.label} | ${result} | ${what}`
      const g = groups.get(key) ?? { n: 0, what }
      g.n++
      groups.set(key, g)
    }
    for (const [key, g] of [...groups].sort()) lines.push(`${key} | ${g.n}`)

    console.info(lines.join('\n'))
    expect(count('tagged')).toBeGreaterThan(0)
  })
})

describe('seed tags: what a student sees', () => {
  it('the result topic of a tagged seed is the real unit title, a flagged one is empty (the admin copy never reaches a student), T1-T3 keeps its copy', async () => {
    const server = new BijakServer({ storage: new MemoryStorage() })
    const { attemptId } = await server.startAttempt(1, 'sn-k2-2025-a', 'exam')
    const view = await server.getAttemptView(1, attemptId)
    const topicOf = (id: string) => view.questions.find((q) => q.id === id)?.topic
    expect(topicOf('sn2-laju-v1')).toBe('Force and Motion')
    expect(topicOf('sn2-sel-q1')).toBe('')

    const mat = await server.startAttempt(1, 'mat-k2-2025-a', 'exam')
    const matView = await server.getAttemptView(1, mat.attemptId)
    expect(matView.questions.find((q) => q.id === 'mat2-kuadratik-v1')?.topic).toBe(
      'Fungsi dan Persamaan Kuadratik dalam Satu Pemboleh Ubah',
    )
    expect(matView.questions.find((q) => q.id === 'mat2-diskaun-v1')?.topic).toBe(T1_T3_TOPIC)
  })
})

describe('seed tags: a catalogue that fails to load', () => {
  afterEach(() => {
    setDskpCatalogForTests()
    vi.restoreAllMocks()
  })

  it('does not break a student attempt: the topic is empty and a warning is logged', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    setDskpCatalogForTests(
      createDskpCatalog(
        { SN: () => Promise.reject(new Error('network down')) },
        { version: 'dskp-fixture', subjects: [dskpCatalog.subject('SN') as DskpSubjectInfo] },
      ),
    )
    const server = new BijakServer({ storage: new MemoryStorage() })
    const { attemptId } = await server.startAttempt(1, 'sn-k2-2025-a', 'exam')
    const view = await server.getAttemptView(1, attemptId)
    expect(view.questions.length).toBeGreaterThan(0)
    expect(view.questions.find((q) => q.id === 'sn2-laju-v1')?.topic).toBe('')
    expect(warn).toHaveBeenCalled()
  })
})

describe('seed tags: applySeedTags refuses a bad seed', () => {
  const question = (id: string, subject: string): QuestionDef => ({
    id,
    curriculum: untagged(subject),
    stem: 'x',
  })

  it('a seed question without a row stops the load', () => {
    expect(() => applySeedTags([question('no-such-seed', 'MAT')])).toThrow(
      /no tag row for seed question "no-such-seed"/,
    )
  })

  it('a row of another subject than the question stops the load', () => {
    expect(() => applySeedTags([question('mat1-set-v1', 'SN')])).toThrow(
      /the row for "mat1-set-v1" is MAT, the question is SN/,
    )
  })
})
