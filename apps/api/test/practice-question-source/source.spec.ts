import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { prngStream } from '../../src/db/prng'
import { PracticePorts } from '../../src/modules/practice'
import { Be09PracticeQuestionSource } from '../../src/modules/practice/question-bridge'
import { PkskQuestionsService, QuestionsService } from '../../src/modules/questions'
import { tagOf, type Tag } from '../questions/fixtures'
import { STUDENT_1, TEACHER_A, bootMissionsApp, client, loadWorld, type Client, type MissionsTestApp, type World } from '../missions/helpers'

/**
 * BE-12 x BE-09: the real application binds the practice question source to the question bank, so a
 * practice session starts with published questions (the demo blocker: before this every start was 422
 * NOT_ENOUGH_QUESTIONS). Every served id is checked against the bank's own eligibility rules.
 */

const START_URL = '/practice/sessions'
const SECRET_EXPLANATION = 'Penjelasan rahsia BE12 tidak boleh bocor'
/** Keys that must never appear anywhere in a start response (AC 4). */
const KEY_FIELDS = ['correctLabel', 'correctAnswer', 'correctOptionId', 'correct', 'explanation', 'key', 'isCorrect', 'answer', 'tfAnswer', 'modelAnswer']

function keysOf(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) for (const v of value) keysOf(v, out)
  else if (value !== null && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) {
      out.add(k)
      keysOf(v, out)
    }
  return out
}

interface Ctx {
  t: MissionsTestApp
  w: World
  s1: Client
  svc: QuestionsService
  source: Be09PracticeQuestionSource
  /** The primary level (D1..D4) offered to random sessions of the world's subject. */
  dLevel: string
  chapterId: string
}

let c: Ctx

async function mcq(over: { level?: string; tag?: Tag; text?: string; tp?: number; explanation?: string; correct?: number; publish?: boolean } = {}): Promise<string> {
  const { svc, w } = c
  const tag = over.tag ?? w.tag
  const q = await svc.create(
    {
      subjectId: tag.subjectId,
      educationLevelId: tag.levelId,
      difficultyLevel: over.tp ?? 3,
      questionText: over.text ?? 'Soalan BE-12: yang manakah jawapan yang betul?',
      questionType: 'mcq',
      options: ['Satu', 'Dua', 'Tiga', 'Empat'],
      correctAnswer: over.correct ?? 1,
      explanation: over.explanation ?? SECRET_EXPLANATION,
      tag: { unitId: tag.unitId, spIds: [tag.spId], tp: over.tp ?? 3 },
    } as never,
    { userId: w.admin, role: 'admin' },
  )
  if (over.publish !== false)
    for (const status of ['review', 'approved', 'published'] as const) await svc.bulkAction(status, [q.id], { userId: w.admin, role: 'admin' })
  // Test fixture only: move the version to another level (the tag stays the seeded T4 one).
  if (over.level) await c.t.db.query(`update question_versions set education_level_id = $2 where question_id = $1`, [q.id, over.level])
  return q.id
}

const pool = async (id: string): Promise<void> => {
  await c.t.db.query(`insert into question_tags (question_id, kind, code) values ($1, 'pool', 'past_year') on conflict do nothing`, [id])
}

const start = (body: Record<string, unknown>) => c.s1.post(START_URL, body)

beforeAll(async () => {
  const t = await bootMissionsApp({ full: true })
  const w = await loadWorld(t)
  await t.db.query(`insert into comp_students (user_id, package_expires_on) values ($1, '2027-12-31') on conflict do nothing`, [w.student1])
  const dLevel = (
    await t.db.query<{ id: string }>(
      `select l.id::text id from education_levels l join subject_levels sl on sl.education_level_id = l.id
        where sl.subject_id = $1 and l.code in ('D1','D2','D3','D4') order by l.sort_order, l.id limit 1`,
      [w.tag.subjectId],
    )
  )[0]?.id
  if (!dLevel) throw new Error('the world subject has no primary level')
  const chapterId = (
    await t.db.query<{ id: string }>(`select id::text id from chapters where subject_id = $1 and education_level_id = $2 and is_active order by id limit 1`, [w.tag.subjectId, dLevel])
  )[0]?.id
  if (!chapterId) throw new Error('no active chapter for the world subject at the primary level')
  c = {
    t,
    w,
    s1: await client(t, STUDENT_1),
    svc: t.get(QuestionsService),
    source: t.get(Be09PracticeQuestionSource),
    dLevel,
    chapterId,
  }
}, 180_000)

afterAll(async () => {
  await c.t.close()
})

describe('wiring', () => {
  it('the real application binds PracticePorts.questions to the BE-09 source (not the empty placeholder)', () => {
    expect(c.t.get(PracticePorts).questions).toBeInstanceOf(Be09PracticeQuestionSource)
  })
})

describe('random sessions start with published questions only', () => {
  let eligible: string[]
  let ineligible: Record<string, string>

  beforeAll(async () => {
    eligible = []
    for (let i = 0; i < 5; i++) eligible.push(await mcq({ level: c.dLevel, text: `Soalan rawak ${String(i)}` }))
    const deactivated = await mcq({ level: c.dLevel, text: 'Soalan nyahaktif' })
    await c.svc.deactivate(deactivated)
    const otherSubject = await tagOf(c.t.db, 'SEED-MCQ-SCI-T4')
    ineligible = {
      draft: await mcq({ level: c.dLevel, publish: false, text: 'Soalan draf' }),
      deactivated,
      otherLevel: await mcq({ text: 'Soalan tingkatan 4' }),
      otherSubject: await mcq({ level: c.dLevel, tag: otherSubject, text: 'Soalan subjek lain' }),
    }
  })

  it('the draw of the subject and level is exactly the eligible set', async () => {
    const ids = await c.source.sample({ subjectId: c.w.tag.subjectId, educationLevelIds: [c.dLevel] }, 1000, prngStream('t'))
    expect(new Set(ids)).toEqual(new Set(eligible))
    const live = await c.source.live(Object.values(ineligible))
    // Live is per id: the other-level and other-subject ones are eligible questions, just outside this draw.
    expect([...live.keys()].sort()).toEqual([ineligible.otherLevel, ineligible.otherSubject].sort())
    expect(live.has(ineligible.draft as string)).toBe(false)
    expect(live.has(ineligible.deactivated as string)).toBe(false)
  })

  it('POST /practice/sessions (random) is 201 with exactly the eligible questions and no answer key', async () => {
    const subjectCode = c.w.subjectCode
    const res = await start({ mode: 'random', subjectCode, levelId: c.dLevel, count: 5 })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const questions = res.body.data.questions as { id: string; options: unknown[]; questionText: string; contributor: unknown; hasDskp: boolean }[]
    expect(questions).toHaveLength(5)
    expect(new Set(questions.map((q) => q.id))).toEqual(new Set(eligible))
    for (const q of questions) expect(q.options).toHaveLength(4)
    const keys = keysOf(res.body.data)
    for (const k of KEY_FIELDS) expect(keys.has(k), `start response carries "${k}"`).toBe(false)
    expect(JSON.stringify(res.body)).not.toContain(SECRET_EXPLANATION)

    // The served version grades the answer (versions() pinned read): option index 1 is the key.
    const sessionId = res.body.data.sessionId as string
    const first = questions[0] as { id: string }
    const check = await c.s1.post(`${START_URL}/${sessionId}/check-answer`, { questionId: first.id, selectedOptionId: 1 })
    expect(check.status, JSON.stringify(check.body)).toBe(200)
    expect(check.body.data).toMatchObject({ isCorrect: true, correctOptionId: 1, explanation: SECRET_EXPLANATION })
  })

  it('too few eligible questions is still 422 NOT_ENOUGH_QUESTIONS', async () => {
    const res = await start({ mode: 'random', subjectCode: c.w.subjectCode, levelId: c.dLevel, count: 10 })
    expect(res.status, JSON.stringify(res.body)).toBe(422)
    expect(res.body.error.code).toBe('NOT_ENOUGH_QUESTIONS')
  })

  it('a deactivated or unpublished question is never served, over many draws', async () => {
    const bad = new Set([ineligible.draft, ineligible.deactivated, ineligible.otherLevel, ineligible.otherSubject])
    for (let seed = 0; seed < 20; seed++) {
      const ids = await c.source.sample({ subjectId: c.w.tag.subjectId, educationLevelIds: [c.dLevel] }, 5, prngStream(`s${String(seed)}`))
      expect(ids).toHaveLength(5)
      for (const id of ids) expect(bad.has(id)).toBe(false)
    }
  })
})

describe('filters, pinned versions and the contributor', () => {
  it('spmPool: past_year draws only pool questions, and the start is 201', async () => {
    const pooled: string[] = []
    for (let i = 0; i < 5; i++) {
      const id = await mcq({ text: `Soalan SPM ${String(i)}` })
      await pool(id)
      pooled.push(id)
    }
    const plain = await mcq({ text: 'Soalan bukan SPM' })
    const ids = await c.source.sample({ subjectId: c.w.tag.subjectId, spmPool: true }, 1000, prngStream('p'))
    expect(ids).not.toContain(plain)
    for (const id of pooled) expect(ids).toContain(id)
    const res = await start({ mode: 'past_year', subjectCode: c.w.subjectCode, count: 5 })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    for (const q of res.body.data.questions as { id: string }[]) expect(ids).toContain(q.id)
  })

  it('difficulty selects the TP (5 also takes TP 6)', async () => {
    const tp2 = await mcq({ level: c.dLevel, tp: 2, text: 'Soalan TP2' })
    const sub = { subjectId: c.w.tag.subjectId, educationLevelIds: [c.dLevel] }
    expect(await c.source.sample({ ...sub, difficulty: 2 }, 100, prngStream('d'))).toEqual([tp2])
    expect(await c.source.sample({ ...sub, difficulty: 4 }, 100, prngStream('d'))).toEqual([])
    const q = (await c.source.live([tp2])).get(tp2)
    expect(q?.difficulty).toBe(2)
    await c.svc.deactivate(tp2)
  })

  it('chapterQuestionIds lists the eligible chapter questions, and a chapter session starts', async () => {
    const a = await mcq({ level: c.dLevel, text: 'Soalan bab A' })
    const b = await mcq({ level: c.dLevel, text: 'Soalan bab B' })
    const hidden = await mcq({ level: c.dLevel, text: 'Soalan bab nyahaktif' })
    for (const id of [a, b, hidden]) await c.t.db.query(`update question_versions set chapter_id = $2 where question_id = $1`, [id, c.chapterId])
    await c.svc.deactivate(hidden)
    expect(await c.source.chapterQuestionIds(c.chapterId)).toEqual([a, b].sort((x, y) => (BigInt(x) < BigInt(y) ? -1 : 1)))
    expect((await c.source.live([a])).get(a)?.hasDskp).toBe(true)
    // Only this chapter has eligible questions, so it is the first practice chapter (BR-16: open).
    const res = await start({ mode: 'chapter', chapterId: c.chapterId, count: 5 })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect((res.body.data.questions as { id: string }[]).map((q) => q.id).sort()).toEqual([a, b].sort())
    for (const id of [a, b]) await c.svc.deactivate(id)
  })

  it('versions() is the exact served version; live() follows the republished one', async () => {
    const id = await mcq({ text: 'Teks asal versi satu' })
    const svc = c.svc
    const actor = { userId: c.w.admin, role: 'admin' } as const
    await svc.update(
      id,
      { subjectId: c.w.tag.subjectId, educationLevelId: c.w.tag.levelId, difficultyLevel: 3, questionText: 'Teks baharu versi dua', questionType: 'mcq', options: ['Satu', 'Dua', 'Tiga', 'Empat'], correctAnswer: 2, tag: { unitId: c.w.tag.unitId, spIds: [c.w.tag.spId], tp: 3 } } as never,
      actor,
    )
    for (const status of ['review', 'approved', 'published'] as const) await svc.bulkAction(status, [id], actor)
    const pinned = await c.source.versions([{ questionId: id, versionNo: 1 }, { questionId: id, versionNo: 2 }, { questionId: id, versionNo: 99 }])
    expect(pinned.get(`${id}@1`)).toMatchObject({ versionNo: 1, questionText: 'Teks asal versi satu', correctLabel: 'B' })
    expect(pinned.get(`${id}@2`)).toMatchObject({ versionNo: 2, questionText: 'Teks baharu versi dua', correctLabel: 'C' })
    expect(pinned.has(`${id}@99`)).toBe(false)
    expect((await c.source.live([id])).get(id)?.versionNo).toBe(2)
    // A deactivated question is not live any more, but its served version still grades (AC 11).
    await svc.deactivate(id)
    expect((await c.source.live([id])).size).toBe(0)
    expect((await c.source.versions([{ questionId: id, versionNo: 1 }])).size).toBe(1)
  })

  it('a stimulus-group MCQ (seeded) is never served: the practice screen cannot show its stimulus', async () => {
    const grouped = (await c.t.db.query<{ id: string }>(`select question_id::text id from question_versions where number_label = 'SEED-GRP-PASAR-1'`))[0]?.id as string
    expect((await c.source.live([grouped])).size).toBe(0)
    const subject = (await c.t.db.query<{ id: string }>(`select subject_id::text id from question_versions where number_label = 'SEED-GRP-PASAR-1'`))[0]?.id as string
    expect(await c.source.sample({ subjectId: subject }, 1000, prngStream('g'))).not.toContain(grouped)
  })

  it('contributor: a teacher creator is "Soalan oleh:" with a null profileUrl; an admin creator is null', async () => {
    const byTeacher = await mcq({ text: 'Soalan guru' })
    const teacherId = (await c.t.db.query<{ id: string }>(`select id::text id from users where lower(email) = lower($1)`, [TEACHER_A]))[0]?.id as string
    await c.t.db.query(`update questions set created_by_id = $2 where id = $1`, [byTeacher, teacherId])
    const byAdmin = await mcq({ text: 'Soalan admin' })
    const live = await c.source.live([byTeacher, byAdmin])
    const name = (await c.t.db.query<{ name: string }>(`select name from users where id = $1`, [teacherId]))[0]?.name
    expect(live.get(byTeacher)?.contributor).toEqual({ name, profileUrl: null })
    expect(live.get(byAdmin)?.contributor).toBeNull()
    for (const id of [byTeacher, byAdmin]) await c.svc.deactivate(id)
  })

  it('bad ids and an empty selection never reach the bank', async () => {
    expect((await c.source.live(['abc', '-1', ''])).size).toBe(0)
    expect((await c.source.versions([{ questionId: 'x', versionNo: 1 }, { questionId: '1', versionNo: 0 }])).size).toBe(0)
    expect(await c.source.chapterQuestionIds('nope')).toEqual([])
    expect(await c.source.sample({ subjectId: c.w.tag.subjectId, educationLevelIds: [] }, 5, prngStream('e'))).toEqual([])
    expect(await c.source.sample({ subjectId: c.w.tag.subjectId }, 0, prngStream('e'))).toEqual([])
  })
})

describe('PKSK questions are never drawn (BE-42 scope, G4 nit 4 of #92)', () => {
  it('sample, chapterQuestionIds, live and versions never return a question tagged pksk_domain, while the normal question is served', async () => {
    const normal = await mcq({ level: c.dLevel, text: 'Soalan biasa bersebelahan PKSK' })
    // (a) a real PKSK question written by the PKSK service (approved = live; it carries no curriculum subject).
    const adminId = c.w.admin
    const real = await c.t.get(PkskQuestionsService).create(
      {
        domainCode: 'PKSK_MATH',
        targetLevel: 'T1',
        status: 'approved',
        questionText: 'Soalan PKSK tidak boleh keluar dalam latihan',
        difficultyLevel: 3,
        explanation: null,
        options: [{ text: 'a', isCorrect: true }, { text: 'b', isCorrect: false }, { text: 'c', isCorrect: false }],
      },
      adminId,
    )
    // (b) the hostile case: an otherwise eligible question (same subject, level and chapter as the normal one) that carries the PKSK domain tag.
    const tagged = await mcq({ level: c.dLevel, text: 'Soalan biasa bertanda PKSK' })
    await c.t.db.query(`insert into question_tags (question_id, kind, code) values ($1, 'pksk_domain', 'PKSK_MATH'), ($1, 'pksk_level', 'T1') on conflict do nothing`, [tagged])
    for (const id of [normal, tagged]) await c.t.db.query(`update question_versions set chapter_id = $2 where question_id = $1`, [id, c.chapterId])

    const filter = { subjectId: c.w.tag.subjectId, educationLevelIds: [c.dLevel] }
    // n well above the pool size, and several streams: every shuffle order is covered.
    for (const seed of ['p1', 'p2', 'p3', 'p4', 'p5']) {
      const drawn = await c.source.sample(filter, 100_000, prngStream(seed))
      expect(drawn, `seed ${seed}`).toContain(normal)
      expect(drawn, `seed ${seed}`).not.toContain(real.id)
      expect(drawn, `seed ${seed}`).not.toContain(tagged)
    }
    // The chapter listing (same chapter for the normal and the tagged question).
    const chapterIds = await c.source.chapterQuestionIds(c.chapterId)
    expect(chapterIds).toContain(normal)
    expect(chapterIds).not.toContain(real.id)
    expect(chapterIds).not.toContain(tagged)

    const live = await c.source.live([normal, real.id, tagged])
    expect([...live.keys()]).toEqual([normal])
    // `versions` is the pinned grading read (OD-28, see the source's doc): it returns the exact served version
    // without re-checking eligibility, so it is not a serving path and is not asserted here.
    const versions = await c.source.versions([normal].map((questionId) => ({ questionId, versionNo: 1 })))
    expect([...versions.keys()]).toEqual([normal])

    await c.svc.deactivate(normal)
    await c.svc.deactivate(tagged)
  })
})
