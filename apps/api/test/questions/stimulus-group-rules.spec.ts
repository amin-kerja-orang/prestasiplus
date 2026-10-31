import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { QuestionSchema, STIMULUS_MESSAGES, StimulusGroupDetailSchema, StimulusSchema, mutationEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { makePng } from '../files/fixtures'
import { bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, tagOf, type Refs } from './http-helpers'

/**
 * R1-T32 review closure (D90, D93): the group rules hold on EVERY path that changes a group, the served lock (approved = servable)
 * protects what pupils see, and a group is a draft until it has 2 questions. Real database, real session guard.
 */
describe('stimulus group rules (admin, real database)', () => {
  let t: QuestionsTestApp
  let admin: Client
  let refs: Refs
  let tag: Awaited<ReturnType<typeof tagOf>>

  beforeAll(async () => {
    process.env.FILE_STORAGE_DIR = await mkdtemp(join(tmpdir(), 'pp-group-rules-'))
    process.env.THROTTLE_QUESTIONS_WRITE_PER_MINUTE = '100000'
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
    tag = await tagOf(t.db, refs.mathId, refs.t4Id)
  })
  afterAll(async () => {
    await t.close()
  })

  const stimulus = async (): Promise<string> => {
    const res = await admin.post('/api/stimuli', { kind: 'passage', label: 'Petikan', body: { ms: 'Teks petikan.' } })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return mutationEnvelopeOf(StimulusSchema).parse(res.body).data.id
  }
  const question = async (over: Record<string, unknown> = {}): Promise<string> => {
    const res = await admin.post('/api/questions', mcqBody(refs, over))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return mutationEnvelopeOf(QuestionSchema).parse(res.body).data.id
  }
  /** A question shown to pupils: approved (and tagged), active. */
  const served = (over: Record<string, unknown> = {}): Promise<string> => question({ status: 'approved', tag, ...over })
  const group = async (questionIds: string[], stimulusIds?: string[]) => {
    const res = await admin.post('/api/stimulus-groups', { stimulusIds: stimulusIds ?? [await stimulus()], questionIds })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return mutationEnvelopeOf(StimulusGroupDetailSchema).parse(res.body).data
  }
  /** A group whose first member is served: made as a draft group, then a served question is created inside it. */
  const servedGroup = async () => {
    const g = await group([])
    const res = await admin.post(`/api/stimulus-groups/${g.id}/questions`, mcqBody(refs, { status: 'approved', tag }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const sid = mutationEnvelopeOf(QuestionSchema).parse(res.body).data.id
    const draft = await question()
    expect((await admin.post(`/api/stimulus-groups/${g.id}/members`, { questionId: draft })).status).toBe(200)
    return { id: g.id, served: sid, draft, stimulusId: g.stimuli[0]!.id }
  }
  const members = async (groupId: string): Promise<string[]> =>
    (await t.db.query<{ id: string }>(`select id::text id from questions where group_id = $1 order by group_position`, [groupId])).map((r) => r.id)
  const groupOf = async (questionId: string): Promise<string | null> =>
    (await t.db.query<{ g: string | null }>(`select group_id::text g from questions where id = $1`, [questionId]))[0]!.g

  describe('stimulusGroupId on /api/questions goes through the same rules', () => {
    it('PUT a member of group A into group B is refused (memberTaken); A and B are unchanged', async () => {
      const [a1, a2, b1] = [await question(), await question(), await question()] as [string, string, string]
      const a = await group([a1, a2])
      const b = await group([b1])
      const res = await admin.put(`/api/questions/${a1}`, mcqBody(refs, { stimulusGroupId: b.id }))
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(res.body.error.fields.stimulusGroupId).toBe(STIMULUS_MESSAGES.memberTaken)
      expect(await members(a.id)).toEqual([a1, a2])
      expect(await members(b.id)).toEqual([b1])
    })

    it('PUT a draft question into a group appends it; PUT null takes it out and the others close up', async () => {
      const [q1, q2] = [await question(), await question()] as [string, string]
      const g = await group([q1])
      const joined = await admin.put(`/api/questions/${q2}`, mcqBody(refs, { stimulusGroupId: g.id }))
      expect(joined.status, JSON.stringify(joined.body)).toBe(200)
      expect(await members(g.id)).toEqual([q1, q2])
      const left = await admin.put(`/api/questions/${q1}`, mcqBody(refs, { stimulusGroupId: null }))
      expect(left.status, JSON.stringify(left.body)).toBe(200)
      expect(await members(g.id)).toEqual([q2])
      expect((await t.db.query<{ p: number }>(`select group_position p from questions where id = $1`, [q2]))[0]!.p).toBe(1)
    })

    it('PUT / POST with an unknown group, or a group of another subject is 422 on stimulusGroupId', async () => {
      const g = await group([await question()])
      const sci = await question({ subjectId: refs.sciId })
      for (const [method, path] of [['put', `/api/questions/${sci}`], ['post', '/api/questions']] as const) {
        const mixed = await admin[method](path, mcqBody(refs, { subjectId: refs.sciId, stimulusGroupId: g.id }))
        expect(mixed.status, `${method} mixed`).toBe(422)
        expect(mixed.body.error.fields.stimulusGroupId).toBe(STIMULUS_MESSAGES.memberMixed)
        const unknown = await admin[method](path, mcqBody(refs, { stimulusGroupId: '987654321' }))
        expect(unknown.status, `${method} unknown`).toBe(422)
        expect(Object.keys(unknown.body.error.fields)).toEqual(['stimulusGroupId'])
      }
      expect(await groupOf(sci)).toBeNull()
    })

    it('served lock: a served member cannot be taken out or moved to another group by PUT /questions (409); nothing changes', async () => {
      const s = await servedGroup()
      const other = await group([await question()])
      for (const stimulusGroupId of [null, other.id]) {
        const res = await admin.put(`/api/questions/${s.served}`, mcqBody(refs, { stimulusGroupId }))
        expect(res.status, JSON.stringify(res.body)).toBe(409)
        expect(res.body.error.message).toBe(STIMULUS_MESSAGES.groupServed)
      }
      expect(await groupOf(s.served)).toBe(s.id)
      expect(await members(s.id)).toEqual([s.served, s.draft])
      // the draft member of the same group may still leave
      expect((await admin.put(`/api/questions/${s.draft}`, mcqBody(refs, { stimulusGroupId: null }))).status).toBe(200)
      expect(await members(s.id)).toEqual([s.served])
    })
  })

  describe('served lock on the group and stimulus routes (409)', () => {
    it('a served member cannot be removed, the stimulus cannot be edited, the stimuli cannot be replaced and the group cannot be dissolved', async () => {
      const s = await servedGroup()
      const removed = await admin.delete(`/api/stimulus-groups/${s.id}/members/${s.served}`)
      expect(removed.status).toBe(409)
      expect(removed.body.error.message).toBe(STIMULUS_MESSAGES.groupServed)

      const edited = await admin.put(`/api/stimuli/${s.stimulusId}`, { caption: 'Tukar' })
      expect(edited.status).toBe(409)
      expect(edited.body.error.message).toBe(STIMULUS_MESSAGES.stimulusServed)
      expect((await admin.get(`/api/stimuli/${s.stimulusId}`)).body.data.caption).toBeNull()

      const replaced = await admin.put(`/api/stimulus-groups/${s.id}`, { stimulusIds: [await stimulus()] })
      expect(replaced.status).toBe(409)
      expect(replaced.body.error.message).toBe(STIMULUS_MESSAGES.groupServed)

      const dissolved = await admin.delete(`/api/stimulus-groups/${s.id}`)
      expect(dissolved.status).toBe(409)

      // the label is not shown to pupils' answers: relabelling stays possible
      expect((await admin.put(`/api/stimulus-groups/${s.id}`, { label: 'Nama baharu' })).status).toBe(200)
      expect(await members(s.id)).toEqual([s.served, s.draft])
    })

    it('PUT /members keeps the served members and their order; new drafts are appended or reordered around them', async () => {
      const s = await servedGroup()
      const extra = await question()
      const added = await admin.put(`/api/stimulus-groups/${s.id}/members`, { questionIds: [s.served, s.draft, extra] })
      expect(added.status, JSON.stringify(added.body)).toBe(200)
      expect(added.body.data.questionIds).toEqual([s.served, s.draft, extra])
      expect(added.body.data.warning).toBeNull()
      const around = await admin.put(`/api/stimulus-groups/${s.id}/members`, { questionIds: [s.draft, s.served] })
      expect(around.status, JSON.stringify(around.body)).toBe(200)
      expect(await members(s.id)).toEqual([s.draft, s.served])
      expect(await groupOf(extra)).toBeNull() // the omitted draft left
      const without = await admin.put(`/api/stimulus-groups/${s.id}/members`, { questionIds: [s.draft] })
      expect(without.status).toBe(409)
      expect(await members(s.id)).toEqual([s.draft, s.served])
    })

    it('a served question cannot be put into a group, and a stimulus linked to a served version cannot be edited', async () => {
      const g = await group([await question()])
      const sq = await served()
      const res = await admin.post(`/api/stimulus-groups/${g.id}/members`, { questionId: sq })
      expect(res.status).toBe(409)
      expect(res.body.error.message).toBe(STIMULUS_MESSAGES.memberServed)
      expect(await groupOf(sq)).toBeNull()

      const sid = await stimulus()
      const version = (await t.db.query<{ id: string }>(`select v.id::text id from question_versions v join questions q on q.id = v.question_id and q.live_version_no = v.version_no where q.id = $1`, [sq]))[0]!.id
      await t.db.query(`insert into question_version_stimuli (question_version_id, stimulus_id, position) values ($1, $2, 1)`, [version, sid])
      const edit = await admin.put(`/api/stimuli/${sid}`, { caption: 'Tukar' })
      expect(edit.status).toBe(409)
      expect(edit.body.error.message).toBe(STIMULUS_MESSAGES.stimulusServed)
    })

    it('a stimulus of a draft-only group can be edited, replaced and the group dissolved (nothing is served)', async () => {
      const g = await group([await question(), await question()])
      const sid = g.stimuli[0]!.id
      expect((await admin.put(`/api/stimuli/${sid}`, { caption: 'Baharu' })).status).toBe(200)
      expect((await admin.put(`/api/stimulus-groups/${g.id}`, { stimulusIds: [await stimulus()] })).status).toBe(200)
      expect((await admin.delete(`/api/stimulus-groups/${g.id}`)).status).toBe(200)
    })

    it('editing a stimulus clears a stale migrated content hash', async () => {
      const sid = await stimulus()
      await t.db.query(`update stimuli set content_hash = 'abc' where id = $1`, [sid])
      expect((await admin.put(`/api/stimuli/${sid}`, { caption: 'Baharu' })).status).toBe(200)
      expect((await t.db.query<{ h: string | null }>(`select content_hash h from stimuli where id = $1`, [sid]))[0]!.h).toBeNull()
    })

    it('a guessable decimal file id is not a picture: only the public token of a question_image file is', async () => {
      const up = await admin.post('/api/files?purpose=question_image').attach('file', makePng(), { filename: 'rajah.png', contentType: 'image/png' })
      expect(up.status, JSON.stringify(up.body)).toBe(201)
      const token = (up.body.data as { id: string }).id
      expect((await admin.post('/api/stimuli', { kind: 'image', imageFileId: token })).status).toBe(201)
      const file = (await t.db.query<{ id: string }>(`select id::text id from files where public_id = $1`, [token]))[0]!.id
      const res = await admin.post('/api/stimuli', { kind: 'image', imageFileId: file })
      expect(res.status).toBe(422)
      expect(res.body.error.fields.imageFileId).toBe(STIMULUS_MESSAGES.image)
    })
  })

  describe('concurrency and the 40-member cap', () => {
    it('4 parallel POST /stimulus-groups/:id/questions: all 201, positions distinct and contiguous', async () => {
      const g = await group([await question()])
      const results = await Promise.all(
        Array.from({ length: 4 }, (_, i) => admin.post(`/api/stimulus-groups/${g.id}/questions`, mcqBody(refs, { questionText: `Soalan serentak nombor ${String(i)}?` }))),
      )
      expect(results.map((r) => r.status), JSON.stringify(results.map((r) => r.body))).toEqual([201, 201, 201, 201])
      const rows = await t.db.query<{ p: number }>(`select group_position p from questions where group_id = $1 order by group_position`, [g.id])
      expect(rows.map((r) => r.p)).toEqual([1, 2, 3, 4, 5])
    })

    it('the 41st member is refused on every path (422 membersTooMany); 40 is accepted', async () => {
      const ids: string[] = []
      for (let i = 0; i < 40; i++) ids.push(await question({ questionText: `Soalan had ${String(i)}?` }))
      const g = await group(ids)
      expect(g.questionIds).toHaveLength(40)
      expect(g.warning).toBeNull()
      const extra = await question()
      const byMember = await admin.post(`/api/stimulus-groups/${g.id}/members`, { questionId: extra })
      expect(byMember.status).toBe(422)
      expect(byMember.body.error.fields.questionId).toBe(STIMULUS_MESSAGES.membersTooMany)
      const byCreate = await admin.post(`/api/stimulus-groups/${g.id}/questions`, mcqBody(refs))
      expect(byCreate.status).toBe(422)
      expect(byCreate.body.error.fields.stimulusGroupId).toBe(STIMULUS_MESSAGES.membersTooMany)
      const byPut = await admin.put(`/api/questions/${extra}`, mcqBody(refs, { stimulusGroupId: g.id }))
      expect(byPut.status).toBe(422)
      expect(byPut.body.error.fields.stimulusGroupId).toBe(STIMULUS_MESSAGES.membersTooMany)
      const bySet = await admin.put(`/api/stimulus-groups/${g.id}/members`, { questionIds: [...ids, extra] })
      expect(bySet.status).toBe(422)
      expect(bySet.body.error.fields.questionIds).toBe(STIMULUS_MESSAGES.membersTooMany)
      const tooMany = await admin.post('/api/stimulus-groups', { stimulusIds: [await stimulus()], questionIds: [...ids, extra] })
      expect(tooMany.status).toBe(422)
      expect(tooMany.body.error.fields.questionIds).toBe(STIMULUS_MESSAGES.membersTooMany)
      expect(await members(g.id)).toEqual(ids)
    })
  })

  describe('member checks', () => {
    it('one subject per group; an archived or deactivated question is refused', async () => {
      const g = await group([await question(), await question()])
      const sci = await question({ subjectId: refs.sciId })
      const mixed = await admin.post(`/api/stimulus-groups/${g.id}/members`, { questionId: sci })
      expect(mixed.status).toBe(422)
      expect(mixed.body.error.fields.questionId).toBe(STIMULUS_MESSAGES.memberMixed)

      const archived = await question()
      expect((await admin.post('/api/questions/bulk-action', { action: 'archived', ids: [archived] })).status).toBe(200)
      const a = await admin.post(`/api/stimulus-groups/${g.id}/members`, { questionId: archived })
      expect(a.status).toBe(422)
      expect(a.body.error.fields.questionId).toBe(STIMULUS_MESSAGES.memberInactive)

      const inactive = await question()
      await t.db.query(`update questions set is_active = false where id = $1`, [inactive])
      const i = await admin.post(`/api/stimulus-groups/${g.id}/members`, { questionId: inactive })
      expect(i.status).toBe(422)
      expect(i.body.error.fields.questionId).toBe(STIMULUS_MESSAGES.memberInactive)

      // a group is made of one subject from the start
      const both = await admin.post('/api/stimulus-groups', { stimulusIds: [await stimulus()], questionIds: [await question(), await question({ subjectId: refs.sciId })] })
      expect(both.status).toBe(422)
      expect(both.body.error.fields.questionIds).toBe(STIMULUS_MESSAGES.memberMixed)
      expect(await members(g.id)).toHaveLength(2)
    })
  })

  describe('draft groups (D93)', () => {
    it('a group with 0 or 1 members is created, answers with a BM warning, and loses it at 2', async () => {
      const empty = await admin.post('/api/stimulus-groups', { stimulusIds: [await stimulus()] })
      expect(empty.status, JSON.stringify(empty.body)).toBe(201)
      expect(empty.body.data.questionIds).toEqual([])
      expect(empty.body.data.warning).toBe(STIMULUS_MESSAGES.smallGroup(0))
      const id = empty.body.data.id as string
      expect((await admin.get(`/api/stimulus-groups/${id}`)).body.data.warning).toBe(STIMULUS_MESSAGES.smallGroup(0))

      const one = await admin.post(`/api/stimulus-groups/${id}/members`, { questionId: await question() })
      expect(one.status).toBe(200)
      expect(one.body.data.warning).toBe(STIMULUS_MESSAGES.smallGroup(1))
      const two = await admin.post(`/api/stimulus-groups/${id}/members`, { questionId: await question() })
      expect(two.body.data.warning).toBeNull()

      const single = await admin.post('/api/stimulus-groups', { stimulusIds: [await stimulus()], questionIds: [await question()] })
      expect(single.status).toBe(201)
      expect(single.body.data.warning).toBe(STIMULUS_MESSAGES.smallGroup(1))
    })

    it('removing below 2 succeeds with a warning and never a 422', async () => {
      const [q1, q2] = [await question(), await question()] as [string, string]
      const g = await group([q1, q2])
      const res = await admin.delete(`/api/stimulus-groups/${g.id}/members/${q1}`)
      expect(res.status).toBe(200)
      expect(res.body.data.warning).toBe(STIMULUS_MESSAGES.smallGroup(1))
    })
  })
})
