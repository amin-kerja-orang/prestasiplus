import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { KuizService } from '../../src/modules/bijak/kuiz/kuiz.service'
import { Be09PracticeQuestionSource } from '../../src/modules/practice/question-bridge/be09-practice-question-source'
import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { GROUP_WITHOUT_STIMULUS_MESSAGE } from '../../src/modules/questions/serving/approval-guard'
import type { UsersRepository } from '../../src/modules/users'
import { adminActor, mcqInput, tagOf, type Tag } from '../questions/fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from '../questions/helpers'
import { filesOf } from '../support/files-stub'

/**
 * M1 / m-4 / m-5: a by-id read serves what the draw serves. A question whose live version is flagged (`stimulus_missing`), held
 * (`legacy_image_unresolved`) or whose group has such a member is NOT served by `live` (Ulang Kaji, history top-up, remedial and mission all
 * read through it), `servableRecords` (grouped drills), the kuiz group completion, nor counted as a complete group. Synthetic rows only.
 */
let t: QuestionsTestApp
let tag: Tag
let repo: QuestionsRepository
let source: Be09PracticeQuestionSource
const made: Record<string, string> = {}
const q = (sql: string, params: unknown[] = []) => t.db.query<{ id: string }>(sql, params)

async function publish(key: string, over: Record<string, unknown> = {}): Promise<string> {
  const admin = await adminActor(t.db)
  const created = await t.app.get(QuestionsService).create(mcqInput(tag, { questionText: `Soalan ${key} ditahan`, ...over }), admin)
  await q(`update question_versions set status = 'approved', published_at = now() where question_id = $1`, [created.id])
  await q(`update questions set live_version_no = 1 where id = $1`, [created.id])
  made[key] = created.id
  return created.id
}
const flag = (key: string) => q(`update question_versions set stimulus_flag = 'stimulus_missing' where question_id = $1`, [made[key]])
const hold = (key: string) => q(`update question_versions set import_issues = '[{"code":"legacy_image_unresolved"}]'::jsonb where question_id = $1`, [made[key]])
const group = async (label: string): Promise<string> => {
  const svc = t.app.get(QuestionsService)
  const passage = await svc.createStimulus({ kind: 'passage', label, bodyMs: 'Teks petikan.', bodyEn: null, altText: null, assetFileId: null })
  return svc.createStimulusGroup({ label, scope: 'section', stimulusIds: [passage], optionBank: [] })
}

beforeAll(async () => {
  t = await bootQuestionsApp()
  repo = t.app.get(QuestionsRepository)
  tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
  await q(`update questions set is_active = false`)
  await publish('ok')
  await publish('flagged')
  await flag('flagged')
  await publish('held')
  await hold('held')
  const good = await group('Kumpulan baik')
  for (const k of ['gok1', 'gok2']) await publish(k, { stimulusGroupId: good })
  const bad = await group('Kumpulan ada ahli ditanda')
  for (const k of ['gbad1', 'gbad2']) await publish(k, { stimulusGroupId: bad })
  await flag('gbad2')
  source = new Be09PracticeQuestionSource(repo, { getMany: () => Promise.resolve([]) } as unknown as UsersRepository, undefined, filesOf(t.db) as never)
}, 180_000)

afterAll(async () => {
  await t.close()
})

describe('live() (Ulang Kaji, history top-up, remedial, mission: no drill activity)', () => {
  it('does not serve a flagged or held question, serves the clean one', async () => {
    const got = await source.live([made.ok, made.flagged, made.held] as string[])
    expect([...got.keys()]).toEqual([made.ok])
  })
})

describe('servableRecords() through live(ids, drill)', () => {
  it('drops a flagged / held single and serves a clean group whole', async () => {
    const got = await source.live([made.ok, made.flagged, made.held, made.gok1, made.gok2] as string[], 'databank')
    expect([...got.keys()].sort()).toEqual([made.ok, made.gok1, made.gok2].sort())
  })

  it('a group with a flagged member is out whole: the clean sibling is not served either (never split)', async () => {
    const got = await source.live([made.gbad1, made.gbad2] as string[], 'databank')
    expect(got.size).toBe(0)
    expect((await source.live([made.gbad1] as string[], 'bab')).size).toBe(0)
  })

  it('a held member of a clean group drops the group', async () => {
    await hold('gok2')
    expect((await source.live([made.gok1, made.gok2] as string[], 'databank')).size).toBe(0)
    await q(`update question_versions set import_issues = null where question_id = $1`, [made.gok2])
    expect((await source.live([made.gok1, made.gok2] as string[], 'databank')).size).toBe(2)
  })
})

describe('m-4: the gap count', () => {
  it('a flagged member is a gap: the group is incomplete; a clean group is not', async () => {
    const gids = await q(`select group_id::text id from questions where id in ($1::bigint, $2::bigint) order by id`, [made.gok1, made.gbad1])
    const incomplete = await repo.incompleteGroups(gids.map((g) => g.id))
    expect([...incomplete.keys()]).toEqual([gids[1]?.id])
    expect(incomplete.get(gids[1]?.id as string)).toBe(1)
    expect(await repo.eligibleAmong([made.gok1, made.gbad1, made.gbad2] as string[], { wholeGroups: true })).toEqual([made.gok1])
  })
})

describe('kuiz group completion', () => {
  it('a flagged group member is not added as an extra (the group then falls short of its size)', async () => {
    const kuiz = Object.create(KuizService.prototype) as { questions: QuestionsRepository; withGroupMembers: (r: unknown[]) => Promise<{ records: { id: string }[]; sizes: Map<string, number> }> }
    kuiz.questions = repo
    const first = (await repo.getMany([made.gbad1] as string[], 'live'))[0]
    const out = await kuiz.withGroupMembers([first])
    expect(out.records.map((r) => r.id)).toEqual([made.gbad1])
    expect([...out.sizes.values()]).toEqual([2])
    const clean = await kuiz.withGroupMembers([(await repo.getMany([made.gok1] as string[], 'live'))[0]])
    expect(clean.records.map((r) => r.id).sort()).toEqual([made.gok1, made.gok2].sort())
  })
})

describe('m-5: approving a grouped member', () => {
  it('is refused when its group has no stimulus, with a BM message on `media`; a group with a stimulus passes', async () => {
    const empty = await group('Kumpulan kosong')
    const id = await publish('orphan', { stimulusGroupId: empty })
    await q(`delete from stimulus_group_stimuli where group_id = $1::bigint`, [empty])
    const fields = await t.app.get(QuestionsService).gateFieldsOf(id, 'approve')
    expect(fields.media).toBe(GROUP_WITHOUT_STIMULUS_MESSAGE)
    expect((await t.app.get(QuestionsService).gateFieldsOf(made.gok1 as string, 'approve')).media).toBeUndefined()
  })
})
