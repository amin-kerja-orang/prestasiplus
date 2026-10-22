import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PerformancePorts } from '../../../../src/modules/reports/performance'
import type {
  BijakAggregatePort,
  BijakItemFact,
  BijakItemQuery,
  BijakSittingFact,
  BijakSittingQuery,
  BijakTotals,
} from '../../../../src/modules/reports/performance/ports'
import { bootIntegrationApp, type IntegrationApp } from '../../../bijak-integration/helpers'
import { describeBijakAggregatePort, type BijakSeed } from './bijak-aggregate.contract'

/**
 * Runs the BijakAggregatePort contract against the REAL adapter (`PrismaBijakAggregate`, bound by
 * `BijakIntegrationModule` into `PerformancePorts`) on a migrated, seeded test database.
 *
 * The contract speaks in made-up ids ('1', 'x1', 's2', subject '1'); the database has bigint / uuid ids.
 * `translating` creates real rows for a seed, then wraps the real port so ids go in as seed ids and come
 * out as seed ids again. Nothing else is rewritten, so the assertions still test the adapter.
 */
let t: IntegrationApp
let real: BijakAggregatePort
let bankQuestionId: string
let counter = 0

const UNMAPPED = 'unmapped'

beforeAll(async () => {
  t = await bootIntegrationApp()
  real = t.app.get(PerformancePorts).bijak
  const [q] = await t.db.query<{ id: string }>(`select question_id::text as id from question_versions where number_label = 'SEED-MCQ-MATH-T4'`)
  bankQuestionId = q!.id
})
afterAll(async () => {
  await t.close()
})

const byNumber = (a: string, b: string): number => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0)

async function translating(seed: BijakSeed): Promise<BijakAggregatePort> {
  counter += 1
  await t.db.query('delete from exam_attempts') // results cascade; users and schools of earlier seeds stay, unused
  const seedUsers = new Map<string, string | null>() // seed user -> seed school
  for (const { fact } of seed.sittings) if (!seedUsers.has(fact.userId)) seedUsers.set(fact.userId, fact.schoolId)

  // Created in seed-id order so real ids keep the order the contract expects.
  const schoolOf = new Map<string, string>() // seed school -> real id
  for (const s of [...new Set([...seedUsers.values()].filter((v): v is string => v !== null))].sort(byNumber)) {
    const [row] = await t.db.query<{ id: string }>(
      `insert into schools (name, code, state, district) values ($1, $2, 'Negeri Ujian', 'Daerah Ujian') returning id::text`,
      [`Sekolah ${s} ${counter}`, `PC${counter}${s}`.toUpperCase()],
    )
    schoolOf.set(s, row!.id)
  }
  const userOf = new Map<string, string>() // seed user -> real id
  for (const u of [...seedUsers.keys()].sort(byNumber)) {
    const school = seedUsers.get(u)
    const [row] = await t.db.query<{ id: string }>(`insert into users (name, email, school_id) values ($1, $2, $3::bigint) returning id::text`, [
      `Murid ${u}`,
      `pc${counter}-${u}@demo.test`,
      school ? schoolOf.get(school)! : null,
    ])
    userOf.set(u, row!.id)
  }

  const attemptOf = new Map<string, string>() // seed attempt -> real uuid
  const itemsOf = (attemptId: string) => seed.items.filter((i) => i.attemptId === attemptId)
  for (const { fact, isTest, state } of seed.sittings) {
    const status = state === 'abandoned' ? 'abandoned' : state === 'in_progress' ? 'in_progress' : fact.status
    const submitted = status === 'in_progress' ? null : fact.submittedAt
    const started = new Date(fact.submittedAt.getTime() - fact.durationSeconds * 1000)
    const [a] = await t.db.query<{ id: string }>(
      `insert into exam_attempts (user_id, paper_kind, title, subject, subject_name, kertas, paper_code, mode, status, started_at, duration_min, submitted_at, is_test)
       values ($1::bigint, $2, 'Kertas ujian', $3, $4, 1, 'UJ/1', $5, $6, $7, 60, $8, $9) returning id::text`,
      [userOf.get(fact.userId), fact.paperKind, fact.subjectCode, fact.subjectName, fact.mode, status, started, submitted, isTest === true],
    )
    attemptOf.set(fact.attemptId, a!.id)
    const questions = itemsOf(fact.attemptId).map((i, n) => ({
      questionId: bankQuestionId,
      number: n + 1,
      sectionId: 's',
      marks: i.max,
      awarded: i.awarded,
      counted: true,
      attempted: i.chosenLetter !== null,
      parts: [
        {
          partId: bankQuestionId,
          label: '',
          prompt: i.stem,
          marks: i.max,
          awarded: i.awarded,
          status: i.awarded === i.max ? 'betul' : 'salah',
          confidence: 'high',
          points: [],
          answer: i.chosenLetter === null ? {} : { choice: i.chosenLetter },
          scheme: { marks: i.max, correctOption: i.correctLetter },
        },
      ],
    }))
    // Answered questions beyond the item rows: parts-less filler questions (never an item fact) reach `answeredCount`.
    const attemptedItems = questions.filter((qq) => qq.attempted).length
    for (let n = attemptedItems; n < fact.answeredCount; n++) {
      questions.push({ questionId: `filler-${String(n)}`, number: questions.length + 1, sectionId: 's', marks: 1, awarded: 0, counted: true, attempted: true, parts: [] } as never)
    }
    if (status === 'submitted' || status === 'auto_submitted' || state === 'abandoned' || isTest === true) {
      await t.db.query(
        `insert into attempt_results (attempt_id, score, max_score, provisional, pending_review, graded) values ($1::uuid, $2, $3, $4, $5, $6::jsonb)`,
        [a!.id, fact.score, fact.maxScore, fact.provisional, fact.pendingReview, JSON.stringify({ sections: [], questions })],
      )
    }
  }

  const seedSubject = new Map<string, string>() // subject code -> seed subject id
  for (const { fact } of seed.sittings) seedSubject.set(fact.subjectCode, fact.subjectId)
  const codeOfSubject = (id: string) => [...seedSubject].find(([, v]) => v === id)?.[0] ?? UNMAPPED
  const inv = (m: Map<string, string>) => new Map([...m].map(([k, v]) => [v, k]))
  const seedUser = inv(userOf)
  const seedSchool = inv(schoolOf)
  const seedAttempt = inv(attemptOf)

  const list = (ids: readonly string[] | undefined, m: Map<string, string>) => ids?.map((i) => m.get(i) ?? UNMAPPED)
  const q = <T extends BijakSittingQuery | BijakItemQuery>(query: T): T => {
    const out = { ...query } as T
    if (query.userIds) out.userIds = list(query.userIds, userOf)!
    if (query.schoolIds) out.schoolIds = list(query.schoolIds, schoolOf)!
    if (query.subjectId !== undefined) out.subjectId = codeOfSubject(query.subjectId)
    if ('questionIds' in query && query.questionIds) (out as BijakItemQuery).questionIds = query.questionIds.map((id) => (id === '7' ? bankQuestionId : UNMAPPED))
    return out
  }
  const subj = (code: string) => seedSubject.get(code) ?? code

  return {
    async sittings(query): Promise<BijakSittingFact[]> {
      return (await real.sittings(q(query))).map((s) => ({
        ...s,
        attemptId: seedAttempt.get(s.attemptId) ?? s.attemptId,
        userId: seedUser.get(s.userId) ?? s.userId,
        schoolId: s.schoolId === null ? null : (seedSchool.get(s.schoolId) ?? s.schoolId),
        subjectId: subj(s.subjectId),
      }))
    },
    async totals(query, groupBy): Promise<BijakTotals[]> {
      return (await real.totals(q(query), groupBy)).map((r) => ({
        ...r,
        ...(r.userId !== undefined ? { userId: seedUser.get(r.userId) ?? r.userId } : {}),
        ...(r.subjectId !== undefined ? { subjectId: subj(r.subjectId) } : {}),
        ...(r.schoolId !== undefined ? { schoolId: r.schoolId === '' ? '' : (seedSchool.get(r.schoolId) ?? r.schoolId) } : {}),
      }))
    },
    async items(query): Promise<BijakItemFact[]> {
      return (await real.items(q(query))).map((i) => ({
        ...i,
        attemptId: seedAttempt.get(i.attemptId) ?? i.attemptId,
        userId: seedUser.get(i.userId) ?? i.userId,
        schoolId: i.schoolId === null ? null : (seedSchool.get(i.schoolId) ?? i.schoolId),
        questionId: i.questionId === bankQuestionId ? '7' : i.questionId,
        subjectId: subj(i.subjectId),
      }))
    },
  }
}

describeBijakAggregatePort('PrismaBijakAggregate (real DB)', translating)

describe('PrismaBijakAggregate wiring and item facts', () => {
  it('BijakIntegrationModule bound the real adapter into PerformancePorts', () => {
    expect(real.constructor.name).toBe('PrismaBijakAggregate')
  })

  it('items carry the pupil choice and correct letter from the result, and stem, options and topic from the bank', async () => {
    const seed: BijakSeed = {
      sittings: [{ fact: { ...(await import('../fakes/fixtures')).sitting({ userId: '1', attemptId: 'z1' }) } }],
      items: [(await import('../fakes/fixtures')).item({ attemptId: 'z1', userId: '1', questionId: '7', chosenLetter: 'C', correctLetter: 'B', awarded: 0, max: 1 })],
    }
    const port = await translating(seed)
    const [row] = await port.items({})
    expect(row).toMatchObject({ attemptId: 'z1', userId: '1', questionId: '7', chosenLetter: 'C', correctLetter: 'B', awarded: 0, max: 1, subtopic: null })
    expect(row!.stem).toContain('kuadratik')
    expect(row!.options.map((o) => o.letter)).toEqual(['A', 'B', 'C', 'D'])
    expect(row!.questionVersion).toBeGreaterThanOrEqual(1)
  })
})
