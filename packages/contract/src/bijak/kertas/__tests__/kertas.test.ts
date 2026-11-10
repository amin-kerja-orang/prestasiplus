import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../../openapi'
import {
  KERTAS_DOKUMEN_MESSAGES,
  KertasDokumenAdminListSchema,
  KertasDokumenAdminQuerySchema,
  KertasDokumenSchema,
  KertasDokumenSummarySchema,
  KertasDokumenToggleResultSchema,
} from '../schema'

const summary = {
  id: '12',
  title: 'Sejarah Kertas 2 Percubaan',
  subject: 'SEJ',
  subjectName: 'Sejarah',
  kertas: 2,
  negeri: 'Johor',
  year: 2024,
  pageCount: 4,
  schemePageCount: 2,
  marks: 100,
  durationMinutes: 150,
}
const page = { position: 1, url: '/api/files/Zk3Qx9vB2mLw7TnRa1YpUg', width: 794, height: 1123 }

describe('Kertas Subjektif documents contract (0265)', () => {
  it('parses the pupil summary and the view, and a summary may carry no subject, negeri, year or marks (V2 allows it)', () => {
    expect(KertasDokumenSummarySchema.parse(summary)).toEqual(summary)
    const bare = { ...summary, subject: null, subjectName: null, negeri: null, year: null, marks: null, durationMinutes: null }
    expect(KertasDokumenSummarySchema.parse(bare)).toEqual(bare)
    expect(KertasDokumenSchema.parse({ ...summary, paperPages: [page], schemePages: [] }).paperPages).toHaveLength(1)
  })

  it('is strict: a path, a source file or a storage key can never ride along on a response', () => {
    for (const extra of [{ sourceFile: 'x.pdf' }, { path: 'paper-docs/a.jpg' }, { storageKey: 'k' }]) {
      expect(KertasDokumenSummarySchema.safeParse({ ...summary, ...extra }).success).toBe(false)
    }
    expect(KertasDokumenSchema.safeParse({ ...summary, paperPages: [{ ...page, path: 'p' }], schemePages: [] }).success).toBe(false)
  })

  it('only Kertas 2 to 4 exist', () => {
    for (const kertas of [1, 5, 2.5]) expect(KertasDokumenSummarySchema.safeParse({ ...summary, kertas }).success).toBe(false)
  })

  it('admin query: defaults to page 1 of 30 (V2), coerces numbers, rejects a bad kertas, status or unknown key', () => {
    expect(KertasDokumenAdminQuerySchema.parse({})).toEqual({ page: 1, pageSize: 30 })
    expect(KertasDokumenAdminQuerySchema.parse({ kertas: '3', status: 'terbit', subject: 'MAT', page: '2' })).toEqual({ kertas: 3, status: 'terbit', subject: 'MAT', page: 2, pageSize: 30 })
    for (const bad of [{ kertas: '1' }, { kertas: '5' }, { status: 'published' }, { pageSize: '1000' }, { unknown: '1' }]) {
      expect(KertasDokumenAdminQuerySchema.safeParse(bad).success).toBe(false)
    }
  })

  it('the admin list carries the three tiles and the toggle answers the new state', () => {
    const list = { rows: [{ ...summary, status: 'draf' }], total: 1, counts: { total: 254, published: 200, withScheme: 180 } }
    expect(KertasDokumenAdminListSchema.parse(list).counts.total).toBe(254)
    expect(KertasDokumenToggleResultSchema.parse({ id: '12', title: 't', status: 'terbit' }).status).toBe('terbit')
    expect(KertasDokumenToggleResultSchema.safeParse({ id: '12', title: 't', status: 'published' }).success).toBe(false)
  })

  it('keeps the V2 copy', () => {
    expect(KERTAS_DOKUMEN_MESSAGES.published.replace('{title}', 'A')).toBe('“A” kini diterbitkan.')
    expect(KERTAS_DOKUMEN_MESSAGES.hidden.replace('{title}', 'A')).toBe('“A” disembunyikan daripada pelajar.')
    expect(KERTAS_DOKUMEN_MESSAGES.noPages.replace('{title}', 'A')).toBe('“A” tiada halaman — tidak boleh diterbitkan.')
  })

  it('registers the five routes in the OpenAPI document', () => {
    const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, unknown>> }
    expect(Object.keys(doc.paths).filter((p) => p.includes('kertas-dokumen')).sort()).toEqual([
      '/admin/kertas-dokumen',
      '/admin/kertas-dokumen/{id}',
      '/admin/kertas-dokumen/{id}/terbit',
      '/bijak/kertas-dokumen',
      '/bijak/kertas-dokumen/{id}',
    ])
    expect(doc.paths['/admin/kertas-dokumen/{id}/terbit']).toHaveProperty('post')
  })
})
