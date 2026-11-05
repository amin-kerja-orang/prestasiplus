/**
 * S3-T07 part B-counts: the Databank counts follow the serving rule of the Databank draw (`filterOf('databank')`), a stimulus group
 * counts once, an incomplete group counts 0, and the cached count is dropped when a question event happens (ruling 8, "+1 on next load").
 * The SPM Mock paper 1 pool (`poolFilter`, single MCQ leaf outside any group) is unchanged.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { GROUP_SURFACES, QuestionsRepository, QuestionsService, servabilityFilterOf } from '../../src/modules/questions'
import { databankFilter, latihTubiFilter, SpmPoolService } from '../../src/modules/spm/pool.service'
import { addQuestion, bootSpmApp, type SpmTestApp } from './helpers'

let t: SpmTestApp
let pool: SpmPoolService
let repo: QuestionsRepository
let questions: QuestionsService

const subjectId = async (code: string): Promise<string> => (await t.db.query<{ id: string }>('select id::text from subjects where code = $1', [code]))[0]?.id as string

/** One stimulus group over `members` (a passage stimulus, so the group is "complete" when every member is servable). */
async function groupOf(members: string[]): Promise<string> {
  const stimulus = (await t.db.query<{ id: string }>(`insert into stimuli (kind, label, body_ms) values ('passage', 'Petikan', 'Petikan ujian.') returning id::text`))[0]!.id
  const group = (await t.db.query<{ id: string }>(`insert into stimulus_groups (scope) values ('section') returning id::text`))[0]!.id
  await t.db.query(`insert into stimulus_group_stimuli (group_id, stimulus_id, position) values ($1::bigint, $2::bigint, 1)`, [group, stimulus])
  for (const [i, id] of members.entries()) await t.db.query(`update questions set group_id = $1::bigint, group_position = $2 where id = $3::bigint`, [group, i + 1, id])
  return group
}

/** A second, keyed leaf (with options, like `addQuestion` builds one) on the live version of a question: a valid multi-leaf question. */
async function addSecondLeaf(questionId: string): Promise<void> {
  const pid = (
    await t.db.query<{ id: string }>(
      `insert into question_parts (question_version_id, position, depth, label, prompt_ms, marks, mode)
       select v.id, 2, 1, 'b', 'Bahagian b', 1, 'mcq' from question_versions v join questions q on q.id = v.question_id and v.version_no = q.live_version_no where q.id = $1::bigint
       returning id::text`,
      [questionId],
    )
  )[0]!.id
  for (const [i, label] of ['A', 'B', 'C', 'D'].entries()) await t.db.query(`insert into part_options (part_id, label, body_ms, position) values ($1, $2, $3, $4)`, [pid, label, `Pilihan ${label}`, i + 1])
  await t.db.query(`insert into answer_keys (part_id, kind, content) values ($1, 'option', $2::jsonb)`, [pid, JSON.stringify({ kind: 'option', correct: 'B' })])
}

/** The Databank serving filter with `databank` ADDED to the group surfaces (what B3 will make of `GROUP_SURFACES`). */
const withLtGroups = (subject: string) => ({ ...servabilityFilterOf('latih_tubi_spm', { subjectId: subject }, [...GROUP_SURFACES, 'latih_tubi_spm']), status: 'approved' as const, active: true })
const withGroups = (subject: string) => ({ ...servabilityFilterOf('databank', { subjectId: subject }, [...GROUP_SURFACES, 'databank']), status: 'approved' as const, active: true })

beforeAll(async () => {
  t = await bootSpmApp({ env: { SPM_POOL_CACHE_SECONDS: '600' } })
  await t.db.query('delete from questions')
  pool = t.app.get(SpmPoolService)
  repo = t.app.get(QuestionsRepository)
  questions = t.app.get(QuestionsService)
}, 240_000)

afterAll(async () => {
  await t.close()
})

describe('Databank counts follow the serving rule', () => {
  it('[CI] AC-MUR-13-13 a group of 3 counts as 1 and an incomplete group counts 0 (group surfaces on); a multi-leaf question is not served so it is not counted', async () => {
    const sej = await subjectId('SEJ')
    await addQuestion(t.db, { subject: 'SEJ', level: 'T4' })
    const three = [await addQuestion(t.db, { subject: 'SEJ', level: 'T4' }), await addQuestion(t.db, { subject: 'SEJ', level: 'T4' }), await addQuestion(t.db, { subject: 'SEJ', level: 'T4' })]
    await groupOf(three)
    const gappy = [await addQuestion(t.db, { subject: 'SEJ', level: 'T4' }), await addQuestion(t.db, { subject: 'SEJ', level: 'T4', status: 'draft' })]
    await groupOf(gappy) // one member is not live-approved: the whole group is not served
    const multi = await addQuestion(t.db, { subject: 'SEJ', level: 'T4' })
    await addSecondLeaf(multi)
    // solo (1) + the complete group (1) = 2; the incomplete group (0); the multi-leaf question has no single-part shape (0).
    expect(await repo.unitCount(withGroups(sej))).toBe(2)
    // Row count of the same scope is 4 (solo + 3 members): the unit count is what dedupes.
    expect(await repo.count(withGroups(sej))).toBe(4)
    // The complete group alone is 1 unit of 3 rows; the incomplete group alone is 0.
    expect(await repo.unitCount({ ...withGroups(sej), idIn: three })).toBe(1)
    expect(await repo.count({ ...withGroups(sej), idIn: three })).toBe(3)
    expect(await repo.unitCount({ ...withGroups(sej), idIn: gappy })).toBe(0)
  })

  it('[CI] AC-MUR-13-13 a multi-leaf question is one unit where it is served and 0 under the Databank shape (count = servable)', async () => {
    const sej = await subjectId('SEJ')
    const plain = { subjectId: sej, type: 'mcq' as const, spmPool: true, status: 'approved' as const, active: true }
    const multi = await addQuestion(t.db, { subject: 'SEJ', level: 'T4' })
    await addSecondLeaf(multi)
    // No shape filter: one row = one unit, however many leaves.
    expect(await repo.unitCount({ ...plain, idIn: [multi] })).toBe(1)
    // The Databank draw shape (one part) cannot serve it: it counts 0.
    expect(await repo.unitCount({ ...databankFilter(sej), idIn: [multi] })).toBe(0)
    expect(await repo.unitCount({ ...withGroups(sej), idIn: [multi] })).toBe(0)
  })

  it('[CI] AC-MUR-13-13 the hub count follows GROUP_SURFACES; today databank is not a group surface, so only singles count', async () => {
    const sej = await subjectId('SEJ')
    const served = await repo.unitCount({ ...servabilityFilterOf('databank', { subjectId: sej }), status: 'approved', active: true })
    expect(await pool.databankCount(sej, { fresh: true })).toBe(served)
    const grouped = GROUP_SURFACES.includes('databank')
    // Groups off: the draw serves ungrouped single-leaf questions only. Groups on: the complete group counts once more.
    expect(served).toBe(grouped ? 2 : await ungroupedSingles(sej))
  })

  it('[CI] AC-MUR-13-13 the SPM Mock paper 1 pool is unchanged: single MCQ leaf outside any group', async () => {
    const sej = await subjectId('SEJ')
    expect(await pool.count(sej)).toBe(await ungroupedSingles(sej))
  })
})

/** Live approved SEJ single-leaf MCQs that sit outside any group at an offered level (the Mock pool, counted by SQL here). */
async function ungroupedSingles(sej: string): Promise<number> {
  const rows = await t.db.query<{ n: string }>(
    `select count(*)::text n from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
      where q.is_active and v.status = 'approved' and v.type = 'mcq' and v.subject_id = $1::bigint and q.group_id is null
        and (select count(*) from question_parts p where p.question_version_id = v.id) = 1`,
    [sej],
  )
  return Number(rows[0]?.n)
}

describe('Latih Tubi SPM hub total follows the serving rule', () => {
  it('[CI] AC-MUR-13-13 a group of 3 counts as 1, an incomplete group 0, a multi-leaf question 0 (group surface on)', async () => {
    await t.db.query('delete from questions')
    const geo = await subjectId('GEO')
    await addQuestion(t.db, { subject: 'GEO', level: 'T4' })
    const three = [await addQuestion(t.db, { subject: 'GEO', level: 'T4' }), await addQuestion(t.db, { subject: 'GEO', level: 'T4' }), await addQuestion(t.db, { subject: 'GEO', level: 'T4' })]
    await groupOf(three)
    const gappy = [await addQuestion(t.db, { subject: 'GEO', level: 'T4' }), await addQuestion(t.db, { subject: 'GEO', level: 'T4', status: 'draft' })]
    await groupOf(gappy)
    const multi = await addQuestion(t.db, { subject: 'GEO', level: 'T4' })
    await addSecondLeaf(multi)
    expect(await repo.unitCount(withLtGroups(geo))).toBe(2)
    expect(await repo.unitCount({ ...withLtGroups(geo), idIn: three })).toBe(1)
    expect(await repo.unitCount({ ...withLtGroups(geo), idIn: gappy })).toBe(0)
    expect(await repo.unitCount({ ...withLtGroups(geo), idIn: [multi] })).toBe(0)
  })

  it('[CI] AC-MUR-13-13 the hub total (API and service) equals what the draw serves and follows GROUP_SURFACES', async () => {
    const geo = await subjectId('GEO')
    const served = await repo.unitCount(latihTubiFilter(geo))
    expect(await pool.latihTubiCount(geo, { fresh: true })).toBe(served)
    // Groups off: ungrouped single-leaf only (1 solo). Groups on: the complete group counts once more.
    expect(served).toBe(GROUP_SURFACES.includes('latih_tubi_spm') ? 2 : 1)
  })
})

describe('Latih Tubi breakdowns count units like the total', () => {
  it('[CI] AC-MUR-13-13 a group sits in ONE bucket (its first member), so level and difficulty cells sum to the total (groups on and off)', async () => {
    await t.db.query('delete from questions')
    const bio = await subjectId('BIO')
    await addQuestion(t.db, { subject: 'BIO', level: 'T4', tp: 1 })
    await addQuestion(t.db, { subject: 'BIO', level: 'T5', tp: 4 })
    // A complete group whose members differ in level and TP: it must land in the bucket of its first member only (T4, TP 2).
    const members = [
      await addQuestion(t.db, { subject: 'BIO', level: 'T4', tp: 2 }),
      await addQuestion(t.db, { subject: 'BIO', level: 'T5', tp: 5 }),
      await addQuestion(t.db, { subject: 'BIO', level: 'T5', tp: 3 }),
    ]
    await groupOf(members)
    // An incomplete group counts nowhere.
    await groupOf([await addQuestion(t.db, { subject: 'BIO', level: 'T4', tp: 1 }), await addQuestion(t.db, { subject: 'BIO', level: 'T4', tp: 1, status: 'draft' })])

    const sum = (rows: { n: number }[]) => rows.reduce((a, r) => a + r.n, 0)
    for (const filter of [latihTubiFilter(bio), withLtGroups(bio)]) {
      const total = await repo.unitCount(filter)
      expect(sum(await repo.unitCountsByLevelTp(filter))).toBe(total)
    }
    const on = await repo.unitCountsByLevelTp(withLtGroups(bio))
    expect(sum(on)).toBe(3) // two solos + the complete group once
    expect(on.filter((r) => r.tp === 2)).toHaveLength(1) // the group is at its first member (TP 2), not at TP 5 or 3
    expect(on.some((r) => r.tp === 5 || r.tp === 3)).toBe(false)

    // The group row's own level wins over the first member's (T4): set it to T5 and the group moves there, TP still the first member's.
    const group = (await t.db.query<{ group_id: string }>('select group_id::text from questions where id = $1::bigint', [members[0]]))[0]!.group_id
    const t5 = (await t.db.query<{ id: string }>(`select id::text from education_levels where code = 'T5'`))[0]!.id
    const t4 = (await t.db.query<{ id: string }>(`select id::text from education_levels where code = 'T4'`))[0]!.id
    await t.db.query('update stimulus_groups set education_level_id = $1::bigint where id = $2::bigint', [t5, group])
    const own = await repo.unitCountsByLevelTp(withLtGroups(bio))
    expect(sum(own)).toBe(3)
    expect(own).toContainEqual({ levelId: t5, tp: 2, n: 1 })
    expect(own).not.toContainEqual({ levelId: t4, tp: 2, n: 1 })
    await t.db.query('update stimulus_groups set education_level_id = null where id = $1::bigint', [group])

    // The service: breakdown cells equal the hub total under the live surfaces.
    const cells = await pool.latihTubiCells(bio)
    expect(cells.reduce((a, c) => a + c.n, 0)).toBe(await pool.latihTubiCount(bio, { fresh: true }))
  })
})

describe('Databank count cache', () => {
  it('[CI] AC-MUR-13-10 the cached count rises by 1 on the next load after a question event', async () => {
    const id = await subjectId('PERNIAGA')
    for (let i = 0; i < 3; i++) await addQuestion(t.db, { subject: 'PERNIAGA', level: 'T4' })
    expect(await pool.databankCount(id)).toBe(3)
    expect(await pool.count(id)).toBe(3)
    await addQuestion(t.db, { subject: 'PERNIAGA', level: 'T4' }) // approved in SQL: no event yet
    expect(await pool.databankCount(id)).toBe(3)
    questions.invalidateOverview() // the call every approve / publish makes (QuestionsService.setStatus)
    expect(await pool.databankCount(id)).toBe(4)
    expect(await pool.count(id)).toBe(4)
  })
})
