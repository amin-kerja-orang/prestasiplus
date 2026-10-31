import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { STUDIO_GROUP_MESSAGES as M, StudioDskpSchema, StudioGroupSchema, type StudioGroup } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { makePng } from '../files/fixtures'
import { expectCsrfInvalid, expectError, loginAs, bootQuestionsApp, questionIdOf, type Client, type QuestionsTestApp } from './helpers'
import { tagOf, type Tag } from './fixtures'

/**
 * T13 (D90) write side of stimulus groups: one stimulus stored once, with its member questions added, removed and reordered
 * through the group; a question is in one group only; a group with a served member is read-only; admin only.
 */
describe('Studio stimulus groups (real database)', () => {
  let t: QuestionsTestApp
  let admin: Client
  let guru: Client
  let tag: Tag

  beforeAll(async () => {
    process.env.FILE_STORAGE_DIR = await mkdtemp(join(tmpdir(), 'pp-q-studio-'))
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    guru = await loginAs(t, 'teacher')
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
  })
  afterAll(async () => {
    await t.close()
  })

  const mcq = (n: number) => ({
    subjectId: tag.subjectId,
    educationLevelId: tag.levelId,
    difficultyLevel: 3,
    questionType: 'mcq',
    questionText: `Rajah 1 menunjukkan satu segi tiga. Soalan nombor ${String(n)} tentang rajah itu?`,
    options: ['Satu', 'Dua', 'Tiga', 'Empat'],
    correctAnswer: 1,
  })
  async function newQuestion(n: number): Promise<string> {
    const res = await admin.post('/api/questions', mcq(n))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data.id as string
  }
  const group = (res: { body: { data: unknown } }): StudioGroup => StudioGroupSchema.parse(res.body.data)
  const passage = { kind: 'passage', label: 'Petikan 1', body: 'Ali pergi ke pasar tani setiap Sabtu.' }
  const sql = async <T extends Record<string, unknown> = Record<string, unknown>>(q: string, p: unknown[] = []) => t.db.query<T>(q, p)

  it('one figure with two questions is ONE group: the stimulus is stored once and both members read it', async () => {
    const png = await admin.post('/api/files?purpose=question_image').attach('file', makePng(), { filename: 'rajah1.png', contentType: 'image/png' })
    expect(png.status).toBe(201)
    const [s1, s2] = [await newQuestion(1), await newQuestion(2)]
    const stimuliBefore = Number((await sql<{ n: string }>('select count(*) n from stimuli'))[0]?.n)

    const res = await admin.post('/api/questions/studio/groups', {
      label: 'Rajah 1',
      stimuli: [{ kind: 'diagram', label: 'Rajah 1', alt: 'Segi tiga bersudut tegak', imageFileId: (png.body.data as { id: string }).id }],
      questionIds: [s1, s2],
    })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const g = group(res)
    expect(g.members.map((m) => m.id)).toEqual([s1, s2])
    expect(g.members.map((m) => m.position)).toEqual([1, 2])
    expect(g.complete).toBe(true)
    expect(g.issues).toEqual([])
    expect(g.stimuli).toHaveLength(1)
    expect(g.stimuli[0]?.imageId).toBe((png.body.data as { id: string }).id)
    expect(Number((await sql<{ n: string }>('select count(*) n from stimuli'))[0]?.n)).toBe(stimuliBefore + 1)

    // Either member reads the same single stimulus through its admin detail.
    for (const id of [s1, s2]) {
      const detail = await admin.get(`/api/questions/${id}`)
      expect(detail.body.data.stimulusGroup.id).toBe(g.id)
      expect(detail.body.data.stimulusGroup.questionIds).toEqual([s1, s2])
    }
  })

  it('adds, removes and reorders members; positions stay 1..n and a removed question is an ordinary question again', async () => {
    const [a, b, c] = [await newQuestion(11), await newQuestion(12), await newQuestion(13)]
    const g0 = group(await admin.post('/api/questions/studio/groups', { stimuli: [passage], questionIds: [a, b] }))
    expect(g0.complete).toBe(true)

    // add at the end, then at position 1
    const addRes = await admin.post(`/api/questions/studio/groups/${g0.id}/members`, { questionId: c, position: 1 })
    expect(addRes.status, JSON.stringify(addRes.body)).toBe(200)
    const added = group(addRes)
    expect(added.members.map((m) => m.id)).toEqual([c, a, b])

    // reorder in one call
    const reordered = group(await admin.put(`/api/questions/studio/groups/${g0.id}/members`, { questionIds: [b, c, a] }))
    expect(reordered.members.map((m) => m.id)).toEqual([b, c, a])
    expect(reordered.members.map((m) => m.position)).toEqual([1, 2, 3])
    const rows = await sql<{ id: string; group_position: number }>('select id::text id, group_position from questions where group_id = $1 order by group_position', [g0.id])
    expect(rows.map((r) => r.id)).toEqual([b, c, a])

    // remove the middle one: the rest close up, the removed question has no group
    const removed = group(await admin.delete(`/api/questions/studio/groups/${g0.id}/members/${c}`))
    expect(removed.members.map((m) => [m.id, m.position])).toEqual([[b, 1], [a, 2]])
    expect((await sql<{ group_id: string | null; group_position: number | null }>('select group_id::text group_id, group_position from questions where id = $1', [c]))[0]).toEqual({ group_id: null, group_position: null })

    // a single member is not a group yet (D90)
    const one = group(await admin.put(`/api/questions/studio/groups/${g0.id}/members`, { questionIds: [b] }))
    expect(one.complete).toBe(false)
    expect(one.issues).toContain(M.needsTwo)
  })

  it('refuses a question that is already in another group, unknown ids and duplicates', async () => {
    const [a, b] = [await newQuestion(21), await newQuestion(22)]
    const g1 = group(await admin.post('/api/questions/studio/groups', { stimuli: [passage], questionIds: [a, b] }))
    const other = group(await admin.post('/api/questions/studio/groups', { stimuli: [passage] }))
    expect(other.memberCount).toBe(0)
    expect(other.complete).toBe(false)

    expectError(await admin.post(`/api/questions/studio/groups/${other.id}/members`, { questionId: a }), 'CONFLICT', M.memberElsewhere)
    expect(group(await admin.get(`/api/questions/studio/groups/${g1.id}`)).members.map((m) => m.id)).toEqual([a, b])

    const unknown = await admin.put(`/api/questions/studio/groups/${other.id}/members`, { questionIds: ['999999999'] })
    expect(expectError(unknown, 'VALIDATION_ERROR').fields).toEqual({ questionIds: M.memberUnknown })
    const dup = await admin.put(`/api/questions/studio/groups/${other.id}/members`, { questionIds: [a, a] })
    expect(expectError(dup, 'VALIDATION_ERROR').fields).toEqual({ questionIds: M.memberDuplicate })
    expectError(await admin.delete(`/api/questions/studio/groups/${other.id}/members/${a}`), 'NOT_FOUND', M.memberNotIn)
  })

  it('manages the stimuli of a group: at most 3, never none, the picture must be an uploaded question image', async () => {
    const g = group(await admin.post('/api/questions/studio/groups', { stimuli: [passage] }))
    const two = group(await admin.post(`/api/questions/studio/groups/${g.id}/stimuli`, { kind: 'table', label: 'Jadual 1', table: { head: ['Hari', 'Suhu'], rows: [['Isnin', '30']] } }))
    expect(two.stimuli.map((s) => s.kind)).toEqual(['passage', 'table'])
    expect(two.stimuli[1]?.table).toEqual({ head: ['Hari', 'Suhu'], rows: [['Isnin', '30']] })
    group(await admin.post(`/api/questions/studio/groups/${g.id}/stimuli`, { kind: 'passage', body: 'Petikan tiga.' }))
    const fourth = await admin.post(`/api/questions/studio/groups/${g.id}/stimuli`, { kind: 'passage', body: 'Petikan empat.' })
    expect(expectError(fourth, 'VALIDATION_ERROR').fields).toEqual({ stimuli: M.stimuli })

    const patched = group(await admin.patch(`/api/questions/studio/groups/${g.id}/stimuli/${two.stimuli[0]?.id}`, { caption: 'Sumber: buku teks', body: 'Teks baharu.' }))
    expect(patched.stimuli[0]).toMatchObject({ caption: 'Sumber: buku teks', body: 'Teks baharu.' })

    const bad = await admin.patch(`/api/questions/studio/groups/${g.id}/stimuli/${two.stimuli[0]?.id}`, { imageFileId: 'bukan-fail' })
    expect(expectError(bad, 'VALIDATION_ERROR').fields).toEqual({ imageFileId: M.image })
    const empty = await admin.post('/api/questions/studio/groups', { stimuli: [{ kind: 'passage' }] })
    expect(expectError(empty, 'VALIDATION_ERROR').fields).toEqual({ 'stimuli.0.body': M.stimulusEmpty })

    let cur = patched
    for (const s of patched.stimuli.slice(1)) cur = group(await admin.delete(`/api/questions/studio/groups/${g.id}/stimuli/${s.id}`))
    expect(cur.stimuli.map((s) => s.id)).toEqual([patched.stimuli[0]?.id])
  })

  it('the last stimulus cannot be removed', async () => {
    const g = group(await admin.post('/api/questions/studio/groups', { stimuli: [passage] }))
    expectError(await admin.delete(`/api/questions/studio/groups/${g.id}/stimuli/${g.stimuli[0]?.id}`), 'CONFLICT', M.lastStimulus)
  })

  it('dissolving frees the members and removes the stimulus that nothing else uses', async () => {
    const [a, b] = [await newQuestion(31), await newQuestion(32)]
    const g = group(await admin.post('/api/questions/studio/groups', { stimuli: [passage], questionIds: [a, b] }))
    const res = await admin.delete(`/api/questions/studio/groups/${g.id}`)
    expect(res.status).toBe(200)
    expect(res.body.data.detachedQuestionIds).toEqual([a, b])
    expect(await sql('select 1 from stimulus_groups where id = $1', [g.id])).toHaveLength(0)
    expect(await sql('select 1 from stimuli where id = $1', [g.stimuli[0]?.id])).toHaveLength(0)
    expect((await sql<{ n: string }>('select count(*) n from questions where id = any($1::bigint[]) and group_id is null', [[a, b]]))[0]?.n).toBe('2')
  })

  it('a group with a served member is read-only until that question is archived', async () => {
    const served = await questionIdOf(t.db, 'SEED-GRP-PASAR-1')
    const gid = (await sql<{ group_id: string }>('select group_id::text group_id from questions where id = $1', [served]))[0]?.group_id as string
    const members = group(await admin.get(`/api/questions/studio/groups/${gid}`))
    expect(members.locked).toBe(true)
    expectError(await admin.put(`/api/questions/studio/groups/${gid}/members`, { questionIds: [...members.members.map((m) => m.id)].reverse() }), 'CONFLICT', M.locked)
    expectError(await admin.post(`/api/questions/studio/groups/${gid}/stimuli`, passage), 'CONFLICT', M.locked)
    expectError(await admin.delete(`/api/questions/studio/groups/${gid}`), 'CONFLICT', M.locked)
    // The order of the members is unchanged.
    expect(group(await admin.get(`/api/questions/studio/groups/${gid}`)).members.map((m) => m.id)).toEqual(members.members.map((m) => m.id))
    // A served question cannot be pulled into another group either.
    const free = group(await admin.post('/api/questions/studio/groups', { stimuli: [passage] }))
    const standalone = await questionIdOf(t.db, 'SEED-MCQ-MATH-T4')
    expectError(await admin.post(`/api/questions/studio/groups/${free.id}/members`, { questionId: standalone }), 'CONFLICT', M.locked)
  })

  it('is Admin Pusat only and every write needs the CSRF header', async () => {
    const g = group(await admin.post('/api/questions/studio/groups', { stimuli: [passage] }))
    expectError(await guru.get(`/api/questions/studio/groups/${g.id}`), 'FORBIDDEN')
    expectError(await guru.post('/api/questions/studio/groups', { stimuli: [passage] }), 'FORBIDDEN')
    expectError(await guru.get(`/api/questions/studio/dskp?subjectId=${tag.subjectId}&educationLevelId=${tag.levelId}`), 'FORBIDDEN')
    expectError(await t.http().get(`/api/questions/studio/groups/${g.id}`) as never, 'UNAUTHORIZED')
    expectCsrfInvalid(await admin.noCsrf.post('/api/questions/studio/groups', { stimuli: [passage] }))
    expectCsrfInvalid(await admin.noCsrf.put(`/api/questions/studio/groups/${g.id}/members`, { questionIds: [] }))
    expectError(await admin.get('/api/questions/studio/groups/abc'), 'NOT_FOUND')
  })

  it('the DSKP picker lists the units of a subject and level with their SP nodes', async () => {
    const res = await admin.get(`/api/questions/studio/dskp?subjectId=${tag.subjectId}&educationLevelId=${tag.levelId}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const dskp = StudioDskpSchema.parse(res.body.data)
    expect(dskp.units.length).toBeGreaterThan(0)
    expect(dskp.units.some((u) => u.id === tag.unitId && u.sps.some((s) => s.id === tag.spId))).toBe(true)
    expect(expectError(await admin.get('/api/questions/studio/dskp?subjectId=x'), 'VALIDATION_ERROR').fields).toBeDefined()
  })
})
