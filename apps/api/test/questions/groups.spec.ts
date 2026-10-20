import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { bootQuestionsApp, questionIdOf, type QuestionsTestApp } from './helpers'
import { adminActor, apiError, mcqInput, tagBody, tagOf, type Tag } from './fixtures'

const stimulus = (label: string) =>
  ({ kind: 'passage', label, bodyMs: `Petikan ${label}`, bodyEn: null, altText: null, assetFileId: null }) as const

/** AC 4 and AC 12 (service half): stimulus groups keep ordered members together; the 4 child tables round-trip. */
describe('stimulus groups and version child tables', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let repo: QuestionsRepository
  let tag: Tag
  let admin: Awaited<ReturnType<typeof adminActor>>
  beforeAll(async () => {
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    repo = t.app.get(QuestionsRepository)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    admin = await adminActor(t.db)
  })
  afterAll(async () => {
    await t.close()
  })

  it('a group of 3 questions around 3 stimuli: any member returns the same stimuli once, members in order', async () => {
    const s = [await svc.createStimulus(stimulus('S1')), await svc.createStimulus(stimulus('S2')), await svc.createStimulus(stimulus('S3'))]
    const groupId = await svc.createStimulusGroup({
      label: 'Kumpulan ujian', scope: 'section', stimulusIds: s,
      optionBank: [{ label: 'A', bodyMs: 'Pilihan A', bodyEn: null }, { label: 'B', bodyMs: 'Pilihan B', bodyEn: null }],
    })
    const members: string[] = []
    for (const n of [1, 2, 3]) {
      const q = await svc.create(mcqInput(tag, { questionText: `Soalan kumpulan nombor ${String(n)} untuk ujian.`, stimulusGroupId: groupId }), admin)
      members.push(q.id)
    }
    for (const id of members) {
      const group = await repo.groupOf(id)
      expect(group?.id).toBe(groupId)
      expect(group?.stimuli.map((x) => x.id)).toEqual(s)
      expect(new Set(group?.stimuli.map((x) => x.id)).size).toBe(3)
      expect(group?.questionIds).toEqual(members)
      expect(group?.optionBank.map((o) => o.label)).toEqual(['A', 'B'])
    }
    const detail = await svc.getAdmin(members[1] as string)
    expect(detail.stimulusGroup?.stimuli).toHaveLength(3)
    const positions = await t.db.query<{ group_position: number }>(`select group_position from questions where group_id = $1 order by group_position`, [groupId])
    expect(positions.map((p) => p.group_position)).toEqual([1, 2, 3])
  })

  it('a 4th stimulus on one group is refused with 422 on stimuli; so are zero, duplicates and unknown ids', async () => {
    const four = await Promise.all(['A', 'B', 'C', 'D'].map((l) => svc.createStimulus(stimulus(l))))
    const err = await apiError(() => svc.createStimulusGroup({ label: null, scope: 'section', stimulusIds: four, optionBank: [] }))
    expect(err.getStatus()).toBe(422)
    expect(Object.keys(err.fields ?? {})).toEqual(['stimuli'])
    for (const ids of [[], [four[0] as string, four[0] as string], ['999999999']]) {
      expect((await apiError(() => svc.createStimulusGroup({ label: null, scope: 'section', stimulusIds: ids, optionBank: [] }))).getStatus()).toBe(422)
    }
    expect(await t.db.query(`select 1 from stimulus_groups where label is null and id not in (select group_id from stimulus_group_stimuli)`)).toEqual([])
  })

  it('an unknown stimulus group on create is 422 on stimulusGroupId', async () => {
    const err = await apiError(() => svc.create(mcqInput(tag, { stimulusGroupId: '999999999' }), admin))
    expect(err.getStatus()).toBe(422)
    expect(Object.keys(err.fields ?? {})).toEqual(['stimulusGroupId'])
  })

  it('the seeded lettered option bank (4 items) reads back ordered with the 4 members', async () => {
    const group = await repo.groupOf(await questionIdOf(t.db, 'SEED-GRP-AYAT-2'))
    expect(group?.optionBank.map((o) => o.label)).toEqual(['A', 'B', 'C', 'D'])
    expect(group?.questionIds).toHaveLength(4)
    expect(group?.stimuli).toHaveLength(1)
  })

  it('a version reads back its SP nodes and ordered stimulus list identically, also after an edit', async () => {
    const id = await questionIdOf(t.db, 'SEED-GRP-PASAR-1')
    const before = await repo.get(id)
    expect(before?.version.spIds.length).toBeGreaterThanOrEqual(1)
    expect(before?.version.stimulusIds).toHaveLength(1)
    // Q-5: editing a published question writes version 2 (draft) that carries the same tag and stimuli.
    await svc.update(
      id,
      { subjectId: before!.version.subjectId!, educationLevelId: before!.version.educationLevelId!, difficultyLevel: 3, questionText: 'Pasar tani: soalan yang disunting semula.' },
      admin,
    )
    const latest = await repo.get(id, 'latest')
    expect(latest?.version.versionNo).toBe(2)
    expect(latest?.version.spIds).toEqual(before?.version.spIds)
    expect(latest?.version.stimulusIds).toEqual(before?.version.stimulusIds)
    expect(latest?.groupId).toBe(before?.groupId)
    expect((await repo.get(id))?.version.versionNo).toBe(1)
  })

  it('1 to 3 SP nodes are accepted, 4 are refused with 422 on tag, a foreign-subject SP is refused', async () => {
    const sps = await t.db.query<{ id: string }>(
      `select id::text from curriculum_nodes where kind = 'sp' and subject_id = $1 and education_level_id = $2 order by id limit 4`,
      [tag.subjectId, tag.levelId],
    )
    expect(sps.length).toBe(4)
    const ids = sps.map((s) => s.id)
    const ok = await svc.create(mcqInput(tag, { tag: { unitId: tag.unitId, spIds: ids.slice(0, 3), tp: 2 } }), admin)
    expect(ok.version.spIds).toEqual(ids.slice(0, 3))
    expect((await apiError(() => svc.create(mcqInput(tag, { tag: { unitId: tag.unitId, spIds: ids, tp: 2 } }), admin))).fields).toHaveProperty('tag')
    const other = (await t.db.query<{ id: string }>(`select id::text from curriculum_nodes where kind = 'sp' and subject_id <> $1 limit 1`, [tag.subjectId]))[0]!.id
    const foreign = await apiError(() => svc.create(mcqInput(tag, { tag: { unitId: tag.unitId, spIds: [other], tp: 2 } }), admin))
    expect(foreign.getStatus()).toBe(422)
    expect(foreign.fields).toHaveProperty('tag.spIds')
    const unitAsSp = await apiError(() => svc.create(mcqInput(tag, { tag: { unitId: tag.unitId, spIds: [tag.unitId], tp: 2 } }), admin))
    expect(unitAsSp.fields).toHaveProperty('tag.spIds')
  })

  it('deleting a question cascades to its versions, parts, SP nodes and stimulus links; the group survives', async () => {
    const q = await svc.create(mcqInput(tag, { tag: tagBody(tag, 2) }), admin)
    const versionIds = (await t.db.query<{ id: string }>(`select id::text from question_versions where question_id = $1`, [q.id])).map((v) => v.id)
    expect(versionIds).toHaveLength(1)
    await svc.remove(q.id, admin)
    for (const table of ['question_version_sp_nodes', 'question_version_stimuli']) {
      expect(await t.db.query(`select 1 from ${table} where question_version_id = $1`, [versionIds[0]])).toEqual([])
    }
    expect(await t.db.query(`select 1 from question_parts where question_version_id = $1`, [versionIds[0]])).toEqual([])
    expect((await apiError(() => svc.remove(q.id, admin))).getStatus()).toBe(404)
  })
})
