import { BijakPaperSummarySchema, envelopeOf, type BijakPaperSummary } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { bootPapersApp, loginAs, type Client, type PapersTestApp } from './helpers'

/**
 * S3-T06 (API-BIJAK-01/04, DM-23): `GET /api/bijak/papers?surface=` . The default `simulasi` keeps the Bijak hub as it was;
 * `subjektif` lists the published Kertas Subjektif papers with Negeri, the typed Jumlah Markah and the code `K{kertas}`.
 */
describe('Bijak papers list by surface (S3-T06)', () => {
  let t: PapersTestApp
  let student: Client

  beforeAll(async () => {
    t = await bootPapersApp()
    student = await loginAs(t, 'pelajar@demo.test')
    // One seeded curated paper becomes a published Kertas Subjektif paper without a code and without a Tempoh.
    await t.db.query(
      `update papers set surface = 'subjektif', exam_board = 'selangor', paper_code = null, total_marks = 40,
         duration_minutes = null, printed_duration_min = 0 where paper_code = '4541/2' and kind = 'pilihan'`,
    )
  })
  afterAll(async () => {
    await t.close()
  })

  const list = async (query = ''): Promise<BijakPaperSummary[]> => {
    const res = await student.get(`/api/bijak/papers${query}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return envelopeOf(z.array(BijakPaperSummarySchema)).parse(res.body).data
  }

  it('the default (and surface=simulasi) leaves the subjektif paper out and adds no new key', async () => {
    const plain = await list()
    expect(plain.map((p) => p.code)).toEqual(['1449/1', '1449/2', '1249/2'])
    expect(plain.every((p) => p.surface === undefined && p.examBoard === undefined)).toBe(true)
    expect(await list('?surface=simulasi')).toEqual(plain)
  })

  it('surface=subjektif lists only the Kertas Subjektif paper, with K{kertas}, Negeri and the typed Jumlah Markah', async () => {
    const rows = await list('?surface=subjektif')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ code: 'K2', kertas: 2, surface: 'subjektif', examBoard: 'selangor', marks: 40, durationMin: 0 })
  })

  it('a draft Kertas Subjektif paper is not listed', async () => {
    await t.db.query(`update papers set status = 'draft' where surface = 'subjektif'`)
    expect(await list('?surface=subjektif')).toEqual([])
    await t.db.query(`update papers set status = 'published' where surface = 'subjektif'`)
  })

  it('an unknown surface is 422', async () => {
    const res = await student.get('/api/bijak/papers?surface=dokumen')
    expect(res.status).toBe(422)
  })
})
