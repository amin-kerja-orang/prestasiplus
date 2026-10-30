import { describe, expect, it } from 'vitest'

import { Prisma } from '../../src/db/generated/client'
import { QUESTION_COUNT_SQL } from '../../src/modules/account/account-data.repository'
import { BoardReads } from '../../src/modules/command-center/board/reads'
import { CommandCenterRepository } from '../../src/modules/command-center/shared/command-center.repository'
import { CurriculumRepository } from '../../src/modules/curriculum/curriculum.repository'
import { CurriculumLearnerService } from '../../src/modules/curriculum/learner.service'
import { DEFAULT_MAP_GRADE, MAP_GRADES } from '../../src/modules/curriculum/rules'
import { OverviewRepository } from '../../src/modules/practice/reads/overview/overview.repository'

/**
 * Secondary-only (D72, OQ-06) for the read paths outside the question bank: learner topics and the learning map, the public and
 * practice question counts and the Command Center counts. No database: fake clients capture the SQL or the Prisma arguments.
 */
const PRIMARY = `el.stage = 'primary'`
const HIDDEN_PUPIL = `u.grade >= 7`

function rawClient(queries: string[]): { $queryRaw: (s: TemplateStringsArray, ...v: unknown[]) => Promise<unknown[]> } {
  return {
    $queryRaw: (strings, ...values) => {
      // Tagged template (`$queryRaw\`...\``) or a ready Prisma.Sql (`$queryRaw(sql)`).
      const sql = Array.isArray(strings) ? Prisma.sql(strings, ...values) : (strings as unknown as Prisma.Sql)
      // Bound values are rendered in place (each `?` placeholder becomes the JSON of its value), so a test can see the school types and dates.
      let next = 0
      queries.push(sql.sql.replace(/\?/g, () => JSON.stringify(sql.values[next++], (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v))))
      return Promise.resolve([])
    },
  }
}

describe('B-HTTP-01/02: learner topics and the learning map are Tingkatan only', () => {
  it('the map offers TINGKATAN_4 and TINGKATAN_5, default TINGKATAN_4', () => {
    expect([...MAP_GRADES]).toEqual(['TINGKATAN_4', 'TINGKATAN_5'])
    expect(DEFAULT_MAP_GRADE).toBe('TINGKATAN_4')
  })

  it('legacyTopics and legacyTopic use an allow-list of TINGKATAN_4 and TINGKATAN_5 (no grade asked is still T4/T5 only)', async () => {
    const calls: { where: Record<string, unknown> }[] = []
    const db = {
      legacyTopic: {
        findMany: (args: { where: Record<string, unknown> }) => (calls.push(args), Promise.resolve([])),
        findFirst: (args: { where: Record<string, unknown> }) => (calls.push(args), Promise.resolve(null)),
      },
    }
    const repo = new CurriculumRepository({ client: db } as never)
    await repo.legacyTopics({ gradeLevel: 'TINGKATAN_4', subject: 'MATEMATIK' })
    await repo.legacyTopics()
    await repo.legacyTopic(5n)
    expect(calls).toHaveLength(3)
    const allow = { gradeLevel: { in: ['TINGKATAN_4', 'TINGKATAN_5'] } }
    expect(calls[0]?.where).toMatchObject({ AND: [allow, { gradeLevel: 'TINGKATAN_4' }], subject: 'MATEMATIK' })
    expect(calls[1]?.where).toMatchObject({ AND: [allow] })
    expect((calls[1]?.where as { AND: unknown[] }).AND).toHaveLength(1)
    // Topic detail: a row outside the allow-list is not found (404 at the HTTP layer).
    expect(calls[2]?.where).toMatchObject({ id: 5n, ...allow })
  })

  const mapOf = async (grade: string | undefined) => {
    const asked: (string | null | undefined)[] = []
    const repo = { legacyTopics: (f: { gradeLevel?: string | null }) => (asked.push(f.gradeLevel), Promise.resolve([])) }
    const ports = { topicProgress: { topicProgress: () => Promise.resolve(new Map()) } }
    const svc = new CurriculumLearnerService(repo as never, ports as never)
    const map = await svc.learningMap({ subject: 'MATEMATIK', grade }, '1')
    return { map, asked }
  }

  it('honours TINGKATAN_5, defaults to TINGKATAN_4, and falls back to TINGKATAN_4 for a Darjah or unknown grade', async () => {
    expect((await mapOf('TINGKATAN_5')).map.grade).toBe('TINGKATAN_5')
    expect((await mapOf('TINGKATAN_4')).map.grade).toBe('TINGKATAN_4')
    expect((await mapOf(undefined)).map.grade).toBe('TINGKATAN_4')
    for (const g of ['DARJAH_4', 'DARJAH_1', 'TINGKATAN_1', 'nope']) {
      const { map, asked } = await mapOf(g)
      expect(map.grade).toBe('TINGKATAN_4')
      expect(asked).toEqual(['TINGKATAN_4'])
    }
    const { map } = await mapOf('TINGKATAN_5')
    expect(map.gradeOptions).toEqual(['TINGKATAN_4', 'TINGKATAN_5'])
    expect(map.gradeOptions.some((g) => g.startsWith('DARJAH_'))).toBe(false)
  })
})

describe('B-HTTP-03: every question count shown to users leaves out primary levels', () => {
  it('practice overview reads (bank matrix, newest mcq, chapter counts)', async () => {
    const queries: string[] = []
    const repo = new OverviewRepository({ client: rawClient(queries) } as never)
    await repo.bankMatrix()
    await repo.newestPublishedMcqIds(5)
    await repo.chapterQuestionCounts(['1', '2'])
    expect(queries).toHaveLength(3)
    for (const q of queries) {
      expect(q).toContain(PRIMARY)
      expect(q).toContain('pksk_domain') // the PKSK scope of the practice draws
    }
  })

  it('public platform question count follows the practice-draw rule', () => {
    expect(QUESTION_COUNT_SQL).toContain(PRIMARY)
    expect(QUESTION_COUNT_SQL).toContain('q.is_active')
    expect(QUESTION_COUNT_SQL).toContain(`v.status = 'published'`)
    expect(QUESTION_COUNT_SQL).toContain('pksk_domain')
    expect(QUESTION_COUNT_SQL).not.toContain('$')
  })

  it('the learner rule also hides inactive levels', () => {
    expect(QUESTION_COUNT_SQL).toContain('NOT el.is_active')
  })
})

describe('B-HTTP-05: Command Center counts leave out hidden schools and Darjah pupils', () => {
  it('student, school and subscription counts', async () => {
    const queries: string[] = []
    const repo = new CommandCenterRepository({ client: rawClient(queries) } as never, {} as never, {} as never)
    await repo.studentCount({})
    await repo.studentCount({ schoolId: '3' })
    await repo.studentsOfSchool('3')
    await repo.schoolsWithStudents()
    await repo.answerTally({ to: new Date('2026-10-30T00:00:00Z') })
    await repo.answerDays({ from: new Date('2026-10-01T00:00:00Z'), to: new Date('2026-10-30T00:00:00Z') })
    await repo.sessionTally({ from: new Date('2026-10-01T00:00:00Z'), to: new Date('2026-10-30T00:00:00Z') })
    await repo.subscribedSchoolCount(new Date('2026-10-30T00:00:00Z'))
    expect(queries).toHaveLength(8)
    for (const q of queries.slice(0, 7)) {
      expect(q).toContain(HIDDEN_PUPIL)
      expect(q).toContain(`"SK","SJK(C)","SJK(T)"`) // PRIMARY_SCHOOL_TYPES, bound
    }
    // "Sekolah Berdaftar" = schools with an active subscription: that count is unchanged (owner decision).
    expect(queries[7]).not.toContain(HIDDEN_PUPIL)
    expect(queries[7]).toContain('school_subscriptions')
  })

  it('live tallies and the computed engagement buckets', async () => {
    const queries: string[] = []
    const reads = new BoardReads({ client: rawClient(queries) } as never)
    const now = new Date('2026-10-19T01:00:00Z') // Mon 19 Oct 2026 09:00 MYT
    await reads.liveTallies({ now, todayFrom: now, weekFrom: now, lastWeekFrom: now, d30From: now })
    const bands = await reads.engagementBands(now)
    expect(bands).toEqual({ champion: 0, consistent: 0, developing: 0, minimum: 0, disengaged: 0 })
    expect(queries).toHaveLength(2)
    for (const q of queries) expect(q).toContain(HIDDEN_PUPIL)
  })

  it('engagement windows are the rolling Guru windows: 7 days = today minus 6, 30 days = today minus 29 (MYT), not the ISO week', async () => {
    const queries: string[] = []
    const reads = new BoardReads({ client: rawClient(queries) } as never)
    // Wednesday 21 Oct 2026 09:00 MYT: the ISO week would start Monday 19 Oct 00:00 MYT; the rolling window starts Thursday 15 Oct.
    await reads.engagementBands(new Date('2026-10-21T01:00:00Z'))
    const q = queries[0] as string
    expect(q).toContain('"2026-10-14T16:00:00.000Z"') // 15 Oct 00:00 MYT
    expect(q).toContain('"2026-09-21T16:00:00.000Z"') // 22 Sep 00:00 MYT = today minus 29
    expect(q).not.toContain('"2026-10-18T16:00:00.000Z"') // Monday 19 Oct 00:00 MYT (the ISO week start)
  })

  it('the engagement buckets use the shared engagementBand thresholds', async () => {
    const rows = [
      { d7: 5, d30: 9, pupils: 2 }, // champion
      { d7: 4, d30: 6, pupils: 3 }, // consistent
      { d7: 1, d30: 1, pupils: 4 }, // developing
      { d7: 0, d30: 2, pupils: 5 }, // minimum
      { d7: 0, d30: 0, pupils: 6 }, // disengaged
    ]
    const reads = new BoardReads({ client: { $queryRaw: () => Promise.resolve(rows) } } as never)
    expect(await reads.engagementBands(new Date('2026-10-19T01:00:00Z'))).toEqual({ champion: 2, consistent: 3, developing: 4, minimum: 5, disengaged: 6 })
  })
})
