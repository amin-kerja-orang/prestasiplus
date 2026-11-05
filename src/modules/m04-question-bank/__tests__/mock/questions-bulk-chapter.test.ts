/**
 * S2-T08: `POST /api/admin/curriculum/questions/bulk-chapter` (API-DSKP-09) and
 * `GET /api/admin/curriculum/chapter-coverage` (API-DSKP-10) in the M04 mock.
 */

import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import type { MockRuntime } from '@/mock/index'

import type { Question, QuestionMutation } from '../../api/questions'
import { showPrimaryLevels } from '../../mock/repository/visible-levels'
import { ADMIN, GURU, bootM04, callAs, form, type ErrorBody } from './helpers-questions'

let runtime: MockRuntime
let call: ReturnType<typeof callAs>

beforeAll(async () => {
  showPrimaryLevels()
  runtime = await bootM04()
  call = callAs(runtime)
}, 180_000)

afterEach(async () => {
  await runtime.reset()
}, 180_000)

interface Result {
  matched: number
  eligible: number
  refused: number
  applied: number
  cap: number
  remaining: number
  capped: boolean
  dryRun: boolean
  auditId: string | null
}
const URL = '/api/admin/curriculum/questions/bulk-chapter'
const run = (body: unknown, as: number | null = ADMIN) => call<{ data: Result } & ErrorBody>('POST', URL, as, body)

async function chapterOf(subjectId: number, levelId: number): Promise<number> {
  const tree = await call<{ data: { chapters: { id: number }[] } }>(
    'GET',
    `/api/admin/curriculum?subjectId=${String(subjectId)}&educationLevelId=${String(levelId)}`,
    ADMIN,
  )
  return tree.body.data.chapters[0]!.id
}

async function seed(n: number, word: string): Promise<number[]> {
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
        questionText: `Soalan ${word} nombor ${String(i)} untuk ujian bab pukal?`,
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
  return ids
}

describe('bulk-chapter mock', () => {
  it('is admin only', async () => {
    expect((await run({ chapterId: '1', ids: ['1'], dryRun: true }, null)).status).toBe(401)
    expect((await run({ chapterId: '1', ids: ['1'], dryRun: true }, GURU)).status).toBe(403)
  })

  it('404 for an unknown Bab, 422 for a missing expectedCount', async () => {
    expect((await run({ chapterId: '99999999', ids: ['1'], dryRun: true })).status).toBe(404)
    const chapterId = String(await chapterOf(3, 11))
    expect((await run({ chapterId, ids: ['1'] })).status).toBe(422)
  })

  it('dry run counts without writing; apply needs the matched count and then links the Bab', async () => {
    const chapterId = await chapterOf(3, 11)
    const word = 'bulkchapterword1x'
    const ids = (await seed(3, word)).map(String)
    const filter = { subjectId: '3', educationLevelId: '11', search: word }

    const dry = await run({ chapterId: String(chapterId), filter, dryRun: true })
    expect(dry.body.data).toMatchObject({ matched: 3, eligible: 3, refused: 0, applied: 0, dryRun: true, auditId: null })

    const stale = await run({ chapterId: String(chapterId), filter, expectedCount: 2 })
    expect(stale.status).toBe(409)

    const done = await run({ chapterId: String(chapterId), filter, expectedCount: 3 })
    expect(done.body.data).toMatchObject({ matched: 3, eligible: 3, applied: 3, remaining: 0, capped: false, dryRun: false })

    // The same rows now have a Bab: they are refused, not overwritten.
    const again = await run({ chapterId: String(chapterId), ids, dryRun: true })
    expect(again.body.data).toMatchObject({ matched: 3, eligible: 0, refused: 3 })
  })

  it('coverage lists approved questions with and without a Bab', async () => {
    const chapterId = await chapterOf(3, 11)
    const before = await call<{ data: { rows: { subjectId: string; levelCode: string; approved: number; withChapter: number; withoutChapter: number }[] } }>(
      'GET',
      '/api/admin/curriculum/chapter-coverage?subjectId=3&educationLevelId=11',
      ADMIN,
    )
    const row = before.body.data.rows[0]!
    expect(row.withChapter + row.withoutChapter).toBe(row.approved)
    const ids = (await seed(2, 'bulkchapterword2x')).map(String)
    await run({ chapterId: String(chapterId), ids, expectedCount: 2 })
    const after = await call<typeof before.body>('GET', '/api/admin/curriculum/chapter-coverage?subjectId=3&educationLevelId=11', ADMIN)
    expect(after.body.data.rows[0]!.withChapter).toBe(row.withChapter + 2)
  })
})
