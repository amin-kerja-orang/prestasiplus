import {
  BIJAK_PAPERS_MESSAGES,
  BijakBuilderPaperCreateResultSchema,
  BijakBuilderPoolUnitSchema,
  BijakPoolPreviewSchema,
  envelopeOf,
  listEnvelopeOf,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { BijakPoolSource } from '../../src/modules/bijak/papers'
import type { LeafFact, QuestionFacts } from '../../src/modules/bijak/papers/exam-core.adapter'
import type { BijakPoolScope } from '../../src/modules/bijak/papers/ports'
import { FakeBank, matBank } from './fakes'
import { ACCOUNTS, bootBuilderApp, expectError, loginAs, type BuilderTestApp, type Client } from './helpers'

/**
 * T53 (A4): two partial acceptance criteria of the R1 matrix (docs/qa/r1-backend-ac-coverage.md), proven on the API.
 *
 * - PIPE AC-08.4 (V2 basis: docs/requirements/v2-admin-student-pipeline.md US-08): "an SPM activity with zero eligible
 *   questions: the student sees the empty text and the admin sees the shortfall by subject/kertas". The student empty text is
 *   front end; the API part is the refusal (Jana Kertas SHORTAGE) and, for the admin, `Pratonton kolam` per subject x kertas.
 * - AC-R1-21.6 (P6, DISC 3.4): the Pembina Set bank search shows "Menunjukkan 150 teratas - tapis lagi untuk menyempitkan.".
 *   The cap is a front-end window, so the API part is that the candidate pool pages in blocks of at most 100, the first 150
 *   rows are reachable in two pages, the total says when to narrow, the search narrows it and a miss is an empty list
 *   ("Tiada soalan sepadan.").
 */

vi.setConfig({ testTimeout: 120_000 })

const Created = envelopeOf(BijakBuilderPaperCreateResultSchema)
const Pool = listEnvelopeOf(BijakBuilderPoolUnitSchema)
const Preview = envelopeOf(BijakPoolPreviewSchema)

/** Pool facts of the fake bank (what `bijak-pool.ts` returns in production). `ids` is the set of candidates. */
class SwitchPool implements BijakPoolSource {
  ids = new Set<string>()
  async candidates(_scope: BijakPoolScope): Promise<QuestionFacts[]> {
    void _scope
    return [...this.ids].map((id) => {
      const leaf: LeafFact = { marks: 1, mode: 'mcq', tp: 2, kbat: false, hasKey: true, unit: { nodeId: '9001', level: 'T4', code: '1.0' } }
      return {
        id,
        groupId: null,
        groupPosition: null,
        versionNo: 1,
        tagReview: false,
        unit: { nodeId: '9001', level: 'T4' as const, code: '1.0' },
        formOrigin: 't4' as const,
        pools: [],
        leaves: [leaf],
      }
    })
  }
  async seen(): Promise<ReadonlySet<string>> {
    return new Set()
  }
}

/** 170 candidates: 710000 to 710169, preview text "Soalan 710xxx v1". */
const BIG = Array.from({ length: 170 }, (_, i) => String(710000 + i))

describe('T53 shortfall by subject and kertas (AC-08.4) and the candidate window (AC-R1-21.6)', () => {
  let t: BuilderTestApp
  let bank: FakeBank
  let pool: SwitchPool
  let admin: Client

  beforeAll(async () => {
    bank = matBank()
    for (const id of BIG) bank.add({ id, marks: 1 })
    pool = new SwitchPool()
    t = await bootBuilderApp({ builderSource: bank, papersSource: bank })
    t.papersPorts.providePoolSource(pool)
    admin = await loginAs(t, ACCOUNTS.admin)
  })
  afterAll(async () => {
    await t.close()
  })

  describe('AC-08.4: zero eligible questions', () => {
    it('Pratonton kolam names the shortfall of each subject x kertas: nothing reachable, every section short, a first failure', async () => {
      pool.ids = new Set()
      for (const kertas of [1, 2]) {
        const res = await admin.get(`/api/admin/papers/pool-preview?subject=MAT&kertas=${String(kertas)}`)
        expect(res.status, JSON.stringify(res.body)).toBe(200)
        const preview = Preview.parse(res.body).data
        expect(preview.verdict, `MAT kertas ${String(kertas)}`).toBe('tidak_boleh')
        expect(preview.publishedTotal).toBe(0)
        expect(preview.eligibleTotal).toBe(0)
        expect(preview.firstFailure).toMatchObject({ have: 0 })
        expect(preview.firstFailure!.need).toBeGreaterThan(0)
        expect(preview.sections.length).toBeGreaterThan(0)
        for (const s of preview.sections) {
          expect(s.eligible).toBe(0)
          expect(s.counts.short).toBeGreaterThan(0)
        }
      }
    })

    it('the shortfall follows the pool of the subject x kertas; one without a contract is a 404, never an invented shortfall', async () => {
      pool.ids = new Set()
      const empty = Preview.parse((await admin.get('/api/admin/papers/pool-preview?subject=MAT&kertas=2')).body).data
      expect(empty.publishedTotal).toBe(0)
      pool.ids = new Set(BIG)
      const filled = Preview.parse((await admin.get('/api/admin/papers/pool-preview?subject=MAT&kertas=2')).body).data
      expect(filled.publishedTotal).toBe(170)
      // the counts come from the pool the generator reads, so they move with it (publishedTotal 0 -> 170)
      expect(empty.firstFailure).not.toBeNull()
      // a subject x kertas with no contract is not guessed: it is a 404, not an invented shortfall
      expectError(await admin.get('/api/admin/papers/pool-preview?subject=MAT&kertas=9'), 'NOT_FOUND', 404)
    })

    it('Jana set on an empty pool is refused with the BM shortage message and the sections that are short; no paper is stored', async () => {
      // the pupil Jana Kertas needs a Disahkan contract (AC-R1-15.3), so the shortage is read here through the admin Jana set,
      // which runs the same generator on the Spec contract of the launch seed
      pool.ids = new Set()
      const before = Number((await t.db.query<{ n: string }>(`select count(*) n from papers`))[0]!.n)
      const err = expectError(await admin.post('/api/admin/papers/generate', { subject: 'MAT', kertas: 2 }), 'SHORTAGE', 422, BIJAK_PAPERS_MESSAGES.shortage)
      const shortages = (err.details as { shortages: { section: string; need: number; have: number }[] }).shortages
      expect(shortages.length).toBeGreaterThan(0)
      expect(shortages[0]).toMatchObject({ have: 0 })
      expect(Number((await t.db.query<{ n: string }>(`select count(*) n from papers`))[0]!.n)).toBe(before)
    })
  })

  describe('AC-R1-21.6: the bank search window', () => {
    async function sectionOf(): Promise<{ paperId: string; sectionId: string }> {
      const res = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const paperId = Created.parse(res.body).data.id
      const editor = await admin.get(`/api/admin/papers/${paperId}`)
      expect(editor.status, JSON.stringify(editor.body)).toBe(200)
      return { paperId, sectionId: (editor.body.data as { paper: { sections: { id: string }[] } }).paper.sections[0]!.id }
    }
    const get = (c: Client, ids: { paperId: string; sectionId: string }, query: string) =>
      c.get(`/api/admin/papers/${ids.paperId}/sections/${ids.sectionId}/pool${query}`)

    it('pages in blocks of at most 100: the first 150 rows are two pages, the total says there are more, a block above 100 is 422', async () => {
      pool.ids = new Set(BIG)
      const ids = await sectionOf()
      const one = Pool.parse((await get(admin, ids, '?pageSize=100&page=1')).body)
      const two = Pool.parse((await get(admin, ids, '?pageSize=100&page=2')).body)
      expect(one.data).toHaveLength(100)
      expect(two.data).toHaveLength(70)
      expect(one.meta).toMatchObject({ page: 1, pageSize: 100, totalItems: 170, totalPages: 2 })
      expect(two.meta).toMatchObject({ page: 2, pageSize: 100, totalItems: 170 })
      // the window of the screen (the 150 first rows) is a prefix of the pages: no row is repeated across them
      const all = [...one.data, ...two.data].map((u) => u.questionIds.join(','))
      expect(new Set(all).size).toBe(170)
      expect(all.slice(0, 150)).toHaveLength(150)
      // more rows than the window: the screen shows the "narrow it" line, decided from this total
      expect(one.meta.totalItems).toBeGreaterThan(150)
      expectError(await get(admin, ids, '?pageSize=101'), 'VALIDATION_ERROR', 422)
    })

    it('the text search (Cari soalan) narrows the total below the window; a miss is an empty list with total 0 (Tiada soalan sepadan)', async () => {
      pool.ids = new Set(BIG)
      const ids = await sectionOf()
      // "Soalan 7101" matches 710100 to 710169 (70 rows)
      const narrowed = Pool.parse((await get(admin, ids, `?q=${encodeURIComponent('Soalan 7101')}&pageSize=100`)).body)
      expect(narrowed.meta.totalItems).toBe(70)
      expect(narrowed.data).toHaveLength(70)
      expect(narrowed.data.every((u) => u.questionIds.every((id) => id.startsWith('7101')))).toBe(true)
      expect(narrowed.meta.totalItems).toBeLessThanOrEqual(150)
      // search is case-insensitive
      expect(Pool.parse((await get(admin, ids, `?q=${encodeURIComponent('SOALAN 7101')}&pageSize=100`)).body).meta.totalItems).toBe(70)
      const miss = Pool.parse((await get(admin, ids, `?q=${encodeURIComponent('tiada padanan xyz')}`)).body)
      expect(miss.data).toEqual([])
      expect(miss.meta.totalItems).toBe(0)
    })
  })
})
