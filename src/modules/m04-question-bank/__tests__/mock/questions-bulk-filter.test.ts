/**
 * REQ-A-021: `POST /api/questions/bulk-action/filter` (AC-03.3) in the M04 mock: strict body, blank
 * filters refused, dry run, `expectedCount` (409), the cap, and the same filter as `GET /api/questions`.
 */

import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import type { MockRuntime } from '@/mock/index'

import type { Question, QuestionFilterBulkResult, QuestionMutation } from '../../api/questions'
import { showPrimaryLevels } from '../../mock/repository/visible-levels'
import { ADMIN, GURU, bootM04, callAs, form, type ErrorBody } from './helpers-questions'

let runtime: MockRuntime
let call: ReturnType<typeof callAs>
let token = 0

beforeAll(async () => {
  showPrimaryLevels()
  runtime = await bootM04()
  call = callAs(runtime)
}, 180_000)

afterEach(async () => {
  await runtime.reset()
}, 180_000)

const URL = '/api/questions/bulk-action/filter'
const run = (body: unknown, as: number | null = ADMIN) =>
  call<QuestionMutation<QuestionFilterBulkResult> & ErrorBody>('POST', URL, as, body)

/** Creates `n` approved questions that only a search for the returned word finds. */
async function seed(n: number): Promise<{ word: string; ids: number[] }> {
  const word = `bulkfilterword${String(++token)}x`
  const ids: number[] = []
  for (let i = 0; i < n; i++) {
    const res = await call<QuestionMutation<Question>>(
      'POST',
      '/api/questions',
      ADMIN,
      form({
        subjectId: 3,
        educationLevelId: 11,
        difficultyLevel: 2,
        questionType: 'mcq',
        questionText: `Soalan ${word} nombor ${String(i)} untuk ujian tapisan pukal?`,
        'options[0]': '1',
        'options[1]': '2',
        'options[2]': '3',
        'options[3]': '4',
        correctAnswer: 1,
        explanation: 'Penjelasan ringkas untuk ujian.',
        language: 'bm',
        pointsValue: 1,
      }),
    )
    ids.push(res.body.data.id)
  }
  return { word, ids }
}

describe('POST /api/questions/bulk-action/filter', () => {
  it('is admin only', async () => {
    expect((await run({ action: 'archived', filter: {}, dryRun: true }, null)).status).toBe(401)
    expect((await run({ action: 'archived', filter: {}, dryRun: true }, GURU)).status).toBe(403)
  })

  it('422: approved needs a filter; a filter whose values are all blank is refused for both actions', async () => {
    const needed = await run({ action: 'approved', filter: {}, dryRun: true })
    expect(needed.status).toBe(422)
    expect(needed.body.error.fields?.filter).toContain('Sila pilih sekurang-kurangnya satu penapis')
    for (const action of ['approved', 'archived']) {
      for (const filter of [{ search: '' }, { search: '   ' }, { subjectId: '', status: ' ' }]) {
        const res = await run({ action, filter, dryRun: true })
        expect(res.status, JSON.stringify([action, filter])).toBe(422)
        expect(res.body.error.fields?.filter).toBe(
          'Penapis yang dipilih tidak mempunyai nilai. Isi nilai penapis, atau buang penapis itu.',
        )
      }
    }
  })

  it('422: expectedCount is needed unless dryRun; unknown keys and a bad action are refused', async () => {
    const noCount = await run({ action: 'archived', filter: {} })
    expect(noCount.body.error.fields?.expectedCount).toContain('expectedCount')
    expect((await run({ action: 'archived', filter: { nope: 'x' }, dryRun: true })).body.error.fields?.filter).toBe(
      'Nilai penapis tidak sah.',
    )
    expect((await run({ action: 'archived', filter: {}, dryRun: true, ids: [1] })).status).toBe(422)
    expect((await run({ action: 'delete', filter: {}, dryRun: true })).body.error.fields?.action).toBeDefined()
  })

  it('dry run counts like the list and changes nothing', async () => {
    const { word, ids } = await seed(3)
    const res = await run({ action: 'archived', filter: { search: word }, dryRun: true })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ matched: 3, eligible: 3, skipped: 0, processed: 0, affected: 0, dryRun: true })
    const list = await call<{ data: { id: number }[]; meta: { totalItems: number } }>(
      'GET',
      `/api/questions?search=${word}`,
      ADMIN,
    )
    expect(list.body.meta.totalItems).toBe(3)
    expect(list.body.data.map((r) => r.id).sort()).toEqual([...ids].sort())
  })

  it('applies the action to the rows of the filter, with expectedCount', async () => {
    const { word } = await seed(2)
    const done = await run({ action: 'archived', filter: { search: word }, expectedCount: 2 })
    expect(done.status).toBe(200)
    expect(done.body.data).toMatchObject({ matched: 2, eligible: 2, processed: 2, affected: 2, remaining: 0, failed: [] })
    expect(done.body.status).toContain('Berjaya arkib 2 soalan')
    const archived = await call<{ meta: { totalItems: number } }>('GET', `/api/questions?search=${word}&status=archived`, ADMIN)
    expect(archived.body.meta.totalItems).toBe(2)
    // Already archived: nothing left to do, they count as skipped.
    const again = await run({ action: 'archived', filter: { search: word }, dryRun: true })
    expect(again.body.data).toMatchObject({ matched: 2, eligible: 0, skipped: 2 })
  })

  it('approved only moves Menunggu Semakan rows (wire status "review" is accepted)', async () => {
    const { word, ids } = await seed(2)
    await call('POST', '/api/questions/bulk-action', ADMIN, { action: 'pending_review', ids: [ids[0]] })
    const dry = await run({ action: 'approved', filter: { search: word, status: 'review' }, dryRun: true })
    expect(dry.body.data).toMatchObject({ matched: 1, eligible: 1 })
    const done = await run({ action: 'approved', filter: { search: word }, expectedCount: 2 })
    expect(done.body.data).toMatchObject({ matched: 2, eligible: 1, skipped: 1, affected: 1 })
    expect(done.body.status).toContain('Berjaya luluskan 1 soalan (hasil tapisan)')
  })

  it('409 when the count differs; nothing is applied', async () => {
    const { word } = await seed(2)
    const res = await run({ action: 'archived', filter: { search: word }, expectedCount: 5 })
    expect(res.status).toBe(409)
    expect(res.body.error.message).toContain('dijangka 5, kini 2')
    const dry = await run({ action: 'archived', filter: { search: word }, dryRun: true })
    expect(dry.body.data.eligible).toBe(2)
  })

  it('applies at most the cap per run and reports the remainder', async () => {
    // "Arkib Semua" on the observed bank: the cap bites, the rest is `remaining`.
    const dry = await run({ action: 'archived', filter: {}, dryRun: true })
    expect(dry.body.data.eligible).toBeGreaterThan(500)
    const done = await run({ action: 'archived', filter: {}, expectedCount: dry.body.data.matched })
    expect(done.body.data).toMatchObject({ cap: 500, processed: 500, capped: true })
    expect(done.body.data.affected + done.body.data.failed.length).toBe(500)
    expect(done.body.data.remaining).toBe(dry.body.data.eligible - 500)
  }, 120_000)
})
