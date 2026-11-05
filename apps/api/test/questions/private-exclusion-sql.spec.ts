import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { Prisma } from '../../src/db/generated/client'
import { QUESTION_COUNT_SQL } from '../../src/modules/account/account-data.repository'
import { TeacherQuestionStatsProvider } from '../../src/modules/classes/question-bridge/teacher-question-stats.provider'
import { PracticeAnalyticsRepository } from '../../src/modules/practice/reads/analytics/analytics.repository'
import { OverviewRepository } from '../../src/modules/practice/reads/overview/overview.repository'
import { StructuredListingRepository } from '../../src/modules/practice/reads/writes/listing.repository'
import { QuestionsBijakPoolSource } from '../../src/modules/questions/bijak-pool'
import { BANK_VISIBLE_SQL } from '../../src/modules/questions/learner-visibility'
import { QuestionsRepository } from '../../src/modules/questions/questions.repository'
import { QuestionsService } from '../../src/modules/questions/questions.service'
import { databankLaneConds, janaEligibleScope } from '../../src/modules/questions/serving/filters'
import { AnalyticsRepository } from '../../src/modules/reports/analytics/analytics.repository'

/**
 * S6-T16 (DM-42): a teacher's personal question (`question_versions.visibility = 'teacher_private'`) is excluded from every
 * served or counted read of the bank. No database: a fake client captures the SQL each read sends, and a source check proves the
 * remaining files (exam builder sources, pupil image rule) carry the same predicate. The DB twin is `private-exclusion.spec.ts`.
 */
const BANK = `v.visibility = 'bank'`

function capture(): { sqls: string[]; prisma: never } {
  const sqls: string[] = []
  const client = new Proxy(
    {
      $queryRaw: (strings: TemplateStringsArray | Prisma.Sql, ...values: unknown[]) => {
        const sql = Array.isArray(strings) ? Prisma.sql(strings as TemplateStringsArray, ...values) : (strings as unknown as Prisma.Sql)
        sqls.push(sql.sql)
        return Promise.resolve([])
      },
    },
    { get: (target, key) => (key in target ? (target as Record<PropertyKey, unknown>)[key] : { findMany: () => Promise.resolve([]), count: () => Promise.resolve(0) }) },
  )
  return { sqls, prisma: { client } as never }
}

const run = async (...calls: (() => Promise<unknown>)[]): Promise<void> => {
  for (const c of calls) await c().catch(() => undefined)
}

describe('DM-42: the shared predicate', () => {
  it('is the literal text v.visibility = bank (no bound value, partial indexes and static-text specs keep working)', () => {
    expect(BANK_VISIBLE_SQL.sql).toBe(BANK)
    expect(BANK_VISIBLE_SQL.values).toEqual([])
  })
})

describe('DM-42: private questions are absent from the S1 reads', () => {
  it('QuestionsRepository.scope: count, groupCount, eligible*, sampleIds, sample (Latih Tubi, Databank, pickers)', async () => {
    const { sqls, prisma } = capture()
    const repo = new QuestionsRepository(prisma)
    const f = { status: 'approved', active: true } as const
    await run(
      () => repo.count({}),
      () => repo.count(f),
      () => repo.groupCount('subject', f),
      () => repo.groupCountsByLevelTp(f),
      () => repo.eligibleIds(f),
      () => repo.eligibleIdsPage(f, undefined, 10),
      () => repo.eligibleAmong(['1', '2'], f),
      () => repo.sampleIds(f, 3, 1),
    )
    expect(sqls.length).toBeGreaterThanOrEqual(8)
    for (const s of sqls) expect(s).toContain(BANK)
    expect(repo.scopeSql(f, true).where.sql).toContain(BANK)
  })

  it('the Studio list (API-Q-01), its bulk targets and keysets, the own list, the structured list and the whole-store counts', async () => {
    const { sqls, prisma } = capture()
    const repo = new QuestionsRepository(prisma)
    const page = { page: 1, pageSize: 10 } as never
    await run(
      () => repo.listIds(page),
      () => repo.listIdsKeyset({} as never, undefined, 10),
      () => repo.filterTargets({} as never, ['review'], 10),
      () => repo.listOwn({ ownerId: '7', page: 1, pageSize: 10 }),
      () => repo.ownerStatusCounts('7'),
      () => repo.subjectTotals(),
      () => repo.structuredStats(),
    )
    expect(sqls.length).toBeGreaterThanOrEqual(7)
    for (const s of sqls.filter((x) => x.includes('latest_version_no') && !x.includes('education_levels WHERE stage'))) expect(s).toContain(BANK)
  })

  it('Databank lane, Jana scope and the Bijak pool', async () => {
    expect(Prisma.join(databankLaneConds(), ' AND ').sql).toContain(BANK)
    expect(janaEligibleScope().where.sql).toContain(BANK)
    const { sqls, prisma } = capture()
    await run(() => new QuestionsBijakPoolSource(prisma).candidatesOf('5'))
    expect(sqls).toHaveLength(1)
    expect(sqls[0]).toContain(BANK)
  })
})

describe('DM-42: private questions are absent from the counts and reports of other sectors', () => {
  it('S5 practice overview (bank matrix, newest mcq, chapter counts), Selesai listing, revision queue and the public count', async () => {
    const o = capture()
    const overview = new OverviewRepository(o.prisma)
    await run(
      () => overview.bankMatrix(),
      () => overview.newestPublishedMcqIds(5),
      () => overview.chapterQuestionCounts(['1', '2']),
    )
    expect(o.sqls).toHaveLength(3)
    for (const s of o.sqls) expect(s).toContain(BANK)

    const l = capture()
    await run(() => new StructuredListingRepository(l.prisma).page({ levelIds: ['1'], subjectIds: null, subjectOrder: false, kbat: null, limit: 10, offset: 0 } as never))
    expect(l.sqls).toHaveLength(2)
    for (const s of l.sqls) expect(s).toContain(BANK)

    const a = capture()
    await run(() => new PracticeAnalyticsRepository(a.prisma).eligibleQueueBySubject('3'))
    expect(a.sqls[0]).toContain(BANK)

    expect(QUESTION_COUNT_SQL).toContain(BANK)
  })

  it('S6 teacher stats and the report "available questions" per chapter', async () => {
    const t = capture()
    await run(() => new TeacherQuestionStatsProvider(t.prisma).statsOf('9'))
    expect(t.sqls.length).toBeGreaterThanOrEqual(1)
    for (const s of t.sqls) expect(s).toContain(BANK)

    const r = capture()
    await run(() => new AnalyticsRepository(r.prisma).availableByChapter(['4']))
    expect(r.sqls).toHaveLength(1)
    expect(r.sqls[0]).toContain(BANK)
  })
})

describe('DM-42: the files whose reads need a database or a builder port carry the predicate', () => {
  const root = join(__dirname, '../../src/modules')
  const files = [
    'exam/builder/question-bank.source.ts', // candidates() + servableVersions() + servableCurrent(): the exam builder sources
    'exam/builder/section-pool.service.ts',
    'files/question-image-access.ts',
  ]
  it.each(files)('%s uses BANK_VISIBLE_SQL', (file) => {
    const text = readFileSync(join(root, file), 'utf8')
    expect(text).toContain('BANK_VISIBLE_SQL')
    expect(text.split('BANK_VISIBLE_SQL').length - 1).toBeGreaterThanOrEqual(file.endsWith('question-bank.source.ts') ? 4 : 2)
  })
})

describe('DM-42: getPublicForLearner and gradeAnswer serve a private question only inside the owner mission', () => {
  const record = (visibility: 'bank' | 'teacher_private', ownerUserId: string | null) =>
    ({ id: '5', isActive: true, version: { status: 'approved', visibility, ownerUserId, parts: [] } }) as never
  const svcOf = (rec: never) => {
    const svc = Object.create(QuestionsService.prototype) as QuestionsService
    ;(svc as unknown as { repo: unknown }).repo = { get: () => Promise.resolve(rec) }
    return svc
  }

  it('a bank question is served as before', async () => {
    await expect(svcOf(record('bank', null)).getPublicForLearner('5')).resolves.toBeDefined()
  })

  it('a private question is a 404 without a mission context and for another teacher mission', async () => {
    const svc = svcOf(record('teacher_private', '7'))
    await expect(svc.getPublicForLearner('5')).rejects.toMatchObject({ status: 404 })
    await expect(svc.getPublicForLearner('5', { missionOwnerId: '8' })).rejects.toMatchObject({ status: 404 })
    await expect(svc.gradeAnswer('5', [])).rejects.toMatchObject({ status: 404 })
    await expect(svc.gradeAnswer('5', [], { missionOwnerId: '8' })).rejects.toMatchObject({ status: 404 })
  })

  it('a private question is served inside the owner mission', async () => {
    const svc = svcOf(record('teacher_private', '7'))
    await expect(svc.getPublicForLearner('5', { missionOwnerId: '7' })).resolves.toBeDefined()
    await expect(svc.gradeAnswer('5', [], { missionOwnerId: '7' })).resolves.toBeDefined()
  })
})
