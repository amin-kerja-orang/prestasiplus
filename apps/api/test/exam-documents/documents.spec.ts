import { randomBytes } from 'node:crypto'

import {
  KertasDokumenAdminDetailSchema,
  KertasDokumenAdminListSchema,
  KertasDokumenSchema,
  KertasDokumenSummarySchema,
  KertasDokumenToggleResultSchema,
  envelopeOf,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { LocalDiskStorage } from '../../src/modules/files/local-disk.storage'
import { makePng } from '../files/fixtures'
import { bootFullApp, loginFull, type FullApp, type FullClient } from '../r1/full-app'
import { ACCOUNTS, auditRows } from '../exam-builder/helpers'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 300_000 })

/**
 * Kertas Subjektif page-image documents (V2 parity, migration 0265): the pupil list and view, the admin list, preview and Terbit/Sembunyi
 * toggle, and the page-image read rule of `GET /files/{token}` (admin always; a pupil only while the document is published).
 */
describe('Kertas Subjektif documents (0265)', () => {
  let t: FullApp
  let admin: FullClient
  let student: FullClient
  let teacher: FullClient
  let storage: LocalDiskStorage
  let mathId: string
  let sainsId: string
  const docs: Record<string, string> = {}
  const pageTokens: Record<string, string> = {}

  const q = <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) => t.db.query<T>(sql, params)

  async function file(label: string): Promise<{ id: string; token: string }> {
    const bytes = makePng({ width: 3, height: 3, padTo: 400 + label.length })
    const token = randomBytes(16).toString('base64url')
    const key = `kertas-page/${randomBytes(12).toString('hex')}.png`
    await storage.put(key, bytes)
    const row = await q<{ id: string }>(
      `insert into files (public_id, purpose, mime, size_bytes, sha256, storage_key) values ($1, 'kertas_page', 'image/png', $2, $3, $4) returning id::text id`,
      [token, bytes.length, randomBytes(32).toString('hex'), key],
    )
    return { id: row[0]!.id, token }
  }

  async function doc(
    name: string,
    o: { subject?: string | null; kertas?: number; negeri?: string | null; published?: boolean; paper?: number; scheme?: number; marks?: number | null; minutes?: number | null },
  ): Promise<string> {
    const paper = o.paper ?? 2
    const scheme = o.scheme ?? 1
    const rows = await q<{ id: string }>(
      `insert into paper_documents (subject_id, kertas, title, negeri, year, duration_minutes, marks_total, page_count, scheme_page_count, published_at)
       values ($1, $2, $3, $4, 2024, $5, $6, $7, $8, $9) returning id::text id`,
      [o.subject === undefined ? mathId : o.subject, o.kertas ?? 2, name, o.negeri === undefined ? 'Selangor' : o.negeri, o.minutes ?? null, o.marks ?? null, paper, scheme, o.published ? new Date('2026-10-01T00:00:00Z') : null],
    )
    const id = rows[0]!.id
    for (const [kind, n] of [['paper', paper], ['scheme', scheme]] as const) {
      for (let p = 1; p <= n; p += 1) {
        const f = await file(`${name}-${kind}-${p}`)
        pageTokens[`${name}:${kind}:${p}`] = f.token
        await q(`insert into paper_document_pages (paper_document_id, kind, position, file_id, width, height) values ($1, $2, $3, $4, 3, 3)`, [id, kind, p, f.id])
      }
    }
    docs[name] = id
    return id
  }

  beforeAll(async () => {
    t = await bootFullApp()
    storage = new LocalDiskStorage(process.env.FILE_STORAGE_DIR as string)
    admin = await loginFull(t, ACCOUNTS.admin)
    student = await loginFull(t, ACCOUNTS.student)
    teacher = await loginFull(t, ACCOUNTS.teacher)
    mathId = String((await q(`select id::text id from subjects where code = 'MATH'`))[0]!.id)
    sainsId = String((await q(`select id::text id from subjects where code <> 'MATH' order by id limit 1`))[0]!.id)
    await doc('Matematik K2 Selangor', { kertas: 2, negeri: 'Selangor', published: true, marks: 100, minutes: 150 })
    await doc('Matematik K3 Johor', { kertas: 3, negeri: 'Johor', published: true, scheme: 0 })
    await doc('Sains K2 Kedah', { subject: sainsId, kertas: 2, negeri: 'Kedah', published: true })
    await doc('Tanpa Subjek K4', { subject: null, kertas: 4, negeri: null, published: true, scheme: 0 })
    await doc('Draf Matematik K2', { kertas: 2, negeri: 'Perak', published: false })
    await doc('Draf Tiada Halaman', { kertas: 2, negeri: 'Pahang', published: false, paper: 0, scheme: 0 })
  })
  afterAll(async () => {
    await t.close()
  })

  describe('pupil: GET /api/bijak/kertas-dokumen', () => {
    it('lists the published documents only, Kertas then Negeri, with the V2 card fields', async () => {
      const res = await student.get('/api/bijak/kertas-dokumen')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const rows = envelopeOf(z.array(KertasDokumenSummarySchema)).parse(res.body).data
      expect(rows.map((r) => r.title)).toEqual(['Sains K2 Kedah', 'Matematik K2 Selangor', 'Matematik K3 Johor', 'Tanpa Subjek K4'])
      const m = rows.find((r) => r.title === 'Matematik K2 Selangor')!
      expect(m).toMatchObject({ kertas: 2, negeri: 'Selangor', year: 2024, pageCount: 2, schemePageCount: 1, marks: 100, durationMinutes: 150, subject: 'MATH' })
      expect(rows.find((r) => r.title === 'Tanpa Subjek K4')).toMatchObject({ subject: null, subjectName: null, negeri: null })
    })

    it('is for the student role only: anonymous 401, teacher 403', async () => {
      expect((await teacher.get('/api/bijak/kertas-dokumen')).status).toBe(403)
      expect((await teacher.get(`/api/bijak/kertas-dokumen/${docs['Matematik K2 Selangor']}`)).status).toBe(403)
      const anon = await import('supertest').then((m) => m.default(t.app.getHttpServer()).get('/api/bijak/kertas-dokumen'))
      expect(anon.status).toBe(401)
    })
  })

  describe('pupil: GET /api/bijak/kertas-dokumen/:id', () => {
    it('serves a published document with its paper and scheme pages in order', async () => {
      const res = await student.get(`/api/bijak/kertas-dokumen/${docs['Matematik K2 Selangor']}`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const d = envelopeOf(KertasDokumenSchema).parse(res.body).data
      expect(d.paperPages.map((p) => p.position)).toEqual([1, 2])
      expect(d.schemePages.map((p) => p.position)).toEqual([1])
      expect(d.paperPages[0]!.url).toBe(`/api/files/${pageTokens['Matematik K2 Selangor:paper:1']}`)
      expect(JSON.stringify(d)).not.toMatch(/source_file|sourceFile|storage/i)
    })

    it('a document without a scheme has an empty scheme list', async () => {
      const d = envelopeOf(KertasDokumenSchema).parse((await student.get(`/api/bijak/kertas-dokumen/${docs['Matematik K3 Johor']}`)).body).data
      expect(d.schemePages).toEqual([])
    })

    it('a Draf, an unknown and a malformed id are all 404 (no leak)', async () => {
      for (const id of [docs['Draf Matematik K2'], '999999', 'abc', '1e3']) {
        const res = await student.get(`/api/bijak/kertas-dokumen/${id}`)
        expect(res.status, id).toBe(404)
        expect(res.body.error.message).toBe('Kertas tidak ditemui')
      }
    })
  })

  describe('admin: GET /api/admin/kertas-dokumen', () => {
    const list = async (qs = '') => {
      const res = await admin.get(`/api/admin/kertas-dokumen${qs}`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      return envelopeOf(KertasDokumenAdminListSchema).parse(res.body).data
    }

    it('lists every document with its status and the three tiles', async () => {
      const r = await list()
      expect(r.total).toBe(6)
      expect(r.counts).toEqual({ total: 6, published: 4, withScheme: 3 })
      expect(r.rows.find((x) => x.title === 'Draf Matematik K2')?.status).toBe('draf')
      expect(r.rows.find((x) => x.title === 'Sains K2 Kedah')?.status).toBe('terbit')
    })

    it('filters by subject, kertas and status; the tiles ignore the filters', async () => {
      expect((await list('?subject=MATH')).rows.map((x) => x.title).sort()).toEqual(['Draf Matematik K2', 'Draf Tiada Halaman', 'Matematik K2 Selangor', 'Matematik K3 Johor'])
      expect((await list('?kertas=3')).rows.map((x) => x.title)).toEqual(['Matematik K3 Johor'])
      const draft = await list('?status=draf')
      expect(draft.total).toBe(2)
      expect(draft.counts.total).toBe(6)
      expect((await list('?subject=NOPE')).rows).toEqual([])
    })

    it('pages the list', async () => {
      const first = await list('?pageSize=4&page=1')
      const second = await list('?pageSize=4&page=2')
      expect([first.rows.length, second.rows.length, first.total]).toEqual([4, 2, 6])
    })

    it('rejects a bad filter (422) and any non-admin role (403)', async () => {
      expect((await admin.get('/api/admin/kertas-dokumen?kertas=9')).status).toBe(422)
      expect((await student.get('/api/admin/kertas-dokumen')).status).toBe(403)
      expect((await teacher.get('/api/admin/kertas-dokumen')).status).toBe(403)
    })

    it('previews a Draf document (the Pratonton link) while the pupil view stays 404', async () => {
      const res = await admin.get(`/api/admin/kertas-dokumen/${docs['Draf Matematik K2']}`)
      expect(res.status).toBe(200)
      const d = envelopeOf(KertasDokumenAdminDetailSchema).parse(res.body).data
      expect(d.status).toBe('draf')
      expect(d.paperPages).toHaveLength(2)
      expect((await student.get(`/api/bijak/kertas-dokumen/${docs['Draf Matematik K2']}`)).status).toBe(404)
      expect((await admin.get('/api/admin/kertas-dokumen/999999')).status).toBe(404)
    })
  })

  describe('admin: POST /api/admin/kertas-dokumen/:id/terbit', () => {
    const toggle = (id: string) => admin.post(`/api/admin/kertas-dokumen/${id}/terbit`)

    it('publishes a Draf document that has pages, then hides it again, with an audit row each time', async () => {
      const id = docs['Draf Matematik K2']!
      const pub = await toggle(id)
      expect(pub.status, JSON.stringify(pub.body)).toBe(200)
      expect(envelopeOf(KertasDokumenToggleResultSchema).parse(pub.body).data).toMatchObject({ id, title: 'Draf Matematik K2', status: 'terbit' })
      expect((await student.get(`/api/bijak/kertas-dokumen/${id}`)).status).toBe(200)
      const hide = await toggle(id)
      expect(envelopeOf(KertasDokumenToggleResultSchema).parse(hide.body).data.status).toBe('draf')
      expect((await student.get(`/api/bijak/kertas-dokumen/${id}`)).status).toBe(404)
      const pubAudit = await auditRows(t.db, 'kertas_dokumen.published')
      const hideAudit = await auditRows(t.db, 'kertas_dokumen.hidden')
      expect(pubAudit.some((a) => a.target_id === id && a.target_type === 'kertas_dokumen')).toBe(true)
      expect(hideAudit.some((a) => a.target_id === id)).toBe(true)
    })

    it('refuses to publish a document with no page (V2 copy), and it stays Draf', async () => {
      const id = docs['Draf Tiada Halaman']!
      const res = await toggle(id)
      expect(res.status).toBe(422)
      expect(res.body.error.message).toBe('“Draf Tiada Halaman” tiada halaman — tidak boleh diterbitkan.')
      expect(String((await q(`select published_at from paper_documents where id = $1`, [id]))[0]!.published_at)).toBe('null')
    })

    it('needs the CSRF token, the admin role and a known id', async () => {
      const id = docs['Matematik K3 Johor']!
      expect((await admin.noCsrf('post', `/api/admin/kertas-dokumen/${id}/terbit`)).status).toBe(403)
      expect((await student.post(`/api/admin/kertas-dokumen/${id}/terbit`)).status).toBe(403)
      expect((await toggle('999999')).status).toBe(404)
      expect((await toggle('abc')).status).toBe(404)
      // unchanged by the refusals above
      expect(String((await q(`select published_at is not null as p from paper_documents where id = $1`, [id]))[0]!.p)).toBe('true')
    })
  })

  describe('page images: GET /api/files/{token} (purpose kertas_page)', () => {
    it('a pupil reads a page of a published document and gets 404 for a Draf one; admin reads both', async () => {
      const published = pageTokens['Sains K2 Kedah:paper:1']!
      const draft = pageTokens['Draf Tiada Halaman:paper:1'] ?? pageTokens['Draf Matematik K2:paper:1']!
      const ok = await student.get(`/api/files/${published}`)
      expect(ok.status).toBe(200)
      expect(ok.headers['content-type']).toMatch(/image\/png/)
      expect(ok.headers['x-content-type-options']).toBe('nosniff')
      expect((await student.get(`/api/files/${draft}`)).status).toBe(404)
      expect((await admin.get(`/api/files/${draft}`)).status).toBe(200)
      expect((await admin.get(`/api/files/${published}`)).status).toBe(200)
    })

    it('an anonymous caller never reads a page, and no role may upload the purpose', async () => {
      const anon = await import('supertest').then((m) => m.default(t.app.getHttpServer()).get(`/api/files/${pageTokens['Sains K2 Kedah:paper:1']}`))
      expect(anon.status).toBe(401)
      const up = await admin.post('/api/files?purpose=kertas_page')
      expect(up.status).toBe(403)
    })

    it('hiding a document stops its pages at once', async () => {
      const token = pageTokens['Matematik K3 Johor:paper:1']!
      expect((await student.get(`/api/files/${token}`)).status).toBe(200)
      await q(`update paper_documents set published_at = null where id = $1`, [docs['Matematik K3 Johor']])
      expect((await student.get(`/api/files/${token}`)).status).toBe(404)
    })
  })

  describe('schema', () => {
    it('rejects kertas outside 2..4 and a position below 1 (CHECK), and removes pages with their document', async () => {
      await expect(q(`insert into paper_documents (kertas, title) values (1, 'x')`)).rejects.toThrow(/ck_paper_documents_kertas/)
      const id = docs['Draf Tiada Halaman']!
      const f = await file('check')
      await expect(q(`insert into paper_document_pages (paper_document_id, kind, position, file_id) values ($1, 'paper', 0, $2)`, [id, f.id])).rejects.toThrow(/ck_paper_document_pages_position/)
      await expect(q(`insert into paper_document_pages (paper_document_id, kind, position, file_id) values ($1, 'cover', 1, $2)`, [id, f.id])).rejects.toThrow(/ck_paper_document_pages_kind/)
      const keep = docs['Sains K2 Kedah']!
      const before = Number((await q(`select count(*)::int n from paper_document_pages where paper_document_id = $1`, [keep]))[0]!.n)
      expect(before).toBeGreaterThan(0)
      await q(`delete from paper_documents where id = $1`, [keep])
      expect(Number((await q(`select count(*)::int n from paper_document_pages where paper_document_id = $1`, [keep]))[0]!.n)).toBe(0)
    })
  })
})
