import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaService } from '../../src/db/prisma.service'
import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { filterOf, janaEligibleScope } from '../../src/modules/questions/serving'
import { ALL_GROUP_SURFACES } from '../../src/modules/questions/serving/rules'
import { adminActor, mcqInput, tagBody, tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'

/**
 * S1-T06 with S6-T16 (DM-42): the media rule (`MEDIA_RESOLVED_SQL`) and the bank-only rule (`BANK_VISIBLE_SQL`) are ANDed, not alternatives. A
 * PRIVATE (teacher_private) question whose image has its file passes the media rule, yet stays out of every learner read. Needs Postgres (CI).
 */
describe('a private question with resolved media stays excluded (S1-T06 + DM-42)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let repo: QuestionsRepository
  let prisma: PrismaService
  let tag: Tag
  let bankId: string
  let privateId: string
  const q = (sql: string, params: unknown[] = []) => t.db.query<{ id: string }>(sql, params)

  async function publish(text: string): Promise<string> {
    const created = await svc.create(mcqInput(tag, { questionText: text, tag: tagBody(tag, 4) }), await adminActor(t.db))
    await q(`update question_versions set status = 'approved', published_at = now(), paper_code = '1449/2' where question_id = $1`, [created.id])
    await q(`update questions set live_version_no = 1 where id = $1`, [created.id])
    await q(`update question_parts set prompt_ms = 'Pilih jawapan yang betul.' where question_version_id = (select id from question_versions where question_id = $1)`, [created.id])
    return created.id
  }
  /** A resolved image: the stimulus has its uploaded file. Linked to the question's version. */
  async function withResolvedImage(questionId: string, n: number): Promise<void> {
    const [st] = await q(`insert into stimuli (kind, label, alt_text) values ('image', 'Rajah', 'Rajah') returning id::text id`)
    const [f] = await q(`insert into files (public_id, purpose, mime, size_bytes, sha256, storage_key) values ($1, 'question_image', 'image/png', 10, repeat('c', 64), $1) returning id::text id`, [`s1t06-priv-${String(n)}`.padEnd(22, 'x')])
    await q(`update stimuli set asset_file_id = $2::bigint where id = $1::bigint`, [st!.id, f!.id])
    await q(`insert into question_version_stimuli (question_version_id, stimulus_id, position) select id, $2::bigint, 1 from question_versions where question_id = $1`, [questionId, st!.id])
  }

  beforeAll(async () => {
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    repo = t.app.get(QuestionsRepository)
    prisma = t.app.get(PrismaService)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    const [math] = await q(`select id::text id from subjects where code = 'MATH'`)
    await q(`insert into spm_subject_configs (subject_id, grp, display_order, databank_order) values ($1, 'teras', 1, 3) on conflict do nothing`, [math!.id])
    bankId = await publish('Soalan bank dengan gambar lengkap, ujian pengecualian peribadi bersama media.')
    privateId = await publish('Soalan peribadi dengan gambar lengkap, ujian pengecualian peribadi bersama media.')
    await withResolvedImage(bankId, 1)
    await withResolvedImage(privateId, 2)
    const ownerId = (await adminActor(t.db)).userId
    await q(`update question_versions set visibility = 'teacher_private', owner_user_id = $1, reference_url = 'https://example.org/rujukan' where question_id = $2`, [ownerId, privateId])
  })
  afterAll(async () => {
    await t.close()
  })

  it('[CI] positive control: the bank question with the same resolved image is served', async () => {
    const surface = filterOf('latih_tubi_spm', {}, ALL_GROUP_SURFACES)
    expect(await repo.eligibleAmong([bankId, privateId], surface)).toEqual([bankId])
  })

  it('[CI] the private question is left out of the draw on the figure surface, the plain SPM filter and the live list', async () => {
    const surface = filterOf('latih_tubi_spm', {}, ALL_GROUP_SURFACES)
    expect(await repo.eligibleAmong([privateId], surface)).toEqual([])
    expect(await repo.eligibleAmong([privateId], { status: 'approved', active: true })).toEqual([])
    expect(await repo.eligibleIds({ status: 'approved', active: true })).not.toContain(privateId)
    expect(await repo.sampleIds({ status: 'approved', active: true }, 50, 1)).not.toContain(privateId)
  })

  it('[CI] the Jana scope (media and bank predicates together) leaves it out', async () => {
    const { from, where } = janaEligibleScope()
    const ids = (await prisma.client.$queryRaw<{ id: bigint }[]>`SELECT q.id ${from} WHERE ${where}`).map((r) => String(r.id))
    expect(ids).not.toContain(privateId)
  })
})
