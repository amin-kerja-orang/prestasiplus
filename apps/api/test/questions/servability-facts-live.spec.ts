import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { ServabilityService } from '../../src/modules/questions/serving'
import { adminActor, mcqInput, tagBody, tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'

/**
 * REQ-B-022(a): `factsOf` no longer reads a question twice when its live version is its latest version. Oracle: the repository's own
 * two reads, `getMany(ids, 'latest')` and `getMany(ids, 'live')`, on a bank where live and latest differ, a question is archived, has
 * no live version, is held, or is a group member. The facts carry exactly those records, in the same shape, and the same ids.
 */
describe('factsOf: the live record is the latest record when they are the same version (REQ-B-022a)', () => {
  let t: QuestionsTestApp
  let repo: QuestionsRepository
  let servability: ServabilityService
  let tag: Tag
  const made: Record<string, string> = {}
  const q = (sql: string, params: unknown[] = []) => t.db.query<{ id: string }>(sql, params)

  async function approve(key: string, text: string, over: Record<string, unknown> = {}): Promise<string> {
    const svc = t.app.get(QuestionsService)
    const created = await svc.create(mcqInput(tag, { questionText: text, tag: tagBody(tag, 4), ...over }), await adminActor(t.db))
    await q(`update question_versions set status = 'approved', published_at = now() where question_id = $1`, [created.id])
    await q(`update questions set live_version_no = 1 where id = $1`, [created.id])
    made[key] = created.id
    return created.id
  }

  beforeAll(async () => {
    t = await bootQuestionsApp()
    repo = t.app.get(QuestionsRepository)
    servability = t.app.get(ServabilityService)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    const svc = t.app.get(QuestionsService)
    await approve('plain', 'Soalan biasa yang hidup pada versi terkini.')
    // live is v1, latest is a draft v2
    await approve('liveOlder', 'Soalan hidup dengan draf baharu.')
    await svc.update(made.liveOlder!, mcqInput(tag, { questionText: 'Draf kedua soalan hidup.' }), await adminActor(t.db))
    await approve('archived', 'Soalan yang diarkibkan.')
    await q(`update question_versions set status = 'archived' where question_id = $1`, [made.archived])
    await q(`update questions set live_version_no = null where id = $1`, [made.archived])
    made.draft = (await svc.create(mcqInput(tag, { questionText: 'Soalan draf tanpa versi hidup.' }), await adminActor(t.db))).id
    await approve('held', 'Soalan yang dimatikan.')
    await q(`update questions set is_active = false where id = $1`, [made.held])
    const passage = await svc.createStimulus({ kind: 'passage', label: 'Petikan', bodyMs: 'Teks.', bodyEn: null, altText: null, assetFileId: null })
    const groupId = await svc.createStimulusGroup({ label: 'Kumpulan', scope: 'section', stimulusIds: [passage], optionBank: [] })
    await approve('grouped', 'Ahli kumpulan.', { stimulusGroupId: groupId })
  })
  afterAll(async () => {
    await t.close()
  })

  it('latest and live of every fact equal the repository reads, for each kind of question', async () => {
    const ids = Object.values(made)
    const facts = await servability.factsOf(ids)
    const latest = new Map((await repo.getMany(ids, 'latest')).map((r) => [r.id, r]))
    const live = new Map((await repo.getMany(ids, 'live')).map((r) => [r.id, r]))
    expect([...facts.keys()].sort()).toEqual([...latest.keys()].sort())
    for (const [id, f] of facts) {
      expect(f.latest, `latest of ${id}`).toEqual(latest.get(id))
      expect(f.live, `live of ${id}`).toEqual(live.get(id) ?? null)
    }
    // the bank really has each case
    expect(facts.get(made.liveOlder!)!.live?.version.versionNo).toBe(1)
    expect(facts.get(made.liveOlder!)!.latest.version.versionNo).toBe(2)
    expect(facts.get(made.archived!)!.live).toBeNull()
    expect(facts.get(made.draft!)!.live).toBeNull()
    expect(facts.get(made.held!)!.live?.isActive).toBe(false)
    expect(facts.get(made.plain!)!.live).toEqual(facts.get(made.plain!)!.latest)
  })
})
