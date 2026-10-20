import type { Scenario } from '@pp/contract-tests'

import { makePng } from '../../files/fixtures'
import { API_ONLY, dataOf, expectError, listOf } from '../helpers'

const article = (over: Record<string, unknown> = {}) => ({
  title: 'Artikel conformance',
  content: '<p>Isi</p>',
  category: 'UMUM',
  isPublished: true,
  ...over,
})

/**
 * Content part A (BE-24): articles, banners, notes and screenshots. Every response is checked against the
 * contract by the runner. API target only (cookie session with CSRF, a file part).
 */
export const articleScenarios: Scenario[] = [
  {
    id: 'content-articles-api/a draft never reaches the public; the sanitiser strips script and onerror',
    domain: 'content',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const dirty = '<p>Isi</p><script>alert(1)</script><img src="https://e.test/a.png" onerror="alert(2)">'
      const draft = await admin.request('POST', '/admin/articles', { body: article({ title: 'Draf conformance', isPublished: false, content: dirty }) })
      ctx.expectStatus(draft, 201)
      const published = await admin.request('POST', '/admin/articles', { body: article({ title: 'Terbit conformance', content: dirty }) })
      ctx.expectStatus(published, 201)
      for (const created of [draft, published]) {
        const content = String(dataOf(created).content)
        ctx.check(!/<script|onerror/i.test(content), 'the returned body still has script or onerror')
      }
      const anon = ctx.anonymous()
      const list = await anon.request('GET', '/articles?search=conformance')
      ctx.expectStatus(list, 200)
      ctx.check(listOf(list).some((a) => a.slug === dataOf(published).slug), 'the published article is not listed')
      ctx.check(!listOf(list).some((a) => a.slug === dataOf(draft).slug), 'a draft is listed to the public')
      expectError(ctx, await anon.request('GET', `/articles/${String(dataOf(draft).slug)}`), 404, 'NOT_FOUND')
      const page = await anon.request('GET', `/articles/${String(dataOf(published).slug)}`)
      ctx.expectStatus(page, 200)
      ctx.check(!/<script|onerror/i.test(String(dataOf(page).content)), 'the public body still has script or onerror')
      for (const id of [dataOf(draft).id, dataOf(published).id]) ctx.expectStatus(await admin.request('DELETE', `/admin/articles/${String(id)}`), 200)
    },
  },
  {
    id: 'content-articles-api/admin routes: 401, 403 and CSRF',
    domain: 'content',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      for (const path of ['/admin/articles', '/admin/banners', '/admin/notes', '/admin/screenshots']) {
        expectError(ctx, await anon.request('GET', path), 401, 'UNAUTHORIZED')
        expectError(ctx, await (await ctx.as('student')).request('GET', path), 403, 'FORBIDDEN')
        expectError(ctx, await (await ctx.as('teacher')).request('GET', path), 403, 'FORBIDDEN')
      }
      expectError(ctx, await anon.request('GET', '/banners/active'), 401, 'UNAUTHORIZED')
      const noCsrf = await ctx.as('admin', { csrf: false })
      expectError(ctx, await noCsrf.request('POST', '/admin/articles', { body: article() }), 403, 'CSRF_INVALID')
    },
  },
  {
    id: 'content-articles-api/banners: the window and the audience decide who sees one',
    domain: 'content',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const base = { bannerType: 'HERO', description: 'conformance' }
      const make = async (title: string, over: Record<string, unknown>) => {
        const res = await admin.request('POST', '/admin/banners', { body: { title, ...base, ...over } })
        ctx.expectStatus(res, 201)
        return String(dataOf(res).id)
      }
      const ids = [
        await make('Banner pelajar conformance', { targetAudience: 'STUDENT' }),
        await make('Banner guru conformance', { targetAudience: 'TEACHER' }),
        await make('Banner tamat conformance', { endDate: '2020-01-01' }),
        await make('Banner tidak aktif conformance', { isActive: false }),
      ]
      const titles = async (as: 'student' | 'teacher') => {
        const res = await (await ctx.as(as)).request('GET', '/banners/active')
        ctx.expectStatus(res, 200)
        return listOf(res).map((b) => String(b.title))
      }
      const student = await titles('student')
      ctx.check(student.includes('Banner pelajar conformance') && !student.includes('Banner guru conformance'), 'a student sees the wrong audience')
      ctx.check(!student.includes('Banner tamat conformance') && !student.includes('Banner tidak aktif conformance'), 'an ended or inactive banner is delivered')
      const teacher = await titles('teacher')
      ctx.check(teacher.includes('Banner guru conformance') && !teacher.includes('Banner pelajar conformance'), 'a teacher sees the wrong audience')
      for (const id of ids) ctx.expectStatus(await admin.request('DELETE', `/admin/banners/${id}`), 200)
    },
  },
  {
    id: 'content-articles-api/notes: create, sanitise, update and delete',
    domain: 'content',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const created = await admin.request('POST', '/admin/notes', {
        body: { title: 'Nota conformance', content: '<p>Isi</p><script>alert(1)</script>', subject: 'sains', noteType: 'RINGKASAN', grade: 'DARJAH_3' },
      })
      ctx.expectStatus(created, 201)
      ctx.check(!/<script/i.test(String(dataOf(created).content)), 'the note body keeps a script')
      const id = String(dataOf(created).id)
      const updated = await admin.request('PUT', `/admin/notes/${id}`, { body: { title: 'Nota conformance 2' } })
      ctx.expectStatus(updated, 200)
      ctx.check(dataOf(updated).subject === 'sains', 'an absent field was not kept')
      ctx.expectStatus(await admin.request('DELETE', `/admin/notes/${id}`), 200)
      expectError(ctx, await admin.request('GET', `/admin/notes/${id}`), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'content-articles-api/screenshots: an image is stored through BE-04, a document is rejected',
    domain: 'content',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const png = new Uint8Array(makePng())
      const upload = (filename: string, contentType: string, content: Uint8Array) =>
        admin.request('POST', '/admin/screenshots', { file: { field: 'files[]', filename, contentType, content } })
      const ok = await upload('Skrin Conformance.png', 'image/png', png)
      ctx.expectStatus(ok, 201)
      const saved = (dataOf(ok) as { saved?: Array<{ fileName?: string }> }).saved
      ctx.check(saved?.[0]?.fileName === 'skrin-conformance.png', 'the stored name is not the sanitised name')
      const refused = await upload('dokumen.pdf', 'application/pdf', new TextEncoder().encode('%PDF-1.4'))
      expectError(ctx, refused, 422, 'VALIDATION_ERROR')
      ctx.expectStatus(await admin.request('GET', '/admin/screenshots'), 200)
    },
  },
]
