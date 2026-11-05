import { describe, expect, it } from 'vitest'

import { Prisma } from '../../src/db/generated/client'
import { QUESTION_COUNT_SQL } from '../../src/modules/account/account-data.repository'
import { BoardReads } from '../../src/modules/command-center/board/reads'
import { CommandCenterRepository } from '../../src/modules/command-center/shared/command-center.repository'
import { CurriculumRepository } from '../../src/modules/curriculum/curriculum.repository'
import { CurriculumLearnerService } from '../../src/modules/curriculum/learner.service'
import { DEFAULT_MAP_GRADE } from '../../src/modules/curriculum/rules'
import { BankFacts } from '../../src/modules/practice/reads/overview/bank-facts'
import { OverviewRepository } from '../../src/modules/practice/reads/overview/overview.repository'
import { subjectView } from '../../src/modules/practice/reads/overview/overview.service'

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
  const levels = (codes: string[]) =>
    codes.map((code, i) => ({ id: String(i + 1), code, order: i + 1, gradeKey: `TINGKATAN_${code.slice(1)}` }))

  it('the default map grade stays TINGKATAN_4; the grade list is no constant (S4-T06)', () => {
    expect(DEFAULT_MAP_GRADE).toBe('TINGKATAN_4')
  })

  it('learnerChapters reads tree chapters of the given levels only, per call, and nothing for an empty level list', async () => {
    const calls: { where: Record<string, unknown> }[] = []
    const db = { chapter: { findMany: (args: { where: Record<string, unknown> }) => (calls.push(args), Promise.resolve([])) } }
    const repo = new CurriculumRepository({ client: db } as never)
    await repo.learnerChapters({ levelIds: [4n, 5n], subjectCodes: ['MATH'] })
    await repo.learnerChapters({ levelIds: [1n] })
    expect(await repo.learnerChapters({ levelIds: [] })).toEqual([])
    expect(calls).toHaveLength(2)
    expect(calls[0]?.where).toMatchObject({
      inTree: true,
      isActive: true,
      educationLevelId: { in: [4n, 5n] },
      subject: { isActive: true, code: { in: ['MATH'] } },
    })
    expect(calls[1]?.where).toMatchObject({ educationLevelId: { in: [1n] }, subject: { isActive: true } })
  })

  const mapOf = async (grade: string | undefined, offered = levels(['T1', 'T2', 'T3', 'T4', 'T5'])) => {
    const asked: bigint[][] = []
    const repo = {
      offeredLevels: () => Promise.resolve(offered),
      learnerChapters: (f: { levelIds: bigint[] }) => (asked.push(f.levelIds), Promise.resolve([])),
    }
    const ports = { topicProgress: { topicProgress: () => Promise.resolve(new Map()) } }
    const svc = new CurriculumLearnerService(repo as never, ports as never)
    const map = await svc.learningMap({ subject: 'MATEMATIK', grade }, '1')
    return { map, asked }
  }

  it('honours every offered grade (T1 to T5), defaults to TINGKATAN_4, and falls back to TINGKATAN_4 for a Darjah or unknown grade', async () => {
    for (const g of ['TINGKATAN_1', 'TINGKATAN_3', 'TINGKATAN_5']) {
      const { map, asked } = await mapOf(g)
      expect(map.grade).toBe(g)
      expect(asked).toEqual([[BigInt(g.slice(-1))]])
    }
    expect((await mapOf(undefined)).map.grade).toBe('TINGKATAN_4')
    for (const g of ['DARJAH_4', 'DARJAH_1', 'nope', 'tingkatan_5']) {
      const { map, asked } = await mapOf(g)
      expect(map.grade).toBe('TINGKATAN_4')
      expect(asked).toEqual([[4n]])
    }
    const { map } = await mapOf('TINGKATAN_5')
    expect(map.gradeOptions).toEqual(['TINGKATAN_1', 'TINGKATAN_2', 'TINGKATAN_3', 'TINGKATAN_4', 'TINGKATAN_5'])
    expect(map.gradeOptions.some((g) => g.startsWith('DARJAH_'))).toBe(false)
  })

  it('the grade list follows offeredLevels: a level that is no longer offered leaves the options and the map falls back', async () => {
    const { map } = await mapOf('TINGKATAN_5', levels(['T1', 'T2', 'T3', 'T4']))
    expect(map.gradeOptions).toEqual(['TINGKATAN_1', 'TINGKATAN_2', 'TINGKATAN_3', 'TINGKATAN_4'])
    expect(map.grade).toBe('TINGKATAN_4')
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
    expect(QUESTION_COUNT_SQL).toContain(`v.status = 'approved'`)
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

describe('B-HTTP-08: the subject card equals the sum of the subject detail (one practice-draw rule)', () => {
  // Cells of the grouped bank matrix: [subject, level, mcq, n]. Levels 7 and 8 are the offered T4 and T5; 9 is another Tingkatan.
  const cell = (subjectId: string | null, levelId: string | null, mcq: boolean, n: number) => ({ subjectId, levelId, tp: 1, mcq, n })
  const bank = new BankFacts([
    cell('1', '7', true, 30), cell('1', '8', true, 20),
    cell('1', '7', false, 4), // a structured question: counted in the bank, never drawn
    cell('1', '9', true, 3), // a level that is not offered
    cell('1', null, true, 2), // no level at all
    cell('2', '7', true, 5),
  ])
  const subject = { id: 1n, code: 'MATEMATIK', name: 'Matematik', nameEn: 'Mathematics', icon: null, color: '#000', isCore: true, educationLevelIds: [7n, 8n, 9n] }

  it('the card count is Q-PRACTICE over the offered levels, i.e. the sum of the per-level detail counts', () => {
    const offered = ['7', '8']
    const detailTotal = offered.reduce((n, l) => n + bank.practice('1', [l]), 0)
    const card = subjectView(subject as never, bank, offered)
    expect(detailTotal).toBe(50)
    expect(card.bankCount).toBe(detailTotal)
    expect(card.approvedCount).toBe(detailTotal)
    // The old card figure counted every cell of the subject (59), which is what disagreed with the detail page.
    expect(bank.count({ subjectId: '1' })).toBe(59)
  })

  it('the public count uses the same rule: mcq, learner-visible level, offered levels T4 and T5 only', () => {
    expect(QUESTION_COUNT_SQL).toContain("v.type = 'mcq'")
    expect(QUESTION_COUNT_SQL).toContain("ol.code IN ('T4', 'T5')")
    expect(QUESTION_COUNT_SQL).toContain(PRIMARY)
    // The card lists active subjects and offers the levels linked to the subject: the public count joins both, so it is the sum of the cards.
    expect(QUESTION_COUNT_SQL).toContain('sj.is_active')
    expect(QUESTION_COUNT_SQL).toContain('FROM subject_levels sl WHERE sl.subject_id = v.subject_id AND sl.education_level_id = v.education_level_id')
  })
})
