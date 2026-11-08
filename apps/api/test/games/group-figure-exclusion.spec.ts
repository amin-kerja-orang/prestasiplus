import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { prngStream } from '../../src/db/prng'
import { GameQuestions } from '../../src/modules/games/core/game-questions.service'
import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { adminActor, mcqInput, tagOf, type Tag } from '../questions/fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from '../questions/helpers'

/**
 * [CI] S1-T06 / FR-X1-4e (46 section 5.1, surface `permainan`): a game serves standalone text questions only. A group member is never drawn, and a
 * question with a figure is not either.
 */
let t: QuestionsTestApp
let tag: Tag
let games: GameQuestions
const made: Record<string, string> = {}

const q = (sql: string, params: unknown[] = []) => t.db.query<{ id: string }>(sql, params)

async function publish(key: string, over: Record<string, unknown> = {}): Promise<string> {
  const admin = await adminActor(t.db)
  const created = await t.app.get(QuestionsService).create(mcqInput(tag, { questionText: `Soalan ${key} permainan`, ...over }), admin)
  await q(`update question_versions set status = 'approved', published_at = now() where question_id = $1`, [created.id])
  await q(`update questions set live_version_no = 1 where id = $1`, [created.id])
  made[key] = created.id
  return created.id
}

beforeAll(async () => {
  t = await bootQuestionsApp()
  tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
  await q(`update questions set is_active = false`)
  for (const k of ['t1', 't2', 't3', 't4']) await publish(k)

  const svc = t.app.get(QuestionsService)
  const passage = await svc.createStimulus({ kind: 'passage', label: 'Petikan permainan', bodyMs: 'Teks petikan.', bodyEn: null, altText: null, assetFileId: null })
  const groupId = await svc.createStimulusGroup({ label: 'Petikan permainan', scope: 'section', stimulusIds: [passage], optionBank: [] })
  for (const k of ['g1', 'g2', 'g3']) await publish(k, { stimulusGroupId: groupId })

  await publish('figure')
  const [file] = await q(
    `insert into files (public_id, owner_user_id, purpose, mime, size_bytes, sha256, storage_key)
     values ($1, null, 'question_image', 'image/png', 10, $2, 'games-fig-key') returning id::text id`,
    ['gm'.padEnd(22, 'A'), 'e'.repeat(64)],
  )
  const [stimulus] = await q(`insert into stimuli (kind, label, alt_text, asset_file_id) values ('image', 'Rajah 1', 'Rajah', $1) returning id::text id`, [file?.id])
  await q(`insert into question_version_stimuli (question_version_id, stimulus_id, position) select id, $2, 1 from question_versions where question_id = $1`, [made.figure, stimulus?.id])

  games = new GameQuestions(t.app.get(QuestionsRepository), { client: { practiceAnswer: { findMany: async () => [] } } } as never, { now: () => new Date('2026-11-05T00:00:00Z') } as never)
}, 180_000)

afterAll(async () => {
  await t.close()
})

describe('[CI] S1-T06 games draw: standalone text questions only', () => {
  const draw = async (): Promise<string[]> => (await games.sample({ subjectId: tag.subjectId }, 50, prngStream('games:group'))).map((s) => s.question.id)

  it('never draws a member of a stimulus group', async () => {
    const ids = await draw()
    for (const k of ['g1', 'g2', 'g3']) expect(ids).not.toContain(made[k])
    expect([...ids].sort()).toEqual(expect.arrayContaining(['t1', 't2', 't3', 't4'].map((k) => made[k] as string).sort()))
  })

  it('the eligible count (the gate) leaves the group members out too', async () => {
    const n = await games.eligibleCount({ subjectId: tag.subjectId })
    expect(n).toBe(4) // the 4 text questions: neither the 3 members nor the figure question
  })

  it('never draws a question with a figure (reason image_games)', async () => {
    const ids = await draw()
    expect(ids).not.toContain(made.figure)
    expect(ids.length).toBe(4)
  })
})
