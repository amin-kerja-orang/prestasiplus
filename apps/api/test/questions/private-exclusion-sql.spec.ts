import { describe, expect, it } from 'vitest'

import { Prisma } from '../../src/db/generated/client'
import { QUESTION_COUNT_SQL } from '../../src/modules/account/account-data.repository'
import { TeacherQuestionStatsProvider } from '../../src/modules/classes/question-bridge/teacher-question-stats.provider'
import { PracticeAnalyticsRepository } from '../../src/modules/practice/reads/analytics/analytics.repository'
import { OverviewRepository } from '../../src/modules/practice/reads/overview/overview.repository'
import type { AnswerLogPort } from '../../src/modules/practice/answer-log.port'
import { PracticeRepository } from '../../src/modules/practice/practice.repository'
import { Be09PracticeQuestionSource } from '../../src/modules/practice/question-bridge/be09-practice-question-source'
import { StructuredListingRepository } from '../../src/modules/practice/reads/writes/listing.repository'
import { QuestionsBijakPoolSource } from '../../src/modules/questions/bijak-pool'
import { QuestionSetsService } from '../../src/modules/classes/question-sets/question-sets.service'
import { BANK_VISIBLE_SQL, isBankVersion, SPM_SERVABLE_SQL } from '../../src/modules/questions/learner-visibility'
import { assertPersonalHasNoGroupOrStimulus, BANK_ONLY, QuestionsRepository } from '../../src/modules/questions/questions.repository'
import { QuestionBankAdapter } from '../../src/modules/questions/workflow/bank-adapter'
import { QuestionsService } from '../../src/modules/questions/questions.service'
import { QuestionBankBuilderSource } from '../../src/modules/exam/builder/question-bank.source'
import { SectionPoolService } from '../../src/modules/exam/builder/section-pool.service'
import { pupilMayReadQuestionImageSql } from '../../src/modules/files/question-image-access'
import { CurriculumRepository } from '../../src/modules/curriculum/curriculum.repository'
import { QUESTION_SERVED } from '../../src/modules/questions/served-rule'
import { databankLaneConds, filterOf as servabilityFilterOf, janaEligibleScope } from '../../src/modules/questions/serving/filters'
import { AnalyticsRepository } from '../../src/modules/reports/analytics/analytics.repository'

/** `writeQueue` never writes an answer row, so the S5-T15 answer log port is not used here; a call would fail the test. */
const unusedAnswerLog = { record: () => Promise.reject(new Error('AnswerLogPort is not used by writeQueue')) } as unknown as AnswerLogPort

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

  it('the Studio list (API-Q-01), its bulk targets and keysets, the structured list and the whole-store counts', async () => {
    const { sqls, prisma } = capture()
    const repo = new QuestionsRepository(prisma)
    const page = { page: 1, pageSize: 10 } as never
    await run(
      () => repo.listIds(page),
      () => repo.listIdsKeyset({} as never, undefined, 10),
      () => repo.filterTargets({} as never, ['review'], 10),
      () => repo.subjectTotals(),
      () => repo.statusSummary(new Date(0)),
      () => repo.structuredStats(),
    )
    expect(sqls.length).toBeGreaterThanOrEqual(5)
    for (const s of sqls.filter((x) => x.includes('latest_version_no') && !x.includes('education_levels WHERE stage'))) expect(s).toContain(BANK)
  })

  it('structuredIds (listed and served) and isStructuredServed carry the bank predicate (FR-GUR-44a-9)', async () => {
    const { sqls, prisma } = capture()
    const repo = new QuestionsRepository(prisma)
    await run(() => repo.structuredIds({ served: false } as never), () => repo.structuredIds({ served: true } as never), () => repo.isStructuredServed('1'))
    expect(sqls.length).toBeGreaterThanOrEqual(3)
    for (const s of sqls) expect(s).toContain(BANK)
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
      () => overview.newestIdsOf(new QuestionsRepository(o.prisma).scopeSql({ status: 'approved' } as never, true), 5),
      () => overview.chapterQuestionCounts(['1', '2']),
    )
    expect(o.sqls).toHaveLength(3)
    for (const s of o.sqls) expect(s).toContain(BANK)

    const l = capture()
    await run(() => new StructuredListingRepository(l.prisma).page({ levelIds: ['1'], subjectIds: null, subjectOrder: false, kbat: null, q: null, markable: false, limit: 10, offset: 0 } as never))
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

describe('DM-42: the exam builder pools, the pupil image rule and the chapter counts carry the predicate (SQL capture)', () => {
  it('QuestionBankBuilderSource.candidates, servableVersions and servableCurrent', async () => {
    const { sqls, prisma } = capture()
    const builder = { subjectByCode: () => Promise.resolve({ id: 1n }) }
    const source = new QuestionBankBuilderSource(prisma, {} as never, builder as never) as unknown as {
      candidates(scope: unknown): Promise<string[]>
      servableVersions(p: unknown[]): Promise<unknown>
      servableCurrent(ids: bigint[]): Promise<unknown>
    }
    await run(
      () => source.candidates({ subject: 'MATEMATIK', kertas: 1 }),
      () => source.servableVersions([{ id: 1n, versionNo: 1 }]),
      () => source.servableCurrent([1n]),
    )
    expect(sqls).toHaveLength(3)
    for (const q of sqls) expect(q).toContain(BANK)
  })

  it('SectionPoolService.subjectOf', async () => {
    const { sqls, prisma } = capture()
    const svc = new SectionPoolService(prisma, {} as never) as unknown as { subjectOf(id: bigint): Promise<unknown> }
    await run(() => svc.subjectOf(1n))
    expect(sqls).toHaveLength(1)
    expect(sqls[0]).toContain(BANK)
  })

  it('the pupil image rule A reads the live bank version only', () => {
    expect(pupilMayReadQuestionImageSql(1n, 2n, 'tok').sql).toContain(BANK)
  })

  it('curriculum chapterQuestionCounts counts bank questions only, in the WHERE and in the servable FILTER; the delete guard counts every version', async () => {
    const { sqls, prisma } = capture()
    const repo = new CurriculumRepository(prisma)
    await run(
      () => repo.chapterQuestionCounts([1n]),
      () => repo.chapterQuestionVersionCount(1n),
    )
    expect(sqls[0]!.split(BANK).length - 1).toBe(2)
    expect(sqls[1]).not.toContain('visibility')
  })
})

describe('DM-42: one definition cannot be used without the bank predicate', () => {
  it('SPM_SERVABLE_SQL carries BANK_VISIBLE_SQL itself, and so does the served lock', () => {
    expect(SPM_SERVABLE_SQL.sql).toContain(BANK)
    expect(QUESTION_SERVED.sql).toContain(`sv.visibility = 'bank'`)
  })

  it('servability reads (scopeSql) and the evaluate twin: a private row is never in a surface', () => {
    const repo = new QuestionsRepository({ client: {} } as never)
    expect(repo.scopeSql({ status: 'approved', active: true, spmPool: true }, false).where.sql.split(BANK).length - 1).toBeGreaterThanOrEqual(2)
  })

  it('every servability surface reads through scope(), so the servability reads (hub counts) exclude private rows; rules.ts is never run on one', () => {
    const repo = new QuestionsRepository({ client: {} } as never)
    for (const activity of ['latih_tubi_spm', 'databank', 'bab'] as const) {
      const where = repo.scopeSql({ ...servabilityFilterOf(activity), status: 'approved', active: true }, false).where.sql
      expect(where, activity).toContain(BANK)
    }
  })

  it('a group member or a stimulus link on a personal question is refused at the write path (the group and stimulus reads can then never meet one)', () => {
    const draft = (over: Record<string, unknown> = {}) => ({ stimulusIds: [] as bigint[], parts: [] as never[], ...over })
    expect(() => assertPersonalHasNoGroupOrStimulus({ visibility: 'teacher_private', groupId: 3n, draft: draft() })).toThrow(/group member/)
    expect(() => assertPersonalHasNoGroupOrStimulus({ visibility: 'teacher_private', draft: draft({ stimulusIds: [4n] }) })).toThrow(/stimulus/)
    expect(() => assertPersonalHasNoGroupOrStimulus({ visibility: 'teacher_private', draft: draft({ parts: [{ children: [{ stimulusId: 5n, children: [] }] }] }) })).toThrow(/stimulus/)
    expect(() => assertPersonalHasNoGroupOrStimulus({ visibility: 'teacher_private', draft: draft() })).not.toThrow()
    expect(() => assertPersonalHasNoGroupOrStimulus({ visibility: 'bank', groupId: 3n, draft: draft({ stimulusIds: [4n] }) })).not.toThrow()
    expect(() => assertPersonalHasNoGroupOrStimulus({ visibility: undefined, groupId: 3n, draft: draft() })).not.toThrow()
  })

  it('repository writes call the guard: create with a group, rewrite and new version of a private question with a stimulus', async () => {
    const client = {
      question: { create: () => Promise.resolve({ id: 1n }) },
      questionVersion: { findUnique: () => Promise.resolve({ id: 1n, visibility: 'teacher_private' }) },
    }
    const repo = new QuestionsRepository({ client } as never)
    const version = { visibility: 'teacher_private', stimulusIds: [], parts: [], status: 'approved' }
    await expect(repo.create({ sourceType: 'manual', createdById: null, groupId: 9n, groupPosition: 1, now: new Date(), version } as never)).rejects.toThrow(/group member/)
    await expect(repo.rewriteVersion('1', 1, { stimulusIds: [7n], parts: [] } as never, new Date())).rejects.toThrow(/stimulus/)
    await expect(repo.addVersion('1', 2, { stimulusIds: [7n], parts: [] } as never, new Date())).rejects.toThrow(/stimulus/)
  })
})

describe('DM-42: getPublicForLearner and gradeAnswer never serve a private question', () => {
  const record = (visibility: 'bank' | 'teacher_private', ownerUserId: string | null) =>
    ({ id: '5', isActive: true, version: { status: 'approved', visibility, ownerUserId, parts: [] } }) as never
  // The fake repo applies `bankOnly` like the real `getMany` does.
  const svcOf = (rec: { version: { visibility: string } }) => {
    const svc = Object.create(QuestionsService.prototype) as QuestionsService
    ;(svc as unknown as { repo: unknown }).repo = { get: (_id: string, _v: string, opts?: { bankOnly?: boolean }) => Promise.resolve(opts?.bankOnly === true && rec.version.visibility === 'teacher_private' ? null : rec) }
    return svc
  }

  it('a bank question is served as before', async () => {
    await expect(svcOf(record('bank', null) as never).getPublicForLearner('5')).resolves.toBeDefined()
  })

  it('a private question is a 404 for both', async () => {
    const svc = svcOf(record('teacher_private', '7') as never)
    await expect(svc.getPublicForLearner('5')).rejects.toMatchObject({ status: 404 })
    await expect(svc.gradeAnswer('5', [])).rejects.toMatchObject({ status: 404 })
  })
})

describe('DM-42 (security M1): a by-id read with bankOnly does not find a private question; without it the mission path does', () => {
  it('QuestionsRepository.getMany filters teacher_private only when bankOnly is set', async () => {
    const repo = new QuestionsRepository({ client: {} } as never)
    const rec = { id: '5', version: { visibility: 'teacher_private' } }
    ;(repo as unknown as { hydrate: unknown }).hydrate = () => Promise.resolve([rec])
    expect(await repo.getMany(['5'], 'live')).toHaveLength(1)
    expect(await repo.getMany(['5'], 'live', 'exclude', BANK_ONLY)).toHaveLength(0)
    expect(await repo.get('5', 'live', BANK_ONLY)).toBeNull()
  })
})

describe('DM-42 (security H1): a private question answered wrongly in a mission is not served in Ulang Kaji', () => {
  it('Be09PracticeQuestionSource.live drops a private question unless the caller is a mission session', async () => {
    const rec = { id: '5', isActive: true, groupId: null, version: { status: 'approved', visibility: 'teacher_private' } }
    const questions = { getMany: () => Promise.resolve([rec]) }
    const source = new Be09PracticeQuestionSource(questions as never, {} as never, [])
    expect((await source.live(['5'])).size).toBe(0)
    expect((await source.live(['5'], 'bab')).size).toBe(0)
    expect((await source.live(['5'], undefined, { allowPrivate: false })).size).toBe(0)
  })

  it('the revision queue write skips a private question (wrong or right) and still queues a bank one', async () => {
    const upserts: unknown[] = []
    const client = {
      $queryRaw: () => Promise.resolve([{ id: 5n }]),
      revisionQueue: { upsert: (a: unknown) => (upserts.push(a), Promise.resolve()), deleteMany: () => Promise.resolve() },
    }
    const repo = new PracticeRepository({ client } as never, unusedAnswerLog)
    const graded = (questionId: string) => ({ check: { questionId, checkedAt: new Date() }, isCorrect: false, subjectId: '1' })
    await (repo as unknown as { writeQueue(u: bigint, g: unknown[], at: Date): Promise<void> }).writeQueue(1n, [graded('5'), graded('6')], new Date())
    expect(upserts).toHaveLength(1)
    expect(JSON.stringify(upserts[0], (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v))).toContain('"questionId":"6"')
  })

  it('the revision queue read and eligibleForPractice carry the bank predicate', async () => {
    const a = capture()
    await run(() => new PracticeAnalyticsRepository(a.prisma).eligibleQueueBySubject('3'))
    expect(a.sqls[0]).toContain(BANK)
    const rt = capture()
    await run(() => new OverviewRepository(rt.prisma).revisionTotal('3'))
    expect(rt.sqls[0]).toContain(BANK)
    const e = capture()
    await run(() => new QuestionsRepository(e.prisma).eligibleForPractice('5'))
    expect(e.sqls[0]).toContain(BANK)
  })
})

describe('DM-42 (R-1): admin delete, bulk delete, deactivate and reactivate treat a private question as unknown', () => {
  const calls: string[] = []
  const priv = { id: '5', version: { visibility: 'teacher_private' } }
  const svc = (() => {
    const s = Object.create(QuestionsService.prototype) as QuestionsService
    const repo = {
      get: (_id: string, _v: string, opts?: { bankOnly?: boolean }) => Promise.resolve(opts?.bankOnly === true ? null : priv),
      lock: () => (calls.push('lock'), Promise.resolve(true)),
      deletionBlock: () => (calls.push('deletionBlock'), Promise.resolve(null)),
      remove: () => (calls.push('remove'), Promise.resolve(true)),
      deactivate: () => (calls.push('deactivate'), Promise.resolve(true)),
      reactivate: () => (calls.push('reactivate'), Promise.resolve(true)),
    }
    Object.assign(s, { repo, prisma: { transaction: (fn: () => unknown) => fn() }, overview: undefined })
    return s
  })()
  const actor = { userId: '1', role: 'admin' } as never

  it('remove, deactivate and reactivate are 404 and touch nothing', async () => {
    await expect(svc.remove('5', actor)).rejects.toMatchObject({ status: 404 })
    await expect(svc.deactivate('5')).rejects.toMatchObject({ status: 404 })
    await expect(svc.reactivate('5')).rejects.toMatchObject({ status: 404 })
    expect(calls).toEqual([])
  })

  it('a bulk delete reports the id as not found and deletes nothing', async () => {
    const res = await svc.bulkAction('delete', ['5'], actor)
    expect(res.affected).toBe(0)
    expect(res.failed).toHaveLength(1)
    expect(res.failed[0]).toMatchObject({ id: '5', code: 'NOT_FOUND' })
    expect(calls).toEqual([])
  })
})

describe('DM-42: the pupil Set Soalan does not serve a private question, and one definition says what a bank version is', () => {
  it('QuestionSetsService.eligibleItems reads the items bank-only', async () => {
    const seen: unknown[] = []
    const questions = { getMany: (_ids: string[], _v: string, _s: string, opts: unknown) => (seen.push(opts), Promise.resolve([])) }
    const repo = { itemIds: () => Promise.resolve(new Map([['1', ['5']]])) }
    const svc = new QuestionSetsService(repo as never, {} as never, questions as never, {} as never)
    await svc.eligibleItems([{ id: '1', needsRebuild: false }] as never)
    expect(seen).toEqual([{ ...BANK_ONLY, lenientKeys: true }])
  })

  it('isBankVersion: bank and an unmarked (older) version are bank, teacher_private is not', () => {
    expect(isBankVersion({ visibility: 'bank' })).toBe(true)
    expect(isBankVersion({})).toBe(true)
    expect(isBankVersion({ visibility: 'teacher_private' })).toBe(false)
  })
})

describe('DM-42 (R-1 nits): report resolution never acts on a private question; Guru removeOwn still deletes its own bank question', () => {
  it('QuestionBankAdapter deactivate/reactivate answer false for a private question and touch nothing', async () => {
    const acted: string[] = []
    const priv = { id: '5', version: { visibility: 'teacher_private' } }
    const repo = {
      get: (_id: string, _v: string, opts?: { bankOnly?: boolean }) => Promise.resolve(opts?.bankOnly === true ? null : priv),
      deactivate: () => (acted.push('deactivate'), Promise.resolve(true)),
      reactivate: () => (acted.push('reactivate'), Promise.resolve(true)),
    }
    const adapter = Object.create(QuestionBankAdapter.prototype) as QuestionBankAdapter
    Object.assign(adapter, { repo })
    expect(await adapter.deactivate('5')).toBe(false)
    expect(await adapter.reactivate('5')).toBe(false)
    expect(acted).toEqual([])
  })

  it('a bank question is still deactivated by the same adapter', async () => {
    const acted: string[] = []
    const repo = { get: () => Promise.resolve({ id: '6', version: { visibility: 'bank' } }), deactivate: () => (acted.push('deactivate'), Promise.resolve(true)) }
    const adapter = Object.create(QuestionBankAdapter.prototype) as QuestionBankAdapter
    Object.assign(adapter, { repo })
    expect(await adapter.deactivate('6')).toBe(true)
    expect(acted).toEqual(['deactivate'])
  })
})
