import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaService } from '../../src/db/prisma.service'
import { BuilderRepository } from '../../src/modules/exam/builder/builder.repository'
import { QuestionBankBuilderSource } from '../../src/modules/exam/builder/question-bank.source'
import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { QuestionsBijakPoolSource } from '../../src/modules/questions/bijak-pool'
import { adminActor, mcqInput, tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'

/**
 * R1-B21 (D72/D86): a Darjah question never enters the Bijak or the paper-builder paths. Each path below gets one published
 * secondary question and one published Darjah question (a secondary one relabelled to a primary-stage level), same subject and
 * kertas, and must return only the secondary one.
 */
describe('secondary-only guard on the Bijak and builder readers (R1-B21)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let repo: QuestionsRepository
  let builder: QuestionBankBuilderSource
  let pool: QuestionsBijakPoolSource
  let tag: Tag
  let admin: Awaited<ReturnType<typeof adminActor>>
  let darjahLevel: string

  beforeAll(async () => {
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    repo = t.app.get(QuestionsRepository)
    const prisma = t.app.get(PrismaService)
    builder = new QuestionBankBuilderSource(prisma, repo, new BuilderRepository(prisma))
    pool = t.app.get(QuestionsBijakPoolSource)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    admin = await adminActor(t.db)
    const [level] = await t.db.query<{ id: string }>(`select id::text id from education_levels where stage = 'primary' order by id limit 1`)
    if (!level) throw new Error('no primary-stage level in the seed')
    darjahLevel = level.id
  })
  afterAll(async () => {
    await t.close()
  })

  /** A published, active question of paper code 1449/2; `darjah` relabels its level to a primary-stage one. */
  async function published(text: string, opts: { darjah?: boolean; groupId?: string } = {}): Promise<string> {
    const q = await svc.create(mcqInput(tag, { questionText: text, ...(opts.groupId ? { stimulusGroupId: opts.groupId } : {}) }), admin)
    await t.db.query(
      `update question_versions set status = 'published', published_at = now(), paper_code = '1449/2' where question_id = $1`,
      [q.id],
    )
    await t.db.query(`update questions set live_version_no = 1 where id = $1`, [q.id])
    if (opts.darjah) await t.db.query(`update question_versions set education_level_id = $2 where question_id = $1`, [q.id, darjahLevel])
    return q.id
  }

  let secondary: string
  let darjah: string

  beforeAll(async () => {
    secondary = await published('Soalan menengah untuk ujian pengawal sekunder sahaja.')
    darjah = await published('Soalan darjah untuk ujian pengawal sekunder sahaja.', { darjah: true })
  })

  it('the fixture is real: the Darjah question is published, active and on a primary-stage level', async () => {
    const [row] = await t.db.query<{ stage: string; status: string; is_active: boolean }>(
      `select el.stage, v.status, q.is_active from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
         join education_levels el on el.id = v.education_level_id where q.id = $1`,
      [darjah],
    )
    expect(row).toEqual({ stage: 'primary', status: 'published', is_active: true })
  })

  it('builder candidates list the secondary question and not the Darjah one', async () => {
    const ids = await builder.candidates({ subject: 'MAT', kertas: 2 })
    expect(ids).toContain(secondary)
    expect(ids).not.toContain(darjah)
  })

  it('builder describe leaves a Darjah question out, so it can never be placed on a paper', async () => {
    const got = await builder.describe([{ id: secondary }, { id: darjah }, { id: darjah, versionNo: 1 }])
    expect([...got.keys()]).toEqual([secondary])
  })

  it('builder review (admin preview) skips the Darjah question', async () => {
    const preview = await builder.review([darjah, secondary])
    expect(preview.questions.map((q) => q.id)).toEqual([secondary])
  })

  it('builder groups drop a Darjah member, and a group of Darjah members only is absent', async () => {
    const stimulus = await svc.createStimulus({ kind: 'passage', label: 'Petikan', bodyMs: 'Teks', bodyEn: null, altText: null, assetFileId: null })
    const mixed = await svc.createStimulusGroup({ label: null, scope: 'section', stimulusIds: [stimulus], optionBank: [] })
    const a = await published('Ahli kumpulan campuran satu untuk ujian sekunder.', { groupId: mixed })
    const b = await published('Ahli kumpulan campuran dua untuk ujian sekunder.', { groupId: mixed, darjah: true })
    const only = await svc.createStimulusGroup({ label: null, scope: 'section', stimulusIds: [stimulus], optionBank: [] })
    await published('Ahli kumpulan darjah sahaja untuk ujian sekunder.', { groupId: only, darjah: true })

    const groups = await builder.groups([mixed, only])
    expect(groups.get(mixed)?.questionIds).toEqual([a])
    expect(groups.get(mixed)?.questionIds).not.toContain(b)
    expect(groups.has(only)).toBe(false)
  })

  it('the Jana Kertas pool (Bijak) offers the secondary question and not the Darjah one', async () => {
    const [subject] = await t.db.query<{ id: string }>(`select v.subject_id::text id from question_versions v where v.question_id = $1`, [secondary])
    const facts = await pool.candidatesOf(subject!.id)
    const ids = facts.map((f) => f.id)
    expect(ids).toContain(secondary)
    expect(ids).not.toContain(darjah)
  })

  it('Bijak and kuiz reads: live, pinned, draw and eligibility never return the Darjah question', async () => {
    expect((await repo.getMany([secondary, darjah], 'live')).map((r) => r.id)).toEqual([secondary])
    expect((await repo.getMany([darjah], 'latest'))).toEqual([])
    // Pinned (kuiz paper page and regrade).
    expect((await repo.getVersions([{ questionId: secondary, versionNo: 1 }, { questionId: darjah, versionNo: 1 }])).map((r) => r.id)).toEqual([secondary])
    // Kuiz random draw and the shared eligibility reads.
    const drawn = await repo.sampleIds({}, 500, 7)
    expect(drawn).toContain(secondary)
    expect(drawn).not.toContain(darjah)
    expect(await repo.eligibleAmong([secondary, darjah])).toEqual([secondary])
  })
})
