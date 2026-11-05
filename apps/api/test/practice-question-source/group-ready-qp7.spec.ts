import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { prngStream } from '../../src/db/prng'
import { Be09PracticeQuestionSource } from '../../src/modules/practice/question-bridge/be09-practice-question-source'
import { OverviewRepository } from '../../src/modules/practice/reads/overview/overview.repository'
import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { ALL_GROUP_SURFACES, evaluate } from '../../src/modules/questions/serving'
import { ServabilityService } from '../../src/modules/questions/serving/servability.service'
import type { UsersRepository } from '../../src/modules/users'
import { adminActor, mcqInput, tagOf, type Tag } from '../questions/fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from '../questions/helpers'

/**
 * AC-MUR-QP-7: a Latih Tubi test subject with 50 single MCQs and one stimulus group of 3 members: card = details = draw = 53, group whole;
 * with a member's figure asset missing the whole group is out (card 50) and the admin read names the reason. The surfaces are injected here;
 * GROUP_SURFACES itself is flipped by S5-T03, which closes the live AC.
 */
let t: QuestionsTestApp
let tag: Tag
let source: Be09PracticeQuestionSource
let overview: OverviewRepository
let chapterId: string
let stimulusId: string
const members: string[] = []

const q = (sql: string, params: unknown[] = []) => t.db.query<{ id: string }>(sql, params)

async function publish(key: string, over: Record<string, unknown> = {}): Promise<string> {
  const admin = await adminActor(t.db)
  const created = await t.app.get(QuestionsService).create(mcqInput(tag, { questionText: `Soalan ${key} qp7`, ...over }), admin)
  await q(`update question_versions set status = 'approved', published_at = now(), chapter_id = $2 where question_id = $1`, [created.id, chapterId])
  await q(`update questions set live_version_no = 1 where id = $1`, [created.id])
  return created.id
}

const draw = (): Promise<string[]> => source.sample({ subjectId: tag.subjectId, activity: 'latih_tubi_spm', spmPool: true }, 100, prngStream('qp7'))
const cardTotal = async (): Promise<number> => (await overview.bankMatrix()).filter((c) => c.subjectId === tag.subjectId).reduce((s, c) => s + c.n, 0)

beforeAll(async () => {
  t = await bootQuestionsApp()
  const repo = t.app.get(QuestionsRepository)
  tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
  await q(`update questions set is_active = false`)
  chapterId = (await q(`select id::text id from chapters where subject_id = $1 order by id limit 1`, [tag.subjectId]))[0]?.id as string
  for (let i = 1; i <= 50; i++) await publish(`single${String(i)}`)

  const [file] = await q(
    `insert into files (public_id, owner_user_id, purpose, mime, size_bytes, sha256, storage_key)
     values ($1, null, 'question_image', 'image/png', 10, $2, 'qp7-key') returning id::text id`,
    ['qp7'.padEnd(22, 'A'), 'd'.repeat(64)],
  )
  const [stimulus] = await q(`insert into stimuli (kind, label, alt_text, asset_file_id) values ('image', 'Rajah 1', 'Rajah', $1) returning id::text id`, [file?.id])
  stimulusId = stimulus?.id as string
  const svc = t.app.get(QuestionsService)
  const groupId = await svc.createStimulusGroup({ label: 'Petikan qp7', scope: 'section', stimulusIds: [stimulusId], optionBank: [] })
  for (const k of ['g1', 'g2', 'g3']) members.push(await publish(k, { stimulusGroupId: groupId }))

  const surfaces = ALL_GROUP_SURFACES
  source = new Be09PracticeQuestionSource(repo, { getMany: () => Promise.resolve([]) } as unknown as UsersRepository, surfaces)
  overview = new OverviewRepository({ client: t.db.prisma } as never, surfaces)
}, 240_000)

afterAll(async () => {
  await t.close()
})

describe('[CI] S1-T06 building block of AC-MUR-QP-7 (injected surfaces; the live AC needs S5-T03)', () => {
  it('50 single MCQs + a complete 3-member group: card = details = draw = 53, the group whole and contiguous in order', async () => {
    const ids = await draw()
    expect(ids.length).toBe(53)
    expect(await cardTotal()).toBe(53)
    expect((await overview.chapterQuestionCounts([chapterId])).get(chapterId)).toBe(53)
    expect((await source.chapterCounts([chapterId], true)).get(chapterId)).toBe(53)
    const at = members.map((m) => ids.indexOf(m))
    expect(at[0]).toBeGreaterThanOrEqual(0)
    expect(at).toEqual([at[0], (at[0] as number) + 1, (at[0] as number) + 2])
  })

  it('a member\'s figure asset missing: the whole group is out, card = details = draw = 50, and the admin read names the reason', async () => {
    await q(`update stimuli set asset_file_id = null where id = $1`, [stimulusId])
    const ids = await draw()
    expect(ids.length).toBe(50)
    for (const m of members) expect(ids).not.toContain(m)
    expect(await cardTotal()).toBe(50)
    expect((await overview.chapterQuestionCounts([chapterId])).get(chapterId)).toBe(50)
    expect((await source.chapterCounts([chapterId], true)).get(chapterId)).toBe(50)

    const facts = (await t.app.get(ServabilityService).factsOf([members[1] as string])).get(members[1] as string)
    expect(facts).toBeDefined()
    const verdict = evaluate(facts as NonNullable<typeof facts>, 'latih_tubi_spm', ALL_GROUP_SURFACES)
    expect(verdict.served).toBe(false)
    expect(verdict.reasons.map((r) => r.code)).toEqual(expect.arrayContaining([expect.stringMatching(/^(image_missing|bridge_refused|group_incomplete)$/)]))
  })
})
