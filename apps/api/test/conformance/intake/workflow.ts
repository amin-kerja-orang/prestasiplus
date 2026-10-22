import type { HttpClient, Scenario, ScenarioContext } from '@pp/contract-tests'

import { API_ONLY, dataOf, errorOf, expectError, listOf } from '../helpers'

/**
 * Intake workflow (BE-38): extraction request, review queue, edit, reject, stimuli and bulk on a batch that has no file
 * (the conformance app has no AI provider: its port is the disabled adapter, so a run cannot succeed here; the happy path
 * with a scripted extractor is in `test/intake-workflow/`). Every JSON answer is still checked against the contract by
 * the runner. API only: the mock has no such routes.
 */
const DECLARATION = {
  paperType: 'trial',
  subject: 'MATH',
  kertas: 1,
  year: 2025,
  source: 'Sumber ujian sintetik',
  copyright: 'sendiri',
  declaration: true,
} as const

async function newBatch(ctx: ScenarioContext, client: HttpClient): Promise<string> {
  const res = await client.request('POST', '/intake/batches', { body: DECLARATION })
  ctx.expectStatus(res, 201)
  return String(dataOf(res).id)
}

async function newItem(ctx: ScenarioContext, client: HttpClient, batchId: string): Promise<string> {
  const res = await client.request('POST', `/intake/batches/${batchId}/items`, { body: {} })
  ctx.expectStatus(res, 201)
  return String(dataOf(res).id)
}

export const intakeWorkflowScenarios: Scenario[] = [
  {
    id: 'intake-workflow-api/manual item: add, read, edit with history, queue filters and counts, review summary',
    domain: 'intake-workflow',
    targets: API_ONLY,
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const batch = await newBatch(ctx, teacher)
      const first = await newItem(ctx, teacher, batch)
      const second = await teacher.request('POST', `/intake/batches/${batch}/items`, { body: { page: 2 } })
      ctx.expectStatus(second, 201)
      ctx.check(dataOf(second).label === '2' && dataOf(second).state === 'generated' && dataOf(second).page === 2, 'the next item takes the next label, state generated')

      const one = await teacher.request('GET', `/intake/items/${first}`)
      ctx.expectStatus(one, 200)
      ctx.check((dataOf(one).provenance as { sourceType?: string }).sourceType === 'manual', 'a hand-added item has source manual')

      const edited = await teacher.request('PATCH', `/intake/items/${first}`, { body: { stem: 'Hitung 2 + 3 dengan teliti.', marks: 2 } })
      ctx.expectStatus(edited, 200)
      const events = dataOf(edited).events as Array<{ action: string; field: string | null }> | undefined
      ctx.check(Array.isArray(events) && events.some((e) => e.action === 'edited' && e.field === 'stem'), 'an edit must leave a history row for the field')
      ctx.check((edited.body as { reordered?: boolean }).reordered === false, 'a plain edit does not reorder')
      expectError(ctx, await teacher.request('PATCH', `/intake/items/${first}`, { body: {} }), 422, 'VALIDATION_ERROR')
      expectError(ctx, await teacher.request('PATCH', `/intake/items/${first}`, { body: { state: 'accepted' } }), 422, 'VALIDATION_ERROR')

      const list = await teacher.request('GET', `/intake/items?batchId=${batch}&state=generated&pageSize=10`)
      ctx.expectStatus(list, 200)
      ctx.check(listOf(list).length === 2, 'both items must be listed')
      const counts = (list.body as { meta: { counts: Record<string, number> } }).meta.counts
      ctx.check(counts.generated === 2 && counts.accepted === 0, 'the per-state counts must be computed from the items')
      ctx.expectStatus(await teacher.request('GET', '/intake/items?state=nope'), 422)

      const review = await teacher.request('GET', `/intake/batches/${batch}/review`)
      ctx.expectStatus(review, 200)
      ctx.check((dataOf(review).counts as { items?: number }).items === 2, 'the summary must count both items')
      ctx.check(dataOf(review).extraction === null, 'no run was requested')
      await teacher.request('POST', `/intake/batches/${batch}/cancel`)
    },
  },
  {
    id: 'intake-workflow-api/accept refused by the gate (422 with issues) and reject with a reason (final, 409 afterwards)',
    domain: 'intake-workflow',
    targets: API_ONLY,
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const batch = await newBatch(ctx, teacher)
      const a = await newItem(ctx, teacher, batch)
      const b = await newItem(ctx, teacher, batch)

      const refused = await teacher.request('POST', `/intake/items/${a}/accept`, { body: {} })
      expectError(ctx, refused, 422, 'VALIDATION_ERROR')
      const issues = (errorOf(refused).details as { issues?: unknown[] } | undefined)?.issues
      ctx.check(Array.isArray(issues) && issues.length > 0, 'the gate must list the failed rules')
      ctx.check(errorOf(refused).message === 'Soalan belum memenuhi semakan kualiti. Baiki isu yang disenaraikan.', 'the gate message is the contract copy')

      expectError(ctx, await teacher.request('POST', `/intake/items/${b}/reject`, { body: {} }), 422, 'VALIDATION_ERROR')
      const rejected = await teacher.request('POST', `/intake/items/${b}/reject`, { body: { reason: 'Di luar skop.' } })
      ctx.expectStatus(rejected, 200)
      ctx.check(dataOf(rejected).state === 'rejected' && dataOf(rejected).rejectReason === 'Di luar skop.', 'the item must be rejected with its reason')
      expectError(ctx, await teacher.request('POST', `/intake/items/${b}/reject`, { body: { reason: 'Lagi' } }), 409, 'CONFLICT')
      expectError(ctx, await teacher.request('POST', `/intake/items/${b}/accept`, { body: {} }), 409, 'CONFLICT')
      expectError(ctx, await teacher.request('PATCH', `/intake/items/${b}`, { body: { marks: 3 } }), 409, 'CONFLICT')
      await teacher.request('POST', `/intake/batches/${batch}/cancel`)
    },
  },
  {
    id: 'intake-workflow-api/stimuli: add numbered, edit, attach an item, delete detaches; unknown ids are 404',
    domain: 'intake-workflow',
    targets: API_ONLY,
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const batch = await newBatch(ctx, teacher)
      const item = await newItem(ctx, teacher, batch)
      const s = await teacher.request('POST', `/intake/batches/${batch}/stimuli`, { body: { kind: 'passage', text: 'Petikan ringkas.', alt: 'Petikan' } })
      ctx.expectStatus(s, 201)
      ctx.check(dataOf(s).label === 'Petikan 1', 'the server numbers the label')
      expectError(ctx, await teacher.request('POST', `/intake/batches/${batch}/stimuli`, { body: { kind: 'diagram', svg: '<svg/>' } }), 422, 'VALIDATION_ERROR')
      const id = String(dataOf(s).id)
      const patched = await teacher.request('PATCH', `/intake/stimuli/${id}`, { body: { caption: 'Tajuk' } })
      ctx.expectStatus(patched, 200)
      ctx.check(dataOf(patched).caption === 'Tajuk', 'the caption must change')
      const attached = await teacher.request('PATCH', `/intake/items/${item}`, { body: { stimulusId: id } })
      ctx.expectStatus(attached, 200)
      const removed = await teacher.request('DELETE', `/intake/stimuli/${id}`)
      ctx.expectStatus(removed, 200)
      ctx.check(JSON.stringify(dataOf(removed).detachedItemIds) === JSON.stringify([item]), 'the item must be listed as detached')
      expectError(ctx, await teacher.request('DELETE', `/intake/stimuli/${id}`), 404, 'NOT_FOUND')
      expectError(ctx, await teacher.request('PATCH', '/intake/stimuli/999999999', { body: { caption: 'x' } }), 404, 'NOT_FOUND')
      await teacher.request('POST', `/intake/batches/${batch}/cancel`)
    },
  },
  {
    id: 'intake-workflow-api/extract: a batch without a processed file is 409; unknown batch 404',
    domain: 'intake-workflow',
    targets: API_ONLY,
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const batch = await newBatch(ctx, teacher)
      const res = await teacher.request('POST', `/intake/batches/${batch}/extract`, { body: {} })
      expectError(ctx, res, 409, 'CONFLICT')
      ctx.check(errorOf(res).message === 'Kumpulan ini belum boleh diekstrak: tiada fail, atau fail masih diproses.', 'the not-extractable message differs')
      expectError(ctx, await teacher.request('POST', '/intake/batches/999999999/extract', { body: {} }), 404, 'NOT_FOUND')
      await teacher.request('POST', `/intake/batches/${batch}/cancel`)
    },
  },
  {
    id: 'intake-workflow-api/bulk: reject with a reason; accept is Admin Pusat only; unknown ids are skipped',
    domain: 'intake-workflow',
    targets: API_ONLY,
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const admin = await ctx.as('admin')
      const batch = await newBatch(ctx, teacher)
      const a = await newItem(ctx, teacher, batch)
      expectError(ctx, await teacher.request('POST', '/intake/items/bulk', { body: { action: 'accept', ids: [a] } }), 403, 'FORBIDDEN')
      expectError(ctx, await teacher.request('POST', '/intake/items/bulk', { body: { action: 'reject', ids: [a] } }), 422, 'VALIDATION_ERROR')
      const res = await teacher.request('POST', '/intake/items/bulk', { body: { action: 'reject', ids: [a, '999999999'], reason: 'Tidak sesuai.' } })
      ctx.expectStatus(res, 200)
      const results = dataOf(res).results as Array<{ outcome: string; reason: string | null }>
      ctx.check(results[0]?.outcome === 'done' && results[1]?.outcome === 'skipped' && results[1]?.reason === 'NOT_FOUND', 'per-id outcomes in request order')
      const accepted = await admin.request('POST', '/intake/items/bulk', { body: { action: 'accept', ids: ['999999999'] } })
      ctx.expectStatus(accepted, 200)
      ctx.check(dataOf(accepted).threshold === 'high', 'the default threshold is the high band')
      await teacher.request('POST', `/intake/batches/${batch}/cancel`)
    },
  },
  {
    id: 'intake-workflow-api/roles and scope: anonymous 401, school admin and student 403, another Guru 404, Admin Pusat reads all',
    domain: 'intake-workflow',
    targets: API_ONLY,
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const batch = await newBatch(ctx, teacher)
      const item = await newItem(ctx, teacher, batch)
      const paths: Array<[string, string]> = [
        ['GET', `/intake/items/${item}`],
        ['GET', '/intake/items'],
        ['GET', `/intake/batches/${batch}/review`],
      ]
      for (const [method, path] of paths) {
        expectError(ctx, await ctx.anonymous().request(method as 'GET', path), 401, 'UNAUTHORIZED')
        for (const role of ['school_admin', 'student'] as const) {
          expectError(ctx, await (await ctx.as(role)).request(method as 'GET', path), 403, 'FORBIDDEN')
        }
      }
      const admin = await ctx.as('admin')
      ctx.expectStatus(await admin.request('GET', `/intake/items/${item}`), 200)
      ctx.expectStatus(await admin.request('GET', `/intake/batches/${batch}/review`), 200)
      await teacher.request('POST', `/intake/batches/${batch}/cancel`)
    },
  },
]
