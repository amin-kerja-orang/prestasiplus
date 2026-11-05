/**
 * S2-T08: `POST /api/admin/curriculum/questions/bulk-chapter` (API-DSKP-09) and
 * `GET /api/admin/curriculum/chapter-coverage` (API-DSKP-10) in the M04 mock.
 */

import { BULK_CHAPTER_SKIP_REASONS, BulkChapterResultSchema, ChapterCoverageSchema, CURRICULUM_NOT_FOUND_MESSAGES } from '@pp/contract'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { curriculum } from '@/modules/m03-curriculum/mock'
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

async function seed(n: number, word: string, subjectId = 3): Promise<number[]> {
  const ids: number[] = []
  for (let i = 0; i < n; i++) {
    const res = await call<QuestionMutation<Question>>(
      'POST',
      '/api/questions',
      ADMIN,
      form({
        subjectId,
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
    const missing = await run({ chapterId: '99999999', ids: ['1'], dryRun: true })
    expect(missing.status).toBe(404)
    expect(missing.body.error.message).toBe(CURRICULUM_NOT_FOUND_MESSAGES.chapter)
    const chapterId = String(await chapterOf(3, 11))
    expect((await run({ chapterId, ids: ['1'] })).status).toBe(422)
    expect((await run({ chapterId, ids: ['1'], filter: {}, dryRun: true })).status).toBe(422)
    expect((await run({ chapterId, filter: { subjectId: '3' }, dryRun: true })).status).toBe(422)
  })

  it('dry run counts without writing; apply needs the matched count and then links the Bab', async () => {
    const chapterId = await chapterOf(3, 11)
    const word = 'bulkchapterword1x'
    const ids = (await seed(3, word)).map(String)
    const filter = { subjectId: '3', educationLevelId: '11', search: word }

    const dry = await run({ chapterId: String(chapterId), filter, dryRun: true })
    const parsed = BulkChapterResultSchema.parse(dry.body.data)
    expect(parsed).toMatchObject({ matched: 3, eligible: 3, refused: 0, skipped: [], applied: 0, dryRun: true, auditId: null })

    const stale = await run({ chapterId: String(chapterId), filter, expectedCount: 2 })
    expect(stale.status).toBe(409)

    const done = BulkChapterResultSchema.parse((await run({ chapterId: String(chapterId), filter, expectedCount: 3 })).body.data)
    expect(done).toMatchObject({ matched: 3, eligible: 3, applied: 3, remaining: 0, capped: false, dryRun: false, skipped: [] })
    expect(done.auditId).not.toBeNull()

    // The same rows now have a Bab: refused per row, not overwritten.
    const again = BulkChapterResultSchema.parse((await run({ chapterId: String(chapterId), ids, dryRun: true })).body.data)
    expect(again).toMatchObject({ matched: 3, eligible: 0, refused: 3 })
    expect(again.skipped).toEqual(ids.map((questionId) => ({ questionId, reason: BULK_CHAPTER_SKIP_REASONS.alreadyHasChapter })).sort((a, b) => Number(a.questionId) - Number(b.questionId)))
  })

  it('refuses rows per row with 200: other subject, not approved, already has a Bab (no request-level 422)', async () => {
    const chapterId = String(await chapterOf(3, 11))
    const word = 'bulkchapterword3x'
    const [ok1, draft] = (await seed(2, word)).map(String)
    const [other] = (await seed(1, word, 2)).map(String)
    await call('POST', '/api/questions/bulk-action', ADMIN, { action: 'pending_review', ids: [Number(draft)] })

    const res = await run({ chapterId, ids: [ok1!, draft!, other!], dryRun: true })
    expect(res.status).toBe(200)
    const r = BulkChapterResultSchema.parse(res.body.data)
    expect(r).toMatchObject({ matched: 3, eligible: 1, refused: 2 })
    const reasons = Object.fromEntries(r.skipped.map((x) => [x.questionId, x.reason]))
    expect(reasons[draft!]).toBe(BULK_CHAPTER_SKIP_REASONS.notApproved)
    expect(reasons[other!]).toBe(BULK_CHAPTER_SKIP_REASONS.chapterMismatch)
    expect(r.skipped.map((x) => Number(x.questionId))).toEqual([...r.skipped.map((x) => Number(x.questionId))].sort((a, b) => a - b))

    // A filter of another Subjek than the Bab's is not a 422 either: every matched row is refused as a mismatch.
    const wrong = await run({ chapterId, filter: { subjectId: '2', educationLevelId: '11', search: word }, dryRun: true })
    expect(wrong.status).toBe(200)
    expect(BulkChapterResultSchema.parse(wrong.body.data)).toMatchObject({ matched: 1, eligible: 0, refused: 1 })
  })

  it('coverage: offered pairs (zero pairs included), withChapter + withoutChapter = approved, 404 for unknown ids', async () => {
    const chapterId = await chapterOf(3, 11)
    const get = (q: string) => call<{ data: unknown } & ErrorBody>('GET', `/api/admin/curriculum/chapter-coverage${q}`, ADMIN)
    const before = ChapterCoverageSchema.parse((await get('?subjectId=3&educationLevelId=11')).body.data)
    const row = before.rows[0]!
    expect(row.withChapter + row.withoutChapter).toBe(row.approved)
    const ids = (await seed(2, 'bulkchapterword2x')).map(String)
    await run({ chapterId: String(chapterId), ids, expectedCount: 2 })
    const after = ChapterCoverageSchema.parse((await get('?subjectId=3&educationLevelId=11')).body.data)
    expect(after.rows[0]!.withChapter).toBe(row.withChapter + 2)

    const all = ChapterCoverageSchema.parse((await get('')).body.data)
    expect(all.rows.length).toBeGreaterThan(1)
    expect(all.rows.every((r) => r.withChapter + r.withoutChapter === r.approved)).toBe(true)
    expect(all.rows.some((r) => r.approved === 0)).toBe(true)
    // Primary levels are not offered (stage <> primary).
    const primary = curriculum.levels().filter((l) => l.stage === 'primary')
    expect(primary.length).toBeGreaterThan(0)
    expect(all.rows.some((r) => primary.some((l) => l.code === r.levelCode))).toBe(false)

    const noSubject = await get('?subjectId=99999999')
    expect(noSubject.status).toBe(404)
    expect(noSubject.body.error.message).toBe(CURRICULUM_NOT_FOUND_MESSAGES.subject)
    const noLevel = await get('?educationLevelId=99999999')
    expect(noLevel.status).toBe(404)
    expect(noLevel.body.error.message).toBe(CURRICULUM_NOT_FOUND_MESSAGES.level)
  })

  it('the Studio list honours chapter=none and chapter=<id> (API-Q-01, S2-T08)', async () => {
    const chapterId = await chapterOf(3, 11)
    const word = 'bulkchapterword3x'
    const ids = (await seed(3, word)).map(String)
    const list = async (chapter: string) =>
      (await call<{ data: unknown[]; meta: { totalItems: number } }>('GET', `/api/questions?subjectId=3&educationLevelId=11&status=approved&search=${word}&chapter=${chapter}`, ADMIN)).body

    expect((await list('none')).meta.totalItems).toBe(3)
    expect((await list(String(chapterId))).meta.totalItems).toBe(0)
    await run({ chapterId: String(chapterId), ids: ids.slice(0, 2), expectedCount: 2 })
    expect((await list('none')).meta.totalItems).toBe(1)
    expect((await list(String(chapterId))).meta.totalItems).toBe(2)
    expect((await list('abc')).meta.totalItems).toBe(0)
  })

  it('"all results" with chapter=none links only the questions without a Bab; a Bab id in the filter links none', async () => {
    const chapterId = await chapterOf(3, 11)
    const word = 'bulkchapterword4x'
    const ids = (await seed(3, word)).map(String)
    await run({ chapterId: String(chapterId), ids: [ids[0]!], expectedCount: 1 })
    const base = { subjectId: '3', educationLevelId: '11', search: word }
    const none = await run({ chapterId: String(chapterId), filter: { ...base, chapter: 'none' }, dryRun: true })
    expect(none.body.data).toMatchObject({ matched: 2, eligible: 2, refused: 0 })
    const byId = await run({ chapterId: String(chapterId), filter: { ...base, chapter: String(chapterId) }, dryRun: true })
    expect(byId.body.data).toMatchObject({ matched: 1, eligible: 0, refused: 1 })
  })
})
