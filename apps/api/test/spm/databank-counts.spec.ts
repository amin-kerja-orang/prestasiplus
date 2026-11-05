/**
 * S3-T07 part B-counts: the Databank counts follow the serving rule of the Databank draw (`filterOf('databank')`), a stimulus group
 * counts once, an incomplete group counts 0, and the cached count is dropped when a question event happens (ruling 8, "+1 on next load").
 * The SPM Mock paper 1 pool (`poolFilter`, single MCQ leaf outside any group) is unchanged.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsRepository, QuestionsService, servabilityFilterOf } from '../../src/modules/questions'
import { GROUP_SURFACES } from '../../src/modules/questions/serving/rules'
import { SpmPoolService } from '../../src/modules/spm/pool.service'
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

/** A second leaf on the live version of a question: a multi-leaf question. */
async function addSecondLeaf(questionId: string): Promise<void> {
  await t.db.query(
    `insert into question_parts (question_version_id, position, depth, label, prompt_ms, marks, mode)
     select v.id, 2, 1, 'b', 'Bahagian b', 1, 'mcq' from question_versions v join questions q on q.id = v.question_id and v.version_no = q.live_version_no where q.id = $1::bigint`,
    [questionId],
  )
}

/** The Databank serving filter with `databank` ADDED to the group surfaces (what B3 will make of `GROUP_SURFACES`). */
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
    // solo (1) + the complete group (1) = 2; the incomplete group (0); the multi-leaf question has no single-leaf shape (0).
    expect(await repo.unitCount(withGroups(sej))).toBe(2)
    // Row count of the same scope is 4 (solo + 3 members): the unit count is what dedupes.
    expect(await repo.count(withGroups(sej))).toBe(4)
  })

  it('[CI] AC-MUR-13-13 a multi-leaf question counts once (not once per leaf) in a scope that serves it', async () => {
    const sej = await subjectId('SEJ')
    const plain = { subjectId: sej, type: 'mcq' as const, spmPool: true, status: 'approved' as const, active: true }
    const before = await repo.unitCount(plain)
    const multi = await addQuestion(t.db, { subject: 'SEJ', level: 'T5' })
    await addSecondLeaf(multi)
    expect(await repo.unitCount(plain)).toBe(before + 1)
  })

  it('[CI] AC-MUR-13-13 the hub count equals what the draw serves today: it follows GROUP_SURFACES, so a group counts only once databank is a group surface', async () => {
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
