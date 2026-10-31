import type { HttpResponse, Scenario, ScenarioContext } from '@pp/contract-tests'

import { API_ONLY, dataOf, errorOf, expectError, listOf } from '../helpers'

/**
 * Bijak paper builder and blueprint admin (BE-39) scenarios: blueprint lifecycle, paper lifecycle
 * (create, edit, preview, publish, withdraw, delete), a fully conforming paper that students see,
 * and roles/CSRF. Admin Pusat only. API target only. Every response is also checked against the
 * contract by the runner. Question data comes from the PoC source (reserved decimal question ids),
 * read from the editor of a created paper.
 */
type Json = Record<string, unknown>
type Client = Awaited<ReturnType<ScenarioContext['as']>>

const SEJ_SECTIONS = [
  { label: 'Bahagian A', markBudget: 2, questionCount: 2, rule: { type: 'all' }, pool: 'SEJ1-A' },
] as const

const blueprintBody = (code: string, source: 'Disahkan' | 'Spec' | 'Draf' = 'Spec'): Json => ({
  source,
  code,
  durationMin: 60,
  instructions: ['Jawab semua soalan.'],
  sections: SEJ_SECTIONS,
})

const arr = (value: unknown): Json[] => (Array.isArray(value) ? (value as Json[]) : [])

async function createPaper(ctx: ScenarioContext, admin: Client, subject: string, kertas: number, title?: string): Promise<string> {
  const res = await admin.request('POST', '/admin/papers', { body: title ? { subject, kertas, title } : { subject, kertas } })
  ctx.expectStatus(res, 201)
  return String(dataOf(res).id)
}

async function editorOf(ctx: ScenarioContext, admin: Client, id: string): Promise<Json> {
  const res = await admin.request('GET', `/admin/papers/${id}`)
  ctx.expectStatus(res, 200)
  return dataOf(res)
}

const sectionsOf = (editor: Json): Json[] => arr((editor.paper as Json).sections)

export const bijakBuilderScenarios: Scenario[] = [
  {
    id: 'bijak-builder-api/blueprints: list, get, create, duplicate 409, new version, retire, then 404 and 409',
    domain: 'bijak-builder',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const list = await admin.request('GET', '/admin/blueprints')
      ctx.expectStatus(list, 200)
      ctx.check(listOf(list).length >= 4, `expected the 4 seeded blueprints, got ${String(listOf(list).length)}`)
      const filtered = await admin.request('GET', '/admin/blueprints?subject=MAT&kertas=2')
      ctx.expectStatus(filtered, 200)
      ctx.check(listOf(filtered).length === 1 && listOf(filtered)[0]?.code === '1449/2', 'the subject and kertas filter must return only MAT kertas 2')

      const mat2 = await admin.request('GET', '/admin/blueprints/MAT/2')
      ctx.expectStatus(mat2, 200)
      ctx.check(dataOf(mat2).code === '1449/2' && arr(dataOf(mat2).sections).length === 3, 'MAT kertas 2 must have 3 sections')
      expectError(ctx, await admin.request('GET', '/admin/blueprints/MAT/0'), 404, 'NOT_FOUND')
      expectError(ctx, await admin.request('GET', '/admin/blueprints/ZZZ/1'), 404, 'NOT_FOUND')

      const created = await admin.request('POST', '/admin/blueprints', { body: { subject: 'SEJ', kertas: 1, ...blueprintBody('1249/1') } })
      ctx.expectStatus(created, 201)
      ctx.check(dataOf(created).subject === 'SEJ' && dataOf(created).kertas === 1 && dataOf(created).totalMarks === 2, 'the created view must echo SEJ kertas 1 with 2 marks')
      const dup = await admin.request('POST', '/admin/blueprints', { body: { subject: 'SEJ', kertas: 1, ...blueprintBody('1249/1') } })
      expectError(ctx, dup, 409, 'CONFLICT')
      expectError(ctx, await admin.request('POST', '/admin/blueprints', { body: { subject: 'NOPE', kertas: 1, ...blueprintBody('9999/1') } }), 422, 'VALIDATION_ERROR')
      expectError(ctx, await admin.request('POST', '/admin/blueprints', { body: { subject: 'SEJ', kertas: 1 } }), 422, 'VALIDATION_ERROR')

      const version = await admin.request('POST', '/admin/blueprints/SEJ/1/versions', {
        body: { ...blueprintBody('1249/1', 'Disahkan'), durationMin: 90 },
      })
      ctx.expectStatus(version, 201)
      ctx.check(dataOf(version).source === 'Disahkan' && dataOf(version).durationMin === 90, 'the new version view must carry the new content')
      const got = await admin.request('GET', '/admin/blueprints/SEJ/1')
      ctx.expectStatus(got, 200)
      ctx.check(dataOf(got).durationMin === 90, 'GET must show the latest version')
      expectError(ctx, await admin.request('POST', '/admin/blueprints/MAT/99/versions', { body: blueprintBody('1449/99') }), 404, 'NOT_FOUND')

      const retire = await admin.request('POST', '/admin/blueprints/SEJ/1/retire')
      ctx.expectStatus(retire, 200)
      ctx.check(dataOf(retire).ok === true, 'retire must answer { ok: true }')
      expectError(ctx, await admin.request('GET', '/admin/blueprints/SEJ/1'), 404, 'NOT_FOUND')
      expectError(ctx, await admin.request('POST', '/admin/blueprints/SEJ/1/versions', { body: blueprintBody('1249/1') }), 409, 'CONFLICT')
      expectError(ctx, await admin.request('POST', '/admin/blueprints/SEJ/1/retire'), 409, 'CONFLICT')
      expectError(ctx, await admin.request('POST', '/admin/blueprints/MAT/99/retire'), 404, 'NOT_FOUND')
      ctx.check(
        !listOf(await admin.request('GET', '/admin/blueprints?subject=SEJ&kertas=1')).length,
        'a retired blueprint must not be listed',
      )
    },
  },
  {
    id: 'bijak-builder-api/papers: create, editor, edit, preview, publish refusal, filter, withdraw, delete',
    domain: 'bijak-builder',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const id = await createPaper(ctx, admin, 'MAT', 2)
      const editor = await editorOf(ctx, admin, id)
      const paper = editor.paper as Json
      ctx.check(paper.status === 'draf' && paper.code === '1449/2', 'a new paper must be draf with the blueprint code')
      ctx.check(String(paper.title) === 'Percubaan SPM Matematik Kertas 2 (draf)', `default title differs: ${String(paper.title)}`)
      ctx.check(sectionsOf(editor).length === 3 && sectionsOf(editor).every((s) => arr(s.questionIds).length === 0), 'a new paper must have the 3 blueprint sections, empty')
      ctx.check(editor.blueprint !== null, 'the editor must carry the blueprint')
      const candidates = arr(editor.questions).filter((q) => q.kertas === 2)
      ctx.check(candidates.length >= 3, `expected kertas 2 candidates, got ${String(candidates.length)}`)

      // PUT: place candidates (3 in the first section), rename, change duration.
      const picked = candidates.slice(0, 3).map((q) => String(q.id))
      const firstSection = String(sectionsOf(editor)[0]?.id)
      const put = await admin.request('PUT', `/admin/papers/${id}`, {
        body: { title: '  Set uji pembina  ', durationMin: 120, sections: [{ id: firstSection, questionIds: picked }] },
      })
      ctx.expectStatus(put, 200)
      const after = dataOf(put).paper as Json
      ctx.check(after.title === 'Set uji pembina' && after.durationMin === 120, 'title is trimmed and duration applied')
      ctx.check(arr(after.sections)[0] !== undefined && (arr(after.sections)[0]?.questionIds as string[]).join() === picked.join(), 'the placed question ids must come back in order')
      expectError(ctx, await admin.request('PUT', `/admin/papers/${id}`, { body: { title: '   ' } }), 422, 'VALIDATION_ERROR')
      expectError(ctx, await admin.request('PUT', `/admin/papers/${id}`, { body: { sections: [{ id: '999999999', questionIds: [] }] } }), 422, 'VALIDATION_ERROR')
      expectError(ctx, await admin.request('PUT', `/admin/papers/${id}`, { body: { sections: [{ id: firstSection, questionIds: ['999999999'] }] } }), 422, 'VALIDATION_ERROR')
      expectError(ctx, await admin.request('PUT', `/admin/papers/${id}`, { body: { sections: [{ id: firstSection, questionIds: [picked[0], picked[0]] }] } }), 422, 'VALIDATION_ERROR')
      expectError(ctx, await admin.request('PUT', '/admin/papers/999999999', { body: { title: 'x' } }), 404, 'NOT_FOUND')
      expectError(ctx, await admin.request('GET', '/admin/papers/999999999'), 404, 'NOT_FOUND')

      // Preview: no-store, answer keys for admin only.
      const preview = await admin.request('POST', '/admin/papers/preview', { body: { ids: [...picked, '999999999'] } })
      ctx.expectStatus(preview, 200)
      ctx.check(preview.headers['cache-control']?.includes('no-store') === true, 'the preview must send Cache-Control: no-store')
      ctx.check(arr(dataOf(preview).questions).length === 3, 'the preview must leave out unknown ids')

      // Publish refuses a non-conforming paper and changes nothing.
      const refuse = await admin.request('POST', `/admin/papers/${id}/publish`)
      ctx.expectStatus(refuse, 200)
      ctx.check(dataOf(refuse).ok === false && Array.isArray(dataOf(refuse).errors) && (dataOf(refuse).errors as unknown[]).length > 0, 'publish of a non-conforming paper must answer ok false with errors')
      ctx.check(((await editorOf(ctx, admin, id)).paper as Json).status === 'draf', 'a refused publish must leave the paper draf')
      expectError(ctx, await admin.request('POST', '/admin/papers/999999999/publish'), 404, 'NOT_FOUND')
      expectError(ctx, await admin.request('POST', '/admin/papers/999999999/withdraw'), 404, 'NOT_FOUND')

      // List with filter.
      const all = await admin.request('GET', '/admin/papers')
      ctx.expectStatus(all, 200)
      const row = listOf(all).find((p) => p.id === id)
      ctx.check(row?.status === 'draf' && row?.ok === false && row?.questionCount === 3 && row?.subjectName === 'Matematik', 'the list row must summarise the draft')
      const drafts = listOf(await admin.request('GET', '/admin/papers?status=draf'))
      ctx.check(drafts.some((p) => p.id === id) && drafts.every((p) => p.status === 'draf'), 'status=draf must list only drafts, this one included')
      ctx.check(!listOf(await admin.request('GET', '/admin/papers?status=terbit')).some((p) => p.id === id), 'status=terbit must not list the draft')
      expectError(ctx, await admin.request('GET', '/admin/papers?status=nope'), 422, 'VALIDATION_ERROR')
      expectError(ctx, await admin.request('GET', '/admin/blueprints?page=0'), 422, 'VALIDATION_ERROR')

      // Withdraw of a draft is a no-op ok; creation errors.
      ctx.expectStatus(await admin.request('POST', `/admin/papers/${id}/withdraw`), 200)
      expectError(ctx, await admin.request('POST', '/admin/papers', { body: { subject: 'MAT', kertas: 77 } }), 422, 'VALIDATION_ERROR')
      expectError(ctx, await admin.request('POST', '/admin/papers', { body: { subject: 'MAT' } }), 422, 'VALIDATION_ERROR')

      // Delete, idempotent.
      const del = await admin.request('DELETE', `/admin/papers/${id}`)
      ctx.expectStatus(del, 200)
      ctx.check(dataOf(del).ok === true, 'delete must answer { ok: true }')
      expectError(ctx, await admin.request('GET', `/admin/papers/${id}`), 404, 'NOT_FOUND')
      const again = await admin.request('DELETE', `/admin/papers/${id}`)
      ctx.expectStatus(again, 200)
      ctx.expectStatus(await admin.request('DELETE', '/admin/papers/999999999'), 200)
    },
  },
  {
    id: 'bijak-builder-api/a conforming MAT kertas 1 paper publishes, students see it, withdraw hides it, a published paper is locked',
    domain: 'bijak-builder',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const student = await ctx.as('student')
      const id = await createPaper(ctx, admin, 'MAT', 1, 'Set uji lengkap')
      const editor = await editorOf(ctx, admin, id)
      const budget = Number(arr((editor.blueprint as Json).sections)[0]?.markBudget)
      const need = Number(arr((editor.blueprint as Json).sections)[0]?.questionCount)
      const questions = arr(editor.questions).filter((q) => q.kertas === 1 && q.kind === 'objektif' && q.status === 'approved')
      const groups = arr(editor.groups)

      // Whole stimulus groups first (kept consecutive), then single questions, until the section is full.
      const chosen: string[] = []
      const take = (qid: string) => {
        if (!chosen.includes(qid)) chosen.push(qid)
      }
      for (const g of groups) {
        const members = (g.questionIds as string[]).filter((m) => questions.some((q) => q.id === m))
        if (members.length === (g.questionIds as string[]).length && chosen.length + members.length <= need) members.forEach(take)
      }
      for (const q of questions) {
        if (chosen.length >= need) break
        if (q.groupId === undefined) take(String(q.id))
      }
      const marks = chosen.reduce((sum, qid) => sum + Number(questions.find((q) => q.id === qid)?.marks ?? 0), 0)
      ctx.check(chosen.length === need && marks === budget, `could not assemble ${String(need)} questions worth ${String(budget)} marks (got ${String(chosen.length)} worth ${String(marks)})`)

      const put = await admin.request('PUT', `/admin/papers/${id}`, { body: { sections: [{ id: String(sectionsOf(editor)[0]?.id), questionIds: chosen }] } })
      ctx.expectStatus(put, 200)
      // AC-R1-16.2: the seeded Kontrak is Spec, so a plain Terbit is refused with a line naming the contract; the audited override publishes.
      const plain = await admin.request('POST', `/admin/papers/${id}/publish`)
      ctx.expectStatus(plain, 200)
      ctx.check(dataOf(plain).ok === false && arr(dataOf(plain).errors).some((e) => String(e).startsWith('Kontrak Simulasi')), `a Spec contract must block Terbit: ${JSON.stringify(dataOf(plain))}`)
      const publish = await admin.request('POST', `/admin/papers/${id}/publish`, { body: { override: true, reason: 'Kontrak sedang menunggu pengesahan' } })
      ctx.expectStatus(publish, 200)
      ctx.check(dataOf(publish).ok === true, `publish refused: ${JSON.stringify(dataOf(publish).errors)}`)
      ctx.check(arr(dataOf(publish).errors).length === 0, 'a successful publish carries no errors')

      const published = (await editorOf(ctx, admin, id)).paper as Json
      ctx.check(published.status === 'terbit' && typeof published.publishedAt === 'string', 'the paper must be terbit with publishedAt')
      ctx.check(listOf(await admin.request('GET', '/admin/papers?status=terbit')).some((p) => p.id === id && p.ok === true), 'status=terbit must list the paper, ok true')
      const again = await admin.request('POST', `/admin/papers/${id}/publish`)
      ctx.expectStatus(again, 200)
      ctx.check(dataOf(again).ok === true, 'publishing a terbit paper again stays ok')

      ctx.check(listOf(await student.request('GET', '/bijak/papers')).some((p) => p.id === id), 'a student must see the published paper in Kertas Pilihan')
      const cover = await student.request('GET', `/bijak/papers/${id}`)
      ctx.expectStatus(cover, 200)

      // Locked while terbit.
      const locked = await admin.request('PUT', `/admin/papers/${id}`, { body: { title: 'Ubah' } })
      expectError(ctx, locked, 422, 'VALIDATION_ERROR')
      ctx.check(errorOf(locked).message === 'Kertas Terbit tidak boleh disunting. Tarik balik dahulu.', 'the locked message differs')
      const noDelete = await admin.request('DELETE', `/admin/papers/${id}`)
      expectError(ctx, noDelete, 422, 'VALIDATION_ERROR')
      ctx.check(errorOf(noDelete).message === 'Tarik balik kertas Terbit sebelum memadam', 'the delete-terbit message differs')

      const withdraw = await admin.request('POST', `/admin/papers/${id}/withdraw`)
      ctx.expectStatus(withdraw, 200)
      ctx.check(dataOf(withdraw).ok === true, 'withdraw must answer { ok: true }')
      const back = (await editorOf(ctx, admin, id)).paper as Json
      ctx.check(back.status === 'draf' && back.publishedAt === undefined, 'a withdrawn paper must be draf without publishedAt')
      ctx.check(!listOf(await student.request('GET', '/bijak/papers')).some((p) => p.id === id), 'a withdrawn paper must leave the student list')

      ctx.expectStatus(await admin.request('DELETE', `/admin/papers/${id}`), 200)
    },
  },
  {
    id: 'bijak-builder-api/roles: anonymous 401, teacher and student 403, admin POST without CSRF 403',
    domain: 'bijak-builder',
    targets: API_ONLY,
    async run(ctx) {
      const reads = ['/admin/papers', '/admin/papers/1', '/admin/blueprints', '/admin/blueprints/MAT/2']
      const writes: { method: 'POST' | 'PUT' | 'DELETE'; path: string; body?: unknown }[] = [
        { method: 'POST', path: '/admin/papers', body: { subject: 'MAT', kertas: 2 } },
        { method: 'POST', path: '/admin/papers/preview', body: { ids: [] } },
        { method: 'PUT', path: '/admin/papers/1', body: { title: 'x' } },
        { method: 'DELETE', path: '/admin/papers/1' },
        { method: 'POST', path: '/admin/papers/1/publish' },
        { method: 'POST', path: '/admin/papers/1/withdraw' },
        { method: 'POST', path: '/admin/blueprints', body: { subject: 'SEJ', kertas: 3, ...blueprintBody('1249/3') } },
        { method: 'POST', path: '/admin/blueprints/MAT/2/versions', body: blueprintBody('1449/2') },
        { method: 'POST', path: '/admin/blueprints/MAT/2/retire' },
      ]
      const call = (client: Client, method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<HttpResponse> =>
        client.request(method, path, body === undefined ? {} : { body })

      const anon = ctx.anonymous()
      for (const path of reads) expectError(ctx, await call(anon, 'GET', path), 401, 'UNAUTHORIZED')
      for (const w of writes) expectError(ctx, await call(anon, w.method, w.path, w.body), 401, 'UNAUTHORIZED')

      for (const role of ['teacher', 'student'] as const) {
        const client = await ctx.as(role)
        for (const path of reads) expectError(ctx, await call(client, 'GET', path), 403, 'FORBIDDEN')
        for (const w of writes) expectError(ctx, await call(client, w.method, w.path, w.body), 403, 'FORBIDDEN')
      }

      const noCsrf = await ctx.as('admin', { csrf: false })
      for (const w of writes) expectError(ctx, await call(noCsrf, w.method, w.path, w.body), 403, 'CSRF_INVALID')
    },
  },
]
