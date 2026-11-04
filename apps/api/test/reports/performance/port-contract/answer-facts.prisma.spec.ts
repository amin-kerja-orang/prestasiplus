import { afterAll, beforeAll } from 'vitest'

import { PracticeReadsModule } from '../../../../src/modules/practice/reads'
import { PerformancePorts } from '../../../../src/modules/reports/performance'
import type { AnswerFactsPort, AnswerFactsQuery } from '../../../../src/modules/reports/performance/ports'
import { bootIntegrationApp, type IntegrationApp } from '../../../bijak-integration/helpers'
import { describeAnswerFactsPort, type AnswerFactsSeed } from './answer-facts.contract'

/**
 * Runs the AnswerFactsPort contract against the REAL adapter (`AnswerFactsAdapter`, bound by `PracticeReadsModule`
 * into `PerformancePorts.provideAnswerFacts`) on a migrated, seeded test database. Needs a database:
 * `npm run be:test -- test/reports/performance/port-contract/answer-facts.prisma.spec.ts`.
 *
 * Like the practice-read spec, the contract speaks in made-up ids; `translating` creates real rows for a seed and
 * wraps the real port so ids go in as seed ids and come out as seed ids again.
 *
 * S5-T15: `practice_answers.mode` does not exist yet, so the adapter reads the session's mode, and the session
 * check only allows the legacy modes. `MODE_IN` maps the contract's modes onto allowed session modes and back; drop
 * it (and set `sessionlessMode: true`) when migration 0181 is merged.
 */
let t: IntegrationApp
let real: AnswerFactsPort
let counter = 0
let subjects: string[] = []
let levels: Record<string, string> = {}

const MODE_IN: Record<string, string> = { latih_tubi: 'latih_tubi', simulasi: 'chapter', battle: 'revision' }
const MODE_OUT = Object.fromEntries(Object.entries(MODE_IN).map(([k, v]) => [v, k]))

beforeAll(async () => {
  t = await bootIntegrationApp({ extraModules: [PracticeReadsModule] })
  real = t.app.get(PerformancePorts).answerFacts
  subjects = (await t.db.query<{ id: string }>(`select id::text from subjects order by id limit 2`)).map((r) => r.id)
  const lv = await t.db.query<{ id: string; code: string }>(`select id::text, code from education_levels where code in ('T4','T5')`)
  levels = Object.fromEntries(lv.map((l) => [l.code.toLowerCase(), l.id]))
})
afterAll(async () => {
  await t.close()
})

async function translating(seed: AnswerFactsSeed): Promise<AnswerFactsPort> {
  counter += 1
  await t.db.query('delete from practice_answers')
  await t.db.query('delete from practice_sessions')
  const schoolOf = new Map<string, string>()
  for (const s of [...new Set(seed.pupils.map((p) => p.schoolId))]) {
    const [row] = await t.db.query<{ id: string }>(`insert into schools (name, code, state, district) values ($1, $2, 'Negeri A', 'Daerah A') returning id::text`, [`Sekolah ${s} ${counter}`, `AF${counter}${s}`.toUpperCase()])
    schoolOf.set(s, row!.id)
  }
  const userOf = new Map<string, string>()
  for (const p of seed.pupils) {
    const [row] = await t.db.query<{ id: string }>(`insert into users (name, email, school_id, is_active) values ($1, $2, $3::bigint, true) returning id::text`, [`Murid ${p.id}`, `af${counter}u${p.id}@demo.test`, schoolOf.get(p.schoolId)!])
    userOf.set(p.id, row!.id)
  }
  const classOf = new Map<string, string>()
  for (const p of seed.pupils) {
    for (const c of p.classroomIds) {
      if (!classOf.has(c)) {
        const [row] = await t.db.query<{ id: string }>(
          `insert into classrooms (name, school_id, education_level_id, academic_year) values ($1, $2::bigint, $3::bigint, 2026) returning id::text`,
          [`Kelas ${c} ${counter}`, schoolOf.get(p.schoolId)!, levels.t4!],
        )
        classOf.set(c, row!.id)
      }
      await t.db.query(`insert into enrolments (classroom_id, student_id) values ($1::bigint, $2::bigint)`, [classOf.get(c)!, userOf.get(p.id)!])
    }
  }
  const subjectOf = (id: string): string => subjects[Number(id) - 1]!
  const chapterOf = new Map<string, string>()
  for (const c of seed.chapters) {
    const [row] = await t.db.query<{ id: string }>(
      `insert into chapters (subject_id, education_level_id, name, dskp_code, in_tree) values ($1::bigint, $2::bigint, $3, $4, $5) returning id::text`,
      [subjectOf(c.subjectId), c.levelCode === null ? null : levels[c.levelCode]!, c.name, c.dskpCode, c.levelCode !== null],
    )
    chapterOf.set(c.id, row!.id)
  }
  const topicOf = new Map<string, string>()
  for (const tp of seed.topics) {
    const [row] = await t.db.query<{ id: string }>(`insert into topics (chapter_id, name) values ($1::bigint, $2) returning id::text`, [chapterOf.get(tp.chapterId)!, tp.name])
    topicOf.set(tp.id, row!.id)
  }
  const sessionOf = new Map<string, string>()
  for (const a of seed.answers) {
    if (a.sessionId === undefined || sessionOf.has(a.sessionId)) continue
    const [row] = await t.db.query<{ id: string }>(
      `insert into practice_sessions (user_id, mode, question_count, status, started_at, completed_at, is_test) values ($1::bigint, $2, 1, 'completed', $3::timestamptz, $3::timestamptz, false) returning id::text`,
      [userOf.get(a.userId)!, MODE_IN[a.mode] ?? a.mode, a.answeredAt.toISOString()],
    )
    sessionOf.set(a.sessionId, row!.id)
  }
  for (const a of seed.answers) {
    await t.db.query(
      `insert into practice_answers (session_id, user_id, question_id, subject_id, education_level_id, chapter_id, topic_id, is_correct, answered_at, is_test)
       values ($1::uuid, $2::bigint, $3::bigint, $4::bigint, $5::bigint, $6::bigint, $7::bigint, $8, $9::timestamptz, $10)`,
      [
        a.sessionId === undefined ? null : sessionOf.get(a.sessionId)!,
        userOf.get(a.userId)!,
        a.questionId,
        subjectOf(a.subjectId),
        a.levelCode === undefined ? null : levels[a.levelCode]!,
        a.chapterId === undefined ? null : chapterOf.get(a.chapterId)!,
        a.topicId === undefined ? null : topicOf.get(a.topicId)!,
        a.isCorrect,
        a.answeredAt.toISOString(),
        a.isTest === true,
      ],
    )
  }
  const back = (m: Map<string, string>): Map<string, string> => new Map([...m].map(([k, v]) => [v, k]))
  const userBack = back(userOf)
  const subjectBack = new Map(subjects.map((s, i) => [s, String(i + 1)]))
  const chapterBack = back(chapterOf)
  const topicBack = back(topicOf)
  const scope = (q: AnswerFactsQuery): AnswerFactsQuery => ({
    ...q,
    ...(q.userIds ? { userIds: q.userIds.map((u) => userOf.get(u) ?? '0') } : {}),
    ...(q.schoolIds ? { schoolIds: q.schoolIds.map((s) => schoolOf.get(s) ?? '0') } : {}),
    ...(q.classroomId !== undefined ? { classroomId: classOf.get(q.classroomId) ?? '0' } : {}),
    ...(q.subjectId !== undefined ? { subjectId: subjectOf(q.subjectId) } : {}),
    ...(q.modes ? { modes: q.modes.map((m) => MODE_IN[m] ?? m) } : {}),
  })
  return {
    answerFacts: async (q) =>
      (await real.answerFacts(scope(q))).map((r) => ({
        ...r,
        userId: userBack.get(r.userId)!,
        subjectId: subjectBack.get(r.subjectId) ?? r.subjectId,
        chapterId: r.chapterId === null ? null : chapterBack.get(r.chapterId)!,
        topicId: r.topicId === null ? null : topicBack.get(r.topicId)!,
        mode: MODE_OUT[r.mode] ?? r.mode,
      })),
    weeklyFacts: async (q) => (await real.weeklyFacts(scope(q))).map((r) => ({ ...r, userId: userBack.get(r.userId)! })),
    spInfo: async (q) =>
      (await real.spInfo({ topicIds: q.topicIds.map((x) => topicOf.get(x) ?? '0'), chapterIds: q.chapterIds.map((x) => chapterOf.get(x) ?? '0') })).map((r) => ({
        ...r,
        id: (r.kind === 'topic' ? topicBack : chapterBack).get(r.id)!,
      })),
  }
}

describeAnswerFactsPort('AnswerFactsAdapter (Prisma)', translating, { sessionlessMode: false })
