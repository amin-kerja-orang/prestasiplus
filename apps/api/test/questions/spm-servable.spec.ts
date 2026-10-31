import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { prngStream } from '../../src/db/prng'
import { QUESTION_COUNT_SQL } from '../../src/modules/account/account-data.repository'
import { Be09PracticeQuestionSource } from '../../src/modules/practice/question-bridge'
import { BankFacts } from '../../src/modules/practice/reads/overview/bank-facts'
import { OverviewRepository } from '../../src/modules/practice/reads/overview/overview.repository'
import { OFFERED_LEVEL_CODES } from '../../src/modules/practice/rules'
import { QuestionsRepository } from '../../src/modules/questions'
import { SpmPoolService } from '../../src/modules/spm/pool.service'
import { bulkMcqs } from '../helpers/bulk-bank'
import { bootMissionsApp, loadWorld, type MissionsTestApp, type World } from '../missions/helpers'

/**
 * R1-B06 (D85/D87): "SPM-servable" is one shared definition (`SPM_SERVABLE_SQL`), not the `pool:spm` tag. An admin-created
 * question (no tag) in an offered level reaches Databank (practice source), Latih Tubi SPM (same source), Mock K1 (SpmPoolService)
 * and Battle SPM; a primary-level, PKSK or draft question does not; QLOAD-tagged questions still do; and the overview counts equal
 * the draw counts.
 */
let t: MissionsTestApp
let w: World
let repo: QuestionsRepository
let source: Be09PracticeQuestionSource
let pool: SpmPoolService
let adminLike: string[]
let qloadLike: string[]
let draft: string[]
let primaryLevel: string
let primaryRows: string[]
let pksk: string

beforeAll(async () => {
  t = await bootMissionsApp({ full: true })
  w = await loadWorld(t)
  repo = t.get(QuestionsRepository)
  source = t.get(Be09PracticeQuestionSource)
  pool = t.get(SpmPoolService)
  // Start from an empty SPM bank for this subject so the fixture rows are the only candidates.
  await t.db.query(`update questions set is_active = false where id in (select question_id from question_versions where subject_id = $1)`, [w.tag.subjectId])
  adminLike = await bulkMcqs(t.db, { count: 12, subjectId: w.tag.subjectId, levelId: w.tag.levelId, label: 'SV-ADM' }) // no pool tag
  qloadLike = await bulkMcqs(t.db, { count: 6, subjectId: w.tag.subjectId, levelId: w.tag.levelId, poolEvery: 1, label: 'SV-QL' }) // tagged
  draft = (await bulkMcqs(t.db, { count: 6, subjectId: w.tag.subjectId, levelId: w.tag.levelId, draftEvery: 1, label: 'SV-DR' })).concat(['0'])
  primaryLevel = (await t.db.query<{ id: string }>(`select id::text id from education_levels where stage = 'primary' order by id limit 1`))[0]?.id as string
  expect(primaryLevel).toBeTruthy()
  primaryRows = await bulkMcqs(t.db, { count: 6, subjectId: w.tag.subjectId, levelId: primaryLevel, poolEvery: 1, label: 'SV-PR' }) // tagged, but Darjah
  const pk = await bulkMcqs(t.db, { count: 3, subjectId: w.tag.subjectId, levelId: w.tag.levelId, poolEvery: 1, label: 'SV-PK' })
  pksk = pk[0] as string
  for (const id of pk) await t.db.query(`insert into question_tags (question_id, kind, code) values ($1, 'pksk_domain', 'X')`, [id])
}, 300_000)

afterAll(async () => {
  await t.close()
})

describe('the shared SPM-servable definition', () => {
  it('the offered levels are the practice rule (T4, T5), reused not copied', () => {
    expect([...OFFERED_LEVEL_CODES]).toEqual(['T4', 'T5'])
  })

  it('Databank / Latih Tubi SPM draw (source.sample with spmPool): an untagged admin T4 MCQ appears', async () => {
    const ids = await source.sample({ subjectId: w.tag.subjectId, spmPool: true }, 5000, prngStream('sv1'))
    for (const id of adminLike) expect(ids).toContain(id)
    for (const id of qloadLike) expect(ids).toContain(id) // QLOAD-tagged still appear
  })

  it('a primary-level, PKSK or draft question is never drawn', async () => {
    const ids = await source.sample({ subjectId: w.tag.subjectId, spmPool: true }, 5000, prngStream('sv2'))
    for (const id of [...primaryRows, ...draft, ...(await tagged('SV-PK'))]) expect(ids).not.toContain(id)
    expect(await tagged('SV-PK')).toContain(pksk)
  })

  it('Mock K1 pool (SpmPoolService): counts include the untagged question, exclude the others', async () => {
    const cells = await pool.cells(w.tag.subjectId, { fresh: true })
    const total = cells.reduce((n, c) => n + c.n, 0)
    expect(total).toBe(adminLike.length + qloadLike.length)
    const drawn = (await pool.sample(w.tag.subjectId, adminLike.length + qloadLike.length, prngStream('k1'))).map((r) => r.id)
    expect(new Set(drawn)).toEqual(new Set([...adminLike, ...qloadLike]))
  })

  it('QuestionsRepository.count (Battle SPM size) uses the same rule', async () => {
    const n = await repo.count({ type: 'mcq', subjectId: w.tag.subjectId, spmPool: true, status: 'published', active: true })
    expect(n).toBe(adminLike.length + qloadLike.length)
  })

  it('the overview card counts and the login count equal the draw counts', async () => {
    const drawable = (await repo.count({ type: 'mcq', spmPool: true, status: 'published', active: true })) // all subjects
    const matrix = await t.get(OverviewRepository).bankMatrix()
    const levels = (await t.db.query<{ id: string }>(`select id::text id from education_levels where code = any($1)`, [[...OFFERED_LEVEL_CODES]])).map((r) => r.id)
    const subjects = (await t.db.query<{ id: string }>(`select id::text id from subjects where is_active`)).map((r) => r.id)
    const bank = new BankFacts(matrix)
    const cards = subjects.reduce((n, s) => n + bank.practice(s, levels), 0)
    const login = (await t.db.query<{ c: string }>(QUESTION_COUNT_SQL))[0]?.c
    expect(Number(login)).toBe(drawable)
    expect(cards).toBe(drawable)
  })
})

async function tagged(label: string): Promise<string[]> {
  return (await t.db.query<{ id: string }>(`select q.id::text id from questions q join question_versions v on v.question_id = q.id and v.version_no = 1 where v.number_label like $1 order by q.id`, [`${label}-%`])).map((r) => r.id)
}

