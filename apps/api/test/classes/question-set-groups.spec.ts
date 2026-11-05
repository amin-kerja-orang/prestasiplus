import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { QuestionSetStudentListSchema } from '@pp/contract'
import type { ServabilityActivity } from '@pp/contract'

import { PracticePorts } from '../../src/modules/practice'
import { QuestionsService } from '../../src/modules/questions'
import { GROUP_SURFACES } from '../../src/modules/questions/serving'
import { adminActor, mcqInput } from '../questions/fixtures'
import { bootMissionsApp, loadWorld, makeClass, publishedMcq, type MissionsTestApp, type World } from '../missions/helpers'
import { client, type Client } from '../classes/helpers'
import { insertSet } from '../missions/qs-helpers'

/**
 * S1-T06 (D91, #767): a teacher question set serves a stimulus group whole or not at all. The pupil list count and the questions a start
 * serves come from the same filtered ids, and the group members stay contiguous in set order. The bab surface is made a group surface here
 * (S5-T03 flips the real list), so the start path is exercised the way it will run.
 */
describe('question sets: stimulus groups are whole or not at all', () => {
  let t: MissionsTestApp
  let w: World
  let pupil: Client
  let classId: string
  let seq = 0

  beforeAll(async () => {
    t = await bootMissionsApp({ full: true })
    w = await loadWorld(t)
    await t.db.query(`insert into comp_students (user_id, package_expires_on) values ($1, '2027-12-31') on conflict do nothing`, [w.student1])
    pupil = await client(t, 'pelajar@demo.test')
    classId = await makeClass(t, w, w.teacherA, [w.student1], 'Kelas Kumpulan')
    // The bab surface allows groups (what S5-T03 will do for real): set on the bound source only.
    const source = t.get(PracticePorts).questions as unknown as { surfaces: readonly ServabilityActivity[] }
    source.surfaces = [...GROUP_SURFACES, 'bab']
  }, 180_000)
  afterAll(async () => {
    await t.close()
  })

  const text = (): Promise<string> => publishedMcq(t, w, { text: `Soalan set kumpulan ${String(++seq)}` })

  const member = async (groupId: string, approve = true): Promise<string> => {
    seq += 1
    const created = await t.get(QuestionsService).create(mcqInput(w.tag, { questionText: `Ahli kumpulan ${String(seq)}`, stimulusGroupId: groupId }), await adminActor(t.db))
    if (approve) {
      await t.db.query(`update question_versions set status = 'approved', published_at = now() where question_id = $1`, [created.id])
      await t.db.query(`update questions set live_version_no = 1 where id = $1`, [created.id])
    }
    return created.id
  }

  const group = async (size: number, approvedAll = true): Promise<string[]> => {
    const svc = t.get(QuestionsService)
    const passage = await svc.createStimulus({ kind: 'passage', label: `Petikan ${String(++seq)}`, bodyMs: 'Teks petikan.', bodyEn: null, altText: null, assetFileId: null })
    const gid = await svc.createStimulusGroup({ label: `Kumpulan ${String(seq)}`, scope: 'section', stimulusIds: [passage], optionBank: [] })
    const ids: string[] = []
    for (let i = 0; i < size; i++) ids.push(await member(gid, approvedAll || i < size - 1))
    return ids
  }

  const countOf = async (setId: string): Promise<number> => {
    const res = await pupil.get('/set-soalan-saya')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return QuestionSetStudentListSchema.parse(res.body).data.find((s) => s.id === setId)?.questionCount ?? -1
  }
  const start = (setId: string) => pupil.post('/practice/sessions', { mode: 'question_set', questionSetId: setId })
  const set = (questionIds: string[]) => insertSet(t as never, { teacherId: w.teacherA, classroomId: classId, title: `Set ${String(++seq)}`, maxAttempts: 0, questionIds })

  it('a complete group plus 2 text questions: count 5, the start serves 5, the group is contiguous and in set order', async () => {
    const g = await group(3)
    const [a, b] = [await text(), await text()]
    const order = [a, ...g, b]
    const id = await set(order)
    expect(await countOf(id)).toBe(5)
    const res = await start(id)
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect((res.body.data.questions as { id: string }[]).map((q) => q.id)).toEqual(order)
  })

  it('a group with an ineligible member drops whole: the count and the served questions both fall by the group size', async () => {
    const g = await group(3, false) // the last member is not approved
    const [a, b] = [await text(), await text()]
    const id = await set([a, ...g, b])
    expect(await countOf(id)).toBe(2)
    const res = await start(id)
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect((res.body.data.questions as { id: string }[]).map((q) => q.id)).toEqual([a, b])
  })

  it('a group whose members are not all in the set drops whole', async () => {
    const g = await group(3)
    const a = await text()
    const id = await set([a, g[0] as string, g[1] as string])
    expect(await countOf(id)).toBe(1)
  })

  it('a set made only of a complete group starts (no NOT_ENOUGH_QUESTIONS)', async () => {
    const g = await group(3)
    const id = await set(g)
    expect(await countOf(id)).toBe(3)
    const res = await start(id)
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect((res.body.data.questions as { id: string }[]).map((q) => q.id)).toEqual(g)
  })
})
