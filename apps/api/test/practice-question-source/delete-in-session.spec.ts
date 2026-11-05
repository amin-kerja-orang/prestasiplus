import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { walletTiersSeed } from '../../prisma/seed/core/wallet-tiers'
import { QuestionsService } from '../../src/modules/questions'
import { ADMIN, STUDENT_1, bootMissionsApp, client, loadWorld, type Client, type MissionsTestApp, type World } from '../missions/helpers'

/**
 * R1 delete-served-guard, "breaks a pupil" check: a question deleted DURING a practice session. Lead decision: no `in_practice` block (V2 parity,
 * practice sessions are short-lived). The session must degrade, never 5xx: the deleted question cannot be answered (422), the rest of the session and
 * its submit work, and a completed session keeps its result. Latih Tubi and the random Kuiz are both `practice_sessions` rows (the Kuiz is marked by
 * `legacy_paper`), so the session types that hold question ids are covered here: Latih Tubi (practice route) and Kuiz (bijak route).
 * (The other modes read the same `practice_session_questions` rows; the probe over random, chapter, past_year and revision gave the same codes.)
 */
let t: MissionsTestApp
let w: World
let pupil: Client
let admin: Client
let svc: QuestionsService
let dLevel: string
let chapterId: string
let counter = 0

async function mcq(): Promise<string> {
  const tag = w.tag
  const q = await svc.create(
    { subjectId: tag.subjectId, educationLevelId: tag.levelId, difficultyLevel: 3, questionText: `Soalan sesi amalan ${String(counter++)}: yang manakah betul?`, questionType: 'mcq', options: ['Satu', 'Dua', 'Tiga', 'Empat'], correctAnswer: 1, explanation: 'Penjelasan.', cognitiveLevel: 'mengaplikasi', ...(tag.chapterId === undefined ? {} : { curriculumChapterId: tag.chapterId }), tag: { unitId: tag.unitId, spIds: [tag.spId], tp: 3 } } as never,
    { userId: w.admin, role: 'admin' },
  )
  for (const status of ['review', 'approved'] as const) await svc.bulkAction(status, [q.id], { userId: w.admin, role: 'admin' })
  await t.db.query(`update question_versions set education_level_id = $2, chapter_id = $3 where question_id = $1`, [q.id, dLevel, chapterId])
  await t.db.query(`insert into question_tags (question_id, kind, code) values ($1, 'pool', 'past_year') on conflict do nothing`, [q.id])
  return q.id
}

beforeAll(async () => {
  t = await bootMissionsApp({ full: true })
  await runSeeds([walletTiersSeed], { prisma: t.db.prisma }) // reference data the wallet summary needs (the missions harness does not seed it)
  w = await loadWorld(t)
  await t.db.query(`insert into comp_students (user_id, package_expires_on) values ($1, '2027-12-31') on conflict do nothing`, [w.student1])
  dLevel = (await t.db.query<{ id: string }>(
    `select l.id::text id from education_levels l join subject_levels sl on sl.education_level_id = l.id
      where sl.subject_id = $1 and l.code in ('T4','T5') and l.id <> $2::bigint and l.is_active
        and exists (select 1 from chapters c where c.subject_id = sl.subject_id and c.education_level_id = l.id and c.is_active) order by l.sort_order, l.id limit 1`,
    [w.tag.subjectId, w.tag.levelId],
  ))[0]!.id
  await t.db.query(`update questions set is_active = false where id in (select question_id from question_versions where subject_id = $1 and education_level_id = $2)`, [w.tag.subjectId, dLevel])
  chapterId = (await t.db.query<{ id: string }>(`select id::text id from chapters where subject_id = $1 and education_level_id = $2 and is_active order by id limit 1`, [w.tag.subjectId, dLevel]))[0]!.id
  pupil = await client(t, STUDENT_1)
  admin = await client(t, ADMIN)
  svc = t.get(QuestionsService)
}, 180_000)
afterAll(async () => {
  await t.close()
})

/** Deletes one served question with the admin route and another with the admin bulk action; both succeed (no served paper holds them). S6-T06: the Guru route deletes intake items, not bank questions. */
async function deleteTwo(served: string[]): Promise<void> {
  expect((await admin.del(`/questions/${served[0]}`)).status).toBe(200)
  const bulk = await admin.post('/questions/bulk-action', { action: 'delete', ids: [served[1]] })
  expect(bulk.status, JSON.stringify(bulk.body)).toBe(200)
  expect(bulk.body.data.affected).toBe(1)
  for (const id of served.slice(0, 2)) expect(Number((await t.db.query<{ n: string }>(`select count(*)::text n from questions where id = $1`, [id]))[0]!.n)).toBe(0)
}

/** Every pupil read that touches practice sessions, answers or questions: all 200 (a 5xx is a pupil break). */
async function readsAreFine(label: string): Promise<void> {
  for (const path of ['/practice/sessions?modes=latih_tubi', '/practice/history', '/practice/corrections', '/practice/progress', '/practice/revision', `/practice/revision/${w.subjectCode}`, '/practice/mastery', '/dashboard']) {
    const r = await pupil.get(path)
    expect(r.status, `${label} GET ${path}: ${JSON.stringify(r.body).slice(0, 160)}`).toBe(200)
  }
}

describe('Latih Tubi (POST /practice/sessions)', () => {
  const startLatihTubi = () => pupil.post('/practice/sessions', { mode: 'latih_tubi', subjectCode: w.subjectCode, count: 40 })

  it('IN PROGRESS: the deleted questions cannot be answered (422), the others can (200), submit works (200), reads stay 200', async () => {
    for (let i = 0; i < 6; i++) await mcq()
    const start = await startLatihTubi()
    expect(start.status, JSON.stringify(start.body)).toBe(201)
    const sid = start.body.data.sessionId as string
    const served = (start.body.data.questions as { id: string }[]).map((q) => q.id)
    expect(served.length).toBeGreaterThanOrEqual(4)
    await deleteTwo(served)
    await readsAreFine('latih_tubi in progress')
    for (const id of served.slice(0, 2)) {
      const r = await pupil.post(`/practice/sessions/${sid}/check-answer`, { questionId: id, selectedOptionId: 1 })
      expect(r.status, JSON.stringify(r.body)).toBe(422)
      expect(r.body.error.code).toBe('VALIDATION_ERROR')
    }
    for (const id of served.slice(2, 4)) {
      const r = await pupil.post(`/practice/sessions/${sid}/check-answer`, { questionId: id, selectedOptionId: 1 })
      expect(r.status, JSON.stringify(r.body)).toBe(200)
      expect(r.body.data.isCorrect).toBe(true)
    }
    const sub = await pupil.post(`/practice/sessions/${sid}/submit`, { timeSpent: 30 })
    expect(sub.status, JSON.stringify(sub.body)).toBe(200)
    expect(sub.body.data.results.score).toBe(2)
    await readsAreFine('latih_tubi after submit')
  })

  it('ANSWERED THEN DELETED: two checked questions are deleted, a replayed check is 422, and submit regrades from the stored checks (200 with a score)', async () => {
    for (let i = 0; i < 6; i++) await mcq()
    const start = await startLatihTubi()
    expect(start.status, JSON.stringify(start.body)).toBe(201)
    const sid = start.body.data.sessionId as string
    const served = (start.body.data.questions as { id: string }[]).map((q) => q.id)
    // served[0] right (option 1 is the key), served[1] wrong, served[2] right; then the first two are deleted
    for (const [id, option, correct] of [[served[0]!, 1, true], [served[1]!, 0, false], [served[2]!, 1, true]] as const) {
      const r = await pupil.post(`/practice/sessions/${sid}/check-answer`, { questionId: id, selectedOptionId: option })
      expect(r.status, JSON.stringify(r.body)).toBe(200)
      expect(r.body.data.isCorrect).toBe(correct)
    }
    await deleteTwo(served)
    for (const id of served.slice(0, 2)) {
      const replay = await pupil.post(`/practice/sessions/${sid}/check-answer`, { questionId: id, selectedOptionId: 1 })
      expect(replay.status, JSON.stringify(replay.body)).toBe(422)
      expect(replay.body.error.code).toBe('VALIDATION_ERROR')
    }
    const sub = await pupil.post(`/practice/sessions/${sid}/submit`, { timeSpent: 30 })
    expect(sub.status, JSON.stringify(sub.body)).toBe(200)
    expect(sub.body.data.results.score).toBe(2) // the stored isCorrect of the checks: the deleted right answer still counts, the wrong one does not
    const late = await pupil.post(`/practice/sessions/${sid}/check-answer`, { questionId: served[0], selectedOptionId: 1 })
    expect(late.status).toBe(409)
    await readsAreFine('latih_tubi answered then deleted')
  })

  it('COMPLETED: the result and the history still render after the questions are deleted, and a second submit is 409', async () => {
    for (let i = 0; i < 6; i++) await mcq()
    const start = await startLatihTubi()
    expect(start.status, JSON.stringify(start.body)).toBe(201)
    const sid = start.body.data.sessionId as string
    const served = (start.body.data.questions as { id: string }[]).map((q) => q.id)
    for (const id of served.slice(0, 4)) expect((await pupil.post(`/practice/sessions/${sid}/check-answer`, { questionId: id, selectedOptionId: 1 })).status).toBe(200)
    const sub = await pupil.post(`/practice/sessions/${sid}/submit`, { timeSpent: 30 })
    expect(sub.status, JSON.stringify(sub.body)).toBe(200)
    const before = await pupil.get('/practice/sessions?modes=latih_tubi')
    expect(before.status).toBe(200)
    await deleteTwo(served)
    await readsAreFine('latih_tubi completed')
    const after = await pupil.get('/practice/sessions?modes=latih_tubi')
    expect(after.status).toBe(200)
    expect(JSON.stringify(after.body.data)).toBe(JSON.stringify(before.body.data)) // the completed session renders from its own snapshot, unchanged
    expect(JSON.stringify(after.body.data)).toContain(sid)
    const again = await pupil.post(`/practice/sessions/${sid}/submit`, { timeSpent: 30 })
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('ALREADY_SUBMITTED')
  })
})

describe('Kuiz (POST /bijak/kuiz/sessions)', () => {
  const startKuiz = () => pupil.post('/bijak/kuiz/sessions', { subject: 'MATH', count: 5 })

  it('IN PROGRESS: the deleted items cannot be checked (422), the others can (200), finish works (200), reads stay 200', async () => {
    for (let i = 0; i < 6; i++) await mcq()
    const start = await startKuiz()
    expect(start.status, JSON.stringify(start.body)).toBe(201)
    const sid = start.body.data.sessionId as string
    const items = start.body.data.items as { id: string; options: { id: string }[] }[]
    const served = items.map((i) => i.id.split(':')[0]!)
    expect(served.length).toBeGreaterThanOrEqual(4)
    await deleteTwo(served)
    await readsAreFine('kuiz in progress')
    for (const item of items.slice(0, 2)) {
      const r = await pupil.post(`/bijak/kuiz/sessions/${sid}/check`, { itemId: item.id, optionId: item.options[0]!.id })
      expect(r.status, JSON.stringify(r.body)).toBe(422)
      expect(r.body.error).toMatchObject({ code: 'VALIDATION_ERROR', fields: { itemId: 'Jawapan tidak sah.' } })
    }
    const ok = items[2]!
    const checked = await pupil.post(`/bijak/kuiz/sessions/${sid}/check`, { itemId: ok.id, optionId: ok.options[0]!.id })
    expect(checked.status, JSON.stringify(checked.body)).toBe(200)
    const fin = await pupil.post(`/bijak/kuiz/sessions/${sid}/finish`, { timeSpent: 30 })
    expect(fin.status, JSON.stringify(fin.body)).toBe(200)
    await readsAreFine('kuiz after finish')
  })

  it('ANSWERED THEN DELETED: two checked items are deleted, a replayed check is 422, and finish regrades from the stored checks (200 with a score)', async () => {
    for (let i = 0; i < 6; i++) await mcq()
    const start = await startKuiz()
    expect(start.status, JSON.stringify(start.body)).toBe(201)
    const sid = start.body.data.sessionId as string
    const items = start.body.data.items as { id: string; options: { id: string }[] }[]
    const served = items.map((i) => i.id.split(':')[0]!)
    const key = (item: { options: { id: string }[] }) => item.options.find((o) => o.id === 'B')?.id ?? item.options[1]!.id // option 2 is the key of the fixture questions
    const wrong = (item: { options: { id: string }[] }) => item.options.find((o) => o.id !== key(item))!.id
    for (const [item, option] of [[items[0]!, key(items[0]!)], [items[1]!, wrong(items[1]!)], [items[2]!, key(items[2]!)]] as const) {
      const r = await pupil.post(`/bijak/kuiz/sessions/${sid}/check`, { itemId: item.id, optionId: option })
      expect(r.status, JSON.stringify(r.body)).toBe(200)
    }
    await deleteTwo(served)
    for (const item of items.slice(0, 2)) {
      const replay = await pupil.post(`/bijak/kuiz/sessions/${sid}/check`, { itemId: item.id, optionId: item.options[0]!.id })
      expect(replay.status, JSON.stringify(replay.body)).toBe(422)
      expect(replay.body.error.code).toBe('VALIDATION_ERROR')
    }
    const fin = await pupil.post(`/bijak/kuiz/sessions/${sid}/finish`, { timeSpent: 30 })
    expect(fin.status, JSON.stringify(fin.body)).toBe(200)
    expect(JSON.stringify(fin.body.data)).toMatch(/"score":\s*2\b/)
    const late = await pupil.post(`/bijak/kuiz/sessions/${sid}/check`, { itemId: items[2]!.id, optionId: items[2]!.options[0]!.id })
    expect(late.status).toBe(409)
    await readsAreFine('kuiz answered then deleted')
  })

  it('COMPLETED: the history still renders after the questions are deleted; a second finish is 409', async () => {
    for (let i = 0; i < 6; i++) await mcq()
    const start = await startKuiz()
    expect(start.status, JSON.stringify(start.body)).toBe(201)
    const sid = start.body.data.sessionId as string
    const items = start.body.data.items as { id: string; options: { id: string }[] }[]
    const served = items.map((i) => i.id.split(':')[0]!)
    for (const item of items.slice(0, 3)) expect((await pupil.post(`/bijak/kuiz/sessions/${sid}/check`, { itemId: item.id, optionId: item.options[0]!.id })).status).toBe(200)
    expect((await pupil.post(`/bijak/kuiz/sessions/${sid}/finish`, { timeSpent: 30 })).status).toBe(200)
    const before = await pupil.get('/practice/sessions?modes=latih_tubi')
    await deleteTwo(served)
    await readsAreFine('kuiz completed')
    const after = await pupil.get('/practice/sessions?modes=latih_tubi')
    expect(after.status).toBe(200)
    expect(JSON.stringify(after.body.data)).toBe(JSON.stringify(before.body.data))
    const again = await pupil.post(`/bijak/kuiz/sessions/${sid}/finish`, { timeSpent: 30 })
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('ALREADY_SUBMITTED')
  })
})
