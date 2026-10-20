import { CurriculumTopicDetailLearnerSchema, CurriculumLearningMapSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { type Client, addAnswer, addSession, bootOverviewApp, chapterIdOf, clearPractice, idOf, loginAs, userIdByEmail } from './helpers'
import type { CurriculumTestApp } from '../../curriculum/helpers'

const LearningMap = envelopeOf(CurriculumLearningMapSchema)
const TopicDetail = envelopeOf(CurriculumTopicDetailLearnerSchema)

/** The mock formulas (src/modules/m03-curriculum/mock/repository/{rules,progress}.ts, SRS BR-14, BR-19), written out again. */
const mockProgress = (correct: number) => Math.min(100, Math.round((100 * correct) / 20))
type State = 'mastered' | 'started' | 'unlocked' | 'locked'
function mockStates(p: { progress: number; sessions: number; questionsAnswered: number }[]): State[] {
  const out: State[] = []
  p.forEach((x, i) => {
    const prev = out[i - 1]
    out.push(x.progress >= 80 ? 'mastered' : x.sessions >= 1 || x.questionsAnswered >= 1 ? 'started' : i < 2 || prev === 'started' || prev === 'mastered' ? 'unlocked' : 'locked')
  })
  return out
}

let t: CurriculumTestApp
let pelajar: Client
let pelajar2: Client
let u: { pelajar: string; pelajar2: string }
let w: { math: string; chapters: string[] }

beforeAll(async () => {
  t = await bootOverviewApp({ withArticles: false })
  pelajar = await loginAs(t, 'pelajar@demo.test')
  pelajar2 = await loginAs(t, 'pelajar2@demo.test')
  u = { pelajar: await userIdByEmail(t.db, 'pelajar@demo.test'), pelajar2: await userIdByEmail(t.db, 'pelajar2@demo.test') }
  w = { math: await idOf(t.db, 'subjects', 'MATH'), chapters: [] }
  for (let n = 1; n <= 5; n++) w.chapters.push(await chapterIdOf(t.db, 'MATH', 'D1', n))
}, 120_000)

afterAll(async () => {
  await t.close()
})

beforeEach(async () => {
  await clearPractice(t.db)
})

const AT = '2026-10-19T10:00:00+08:00'

/** chapter 1: 22 answers (20 right) in 2 sessions; chapter 2: 4 answers (3 right) in 1 session. */
async function seedStudent(): Promise<void> {
  const s1 = await addSession(t.db, { user: u.pelajar, count: 11, correct: 10, completedAt: AT })
  const s2 = await addSession(t.db, { user: u.pelajar, count: 11, correct: 10, completedAt: AT })
  const s3 = await addSession(t.db, { user: u.pelajar, count: 4, correct: 3, completedAt: AT })
  for (let i = 0; i < 22; i++) await addAnswer(t.db, { user: u.pelajar, subject: w.math, chapter: w.chapters[0], correct: i % 11 !== 10, at: AT, session: i < 11 ? s1 : s2 })
  for (let i = 0; i < 4; i++) await addAnswer(t.db, { user: u.pelajar, subject: w.math, chapter: w.chapters[1], correct: i !== 3, at: AT, session: s3 })
  // not counted: Mod Pelajar rows, another student, answers without a chapter
  for (let i = 0; i < 20; i++) await addAnswer(t.db, { user: u.pelajar, subject: w.math, chapter: w.chapters[2], correct: true, at: AT, isTest: true })
  for (let i = 0; i < 20; i++) await addAnswer(t.db, { user: u.pelajar2, subject: w.math, chapter: w.chapters[2], correct: true, at: AT })
  await addAnswer(t.db, { user: u.pelajar, subject: w.math, chapter: null, correct: true, at: AT })
}

const map = async (c: Client, query = 'subject=MATEMATIK&grade=DARJAH_1') => LearningMap.parse((await c.get(`/api/learning-map?${query}`)).body).data

describe('AC8: BE-08 TopicProgressProvider from the answer rows (BR-14, BR-19)', () => {
  it('a student with no answer reads the no-history state: first two islands open, nothing started', async () => {
    const m = await map(pelajar)
    expect(m.topics.map((x) => x.state)).toEqual(['unlocked', 'unlocked', 'locked', 'locked', 'locked'])
    expect(m.stats).toEqual({ done: 0, total: 5, progress: 0 })
    expect(m.topics.every((x) => x.sessions === 0 && x.questionsAnswered === 0 && x.progress === 0)).toBe(true)
  })

  it('island states, "Topik Selesai" and "Kemajuan" equal the mock formulas for the seeded answers', async () => {
    await seedStudent()
    const m = await map(pelajar)
    const expected = [
      { sessions: 2, questionsAnswered: 22, progress: mockProgress(20) },
      { sessions: 1, questionsAnswered: 4, progress: mockProgress(3) },
      { sessions: 0, questionsAnswered: 0, progress: 0 },
      { sessions: 0, questionsAnswered: 0, progress: 0 },
      { sessions: 0, questionsAnswered: 0, progress: 0 },
    ]
    expect(m.topics.map((x) => ({ sessions: x.sessions, questionsAnswered: x.questionsAnswered, progress: x.progress }))).toEqual(expected)
    const states = mockStates(expected)
    expect(states).toEqual(['mastered', 'started', 'unlocked', 'locked', 'locked'])
    expect(m.topics.map((x) => x.state)).toEqual(states)
    expect(m.stats).toEqual({
      done: states.filter((s) => s === 'mastered').length,
      total: 5,
      progress: Math.round(expected.reduce((n, p) => n + p.progress, 0) / expected.length),
    })
    expect(m.stats).toEqual({ done: 1, total: 5, progress: 23 })
    expect(m.topics.map((x) => x.practiceUrl === null)).toEqual([false, false, false, true, true])
  })

  it('GET /api/topics/:id shows the same progress and every subtopic bar carries it (BR-19)', async () => {
    await seedStudent()
    const m = await map(pelajar)
    const second = m.topics[1]
    const d = TopicDetail.parse((await pelajar.get(`/api/topics/${second?.id}`)).body).data
    expect(d.progress).toEqual({ questionsAnswered: 4, progress: mockProgress(3) })
    for (const s of d.subtopics) expect(s.progress).toBe(mockProgress(3))
  })

  it('progress is the caller own: another student, and Mod Pelajar rows, change nothing', async () => {
    await seedStudent()
    const other = await map(pelajar2)
    // pelajar2 answered chapter 3 only (20 right): its own topic 3 is mastered, nothing of pelajar shows
    expect(other.topics.map((x) => x.questionsAnswered)).toEqual([0, 0, 20, 0, 0])
    expect(other.stats.done).toBe(1)
    expect((await map(pelajar)).topics[2]?.questionsAnswered).toBe(0)
  })

  it('other subjects and grades keep the default (a chapter of MATH D1 does not leak into BM or D2)', async () => {
    await seedStudent()
    expect((await map(pelajar, 'subject=BAHASA_MELAYU&grade=DARJAH_1')).stats.done).toBe(0)
    const d2 = await map(pelajar, 'subject=MATEMATIK&grade=DARJAH_2')
    expect(d2.topics.every((x) => x.questionsAnswered === 0)).toBe(true)
  })

  it('AC2: with question_id null and historical true on every answer the island states and figures are identical', async () => {
    await seedStudent()
    // give the rows a question link first, to prove it is dropped and not needed
    await t.db.query('insert into questions (source_type, live_version_no, is_active) values (\'manual\', 1, true)')
    const q = (await t.db.query<{ id: string }>('select max(id)::text as id from questions'))[0]?.id as string
    await t.db.query('update practice_answers set question_id = $1 where user_id = $2', [q, u.pelajar])
    const before = await map(pelajar)
    await t.db.query('update practice_answers set question_id = null, historical = true where user_id = $1', [u.pelajar])
    await t.db.query('delete from questions')
    const after = await map(pelajar)
    expect(after).toEqual(before)
    expect(after.stats).toEqual({ done: 1, total: 5, progress: 23 })
  })

  it('progress is capped at 100 and a topic with 80 or more is mastered; 79 is not (BR-14)', async () => {
    // 16 right = 80 -> mastered; 15 right = 75 -> started
    for (let i = 0; i < 16; i++) await addAnswer(t.db, { user: u.pelajar, subject: w.math, chapter: w.chapters[0], correct: true, at: AT })
    for (let i = 0; i < 15; i++) await addAnswer(t.db, { user: u.pelajar, subject: w.math, chapter: w.chapters[1], correct: true, at: AT })
    for (let i = 0; i < 30; i++) await addAnswer(t.db, { user: u.pelajar, subject: w.math, chapter: w.chapters[2], correct: true, at: AT })
    const m = await map(pelajar)
    expect(m.topics.map((x) => x.progress)).toEqual([80, 75, 100, 0, 0])
    expect(m.topics.map((x) => x.state)).toEqual(['mastered', 'started', 'mastered', 'unlocked', 'locked'])
    expect(m.stats).toEqual({ done: 2, total: 5, progress: Math.round((80 + 75 + 100) / 5) })
  })
})
