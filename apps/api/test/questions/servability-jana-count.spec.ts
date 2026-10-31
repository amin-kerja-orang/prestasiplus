import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { describeQuestion } from '@pp/exam-core'

import { PrismaService } from '../../src/db/prisma.service'
import { QuestionsBijakPoolSource } from '../../src/modules/questions/bijak-pool'
import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { janaEligibleScope } from '../../src/modules/questions/serving'
import { adminActor, mcqInput, tagBody, tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'

/**
 * R1-T30 (B2 MAJOR): the hub's Jana count is ONE SQL statement (`janaEligibleScope`), not "load every question of every subject
 * through the pool and run `describeQuestion`". This spec proves the two agree, id by id, on a bank of every shape the eligibility
 * rules distinguish (no unit, T1-T3 origin, tag review, marks 0, no TP, TP only on the part, no key, another-level unit, a leaf
 * unit override, several leaves, no leaf) and every scope condition (inactive, draft, PKSK, subject missing, Darjah).
 */
describe('Jana eligibility: the SQL scope equals the pool facts through describeQuestion (R1-T30)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let repo: QuestionsRepository
  let pool: QuestionsBijakPoolSource
  let prisma: PrismaService
  let tag: Tag
  const made: Record<string, string> = {}
  const q = (sql: string, params: unknown[] = []) => t.db.query<{ id: string }>(sql, params)

  async function approve(key: string, over: Record<string, unknown> = {}): Promise<string> {
    const created = await svc.create(mcqInput(tag, { questionText: `Soalan ${key} untuk kiraan kelayakan Jana.`, tag: tagBody(tag, 4), ...over }), await adminActor(t.db))
    await q(`update question_versions set status = 'approved', published_at = now(), paper_code = '1449/2' where question_id = $1`, [created.id])
    await q(`update questions set live_version_no = 1 where id = $1`, [created.id])
    made[key] = created.id
    return created.id
  }
  const versionOf = (key: string) => q(`select id::text id from question_versions where question_id = $1 and version_no = 1`, [made[key]]).then((r) => r[0]!.id)
  const setVersion = async (key: string, set: string) => q(`update question_versions set ${set} where question_id = $1 and version_no = 1`, [made[key]])
  const setParts = async (key: string, set: string) => q(`update question_parts set ${set} where question_version_id = $1`, [await versionOf(key)])

  /** Ids the SQL scope selects. */
  async function sqlIds(): Promise<string[]> {
    const { from, where } = janaEligibleScope()
    const rows = await prisma.client.$queryRaw<{ id: bigint }[]>`SELECT q.id ${from} WHERE ${where} ORDER BY q.id`
    return rows.map((r) => String(r.id))
  }

  /** Ids the pool facts accept: every subject's candidates with no `describeQuestion` reason, inside the hub's bank scope. */
  async function factIds(): Promise<string[]> {
    const subjects = await q(`select distinct v.subject_id::text id from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where v.subject_id is not null`)
    const eligible: string[] = []
    for (const s of subjects) for (const facts of await pool.candidatesOf(s.id)) if (describeQuestion(facts).reasons.length === 0) eligible.push(facts.id)
    // The hub scope: active, live approved, not PKSK, not Darjah, learner-visible level.
    const inScope = new Set(await repo.eligibleAmong(eligible, { status: 'approved', active: true }))
    return eligible.filter((id) => inScope.has(id)).sort((a, b) => Number(BigInt(a) - BigInt(b)))
  }

  beforeAll(async () => {
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    repo = t.app.get(QuestionsRepository)
    pool = t.app.get(QuestionsBijakPoolSource)
    prisma = t.app.get(PrismaService)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')

    // A level and a unit node that are NOT Tingkatan 4 or 5, and a Darjah level.
    const [tz] = await q(`insert into education_levels (code, name, name_en, stage, curriculum, sort_order, is_active) values ('TZ', 'TZ', 'TZ', 'upper_secondary', 'KSSM', 90, true) returning id::text id`)
    const [darjah] = await q(`insert into education_levels (code, name, name_en, stage, curriculum, sort_order, is_active) values ('DZ', 'DZ', 'DZ', 'primary', 'KSSR', 91, true) returning id::text id`)
    const [foreignUnit] = await q(
      `insert into curriculum_nodes (subject_id, education_level_id, kind, code, title, edition) values ($1, $2, 'unit', '9.9', 'Unit di tingkatan lain', 'T') returning id::text id`,
      [tag.subjectId, tz!.id],
    )

    await approve('control')
    await approve('noUnit', { tag: undefined })
    await approve('t1t3NoUnit', { tag: undefined })
    await setVersion('t1t3NoUnit', `form_origin = 't1_t3'`)
    await approve('tagReview')
    await setVersion('tagReview', 'tag_review = true')
    await approve('marksZero')
    await setParts('marksZero', 'marks = 0')
    await approve('noTp')
    await setVersion('noTp', 'difficulty_tp = null')
    await setParts('noTp', 'difficulty_tp = null')
    await approve('tpOnPartOnly')
    await setVersion('tpOnPartOnly', 'difficulty_tp = null')
    await setParts('tpOnPartOnly', 'difficulty_tp = 2')
    await approve('tpOnVersionOnly')
    await setParts('tpOnVersionOnly', 'difficulty_tp = null')
    await approve('noKey')
    await q(`delete from answer_keys where part_id in (select id from question_parts where question_version_id = $1)`, [await versionOf('noKey')])
    await approve('foreignUnit')
    await setVersion('foreignUnit', `unit_node_id = ${foreignUnit!.id}`)
    await approve('leafUnitForeign')
    await setParts('leafUnitForeign', `unit_node_id = ${foreignUnit!.id}`)
    await approve('leafUnitOnly', { tag: undefined })
    await setParts('leafUnitOnly', `unit_node_id = ${tag.unitId}`)
    await approve('leafT5OverridesT1t3', { tag: undefined })
    await setVersion('leafT5OverridesT1t3', `form_origin = 't1_t3'`)
    await setParts('leafT5OverridesT1t3', `form_origin = 't5'`)

    // Several leaves: both fine, and one without a key.
    for (const [key, dropKey] of [['twoLeaves', false], ['twoLeavesOneNoKey', true]] as const) {
      const created = await svc.create(
        mcqInput(tag, {
          questionType: 'essay',
          options: undefined,
          correctAnswer: undefined,
          questionText: `Soalan ${key} untuk kiraan kelayakan Jana.`,
          tag: tagBody(tag, 4),
          parts: [
            { label: '(a)', prompt: { ms: 'Bahagian a' }, mode: 'short_text', marks: 2, key: { kind: 'accepted', values: ['x'] } },
            { label: '(b)', prompt: { ms: 'Bahagian b' }, mode: 'short_text', marks: 2, key: { kind: 'accepted', values: ['y'] } },
          ] as never,
        }),
        await adminActor(t.db),
      )
      await q(`update question_versions set status = 'approved', published_at = now(), paper_code = '1449/2' where question_id = $1`, [created.id])
      await q(`update questions set live_version_no = 1 where id = $1`, [created.id])
      made[key] = created.id
      if (dropKey) await q(`delete from answer_keys where part_id = (select id from question_parts where question_version_id = $1 and mode is not null order by position desc, id desc limit 1)`, [await versionOf(key)])
    }
    // No leaf at all: a question whose parts are removed.
    await approve('noLeaf')
    await q(`delete from answer_keys where part_id in (select id from question_parts where question_version_id = $1)`, [await versionOf('noLeaf')])
    await q(`delete from part_options where part_id in (select id from question_parts where question_version_id = $1)`, [await versionOf('noLeaf')])
    await q(`delete from question_parts where question_version_id = $1`, [await versionOf('noLeaf')])

    // Scope: inactive, draft, PKSK, no subject, Darjah.
    await approve('inactive')
    await q(`update questions set is_active = false where id = $1`, [made.inactive])
    made.draft = (await svc.create(mcqInput(tag, { questionText: 'Soalan draf untuk kiraan kelayakan Jana.', tag: tagBody(tag, 4) }), await adminActor(t.db))).id
    await approve('pksk')
    await q(`insert into question_tags (question_id, kind, code) values ($1, 'pksk_domain', 'x')`, [made.pksk])
    await approve('noSubject')
    await setVersion('noSubject', 'subject_id = null')
    await approve('darjah')
    await setVersion('darjah', `education_level_id = ${darjah!.id}`)
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('selects exactly the questions the pool facts accept, id by id', async () => {
    const sql = await sqlIds()
    const facts = await factIds()
    expect(sql).toEqual(facts)
    // The seeded bank contributes too, so the fixture is not the whole answer.
    expect(sql.length).toBeGreaterThan(8)
  })

  it('names the fixtures it accepts and refuses', async () => {
    const sql = new Set(await sqlIds())
    for (const key of ['control', 't1t3NoUnit', 'tpOnPartOnly', 'tpOnVersionOnly', 'twoLeaves']) expect(sql.has(made[key]!), `${key} eligible`).toBe(true)
    for (const key of ['noUnit', 'tagReview', 'marksZero', 'noTp', 'noKey', 'foreignUnit', 'leafUnitForeign', 'leafUnitOnly', 'leafT5OverridesT1t3', 'twoLeavesOneNoKey', 'noLeaf', 'inactive', 'draft', 'pksk', 'noSubject', 'darjah']) {
      expect(sql.has(made[key]!), `${key} refused`).toBe(false)
    }
  })

  it('every refused question the facts also refuse carries a describeQuestion reason (the fixtures really are ineligible for the stated cause)', async () => {
    const reasonsOf = async (key: string): Promise<string[]> => {
      const facts = (await pool.candidatesOf(tag.subjectId, [made[key]!]))[0]
      return facts ? describeQuestion(facts).reasons : ['not a candidate']
    }
    expect(await reasonsOf('noUnit')).toContain('no_unit')
    expect(await reasonsOf('tagReview')).toContain('tag_review')
    expect(await reasonsOf('marksZero')).toContain('no_marks')
    expect(await reasonsOf('noTp')).toContain('no_tp')
    expect(await reasonsOf('noKey')).toContain('no_key')
    expect(await reasonsOf('foreignUnit')).toContain('no_unit')
    expect(await reasonsOf('leafT5OverridesT1t3')).toContain('no_unit')
    expect(await reasonsOf('twoLeavesOneNoKey')).toContain('no_key')
    expect(await reasonsOf('noLeaf')).toContain('no_marks')
  })
})
