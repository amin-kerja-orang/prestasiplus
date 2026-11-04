import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { QUESTION_MESSAGES, QuestionSchema, STIMULUS_MESSAGES, StimulusGroupDetailSchema, StimulusSchema, mutationEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, tagOf, type Refs } from './http-helpers'

/**
 * S1-T01 part 3: the stimulus-group actions and the group scope (FR-QA-02..07, 50, 51; AC-QA-02..06, 50, 51; DM-51, DM-52).
 * API-Q-04 (`groupId`, split lists), API-Q-08 (scope), API-Q-31 publish, API-Q-32 draft copy, API-Q-33 retire, API-Q-34 move,
 * API-Q-35 merge. Real database, real session guard, one transaction per action.
 */
describe('stimulus group actions (admin, real database)', () => {
  let t: QuestionsTestApp
  let admin: Client
  let refs: Refs
  let tag: Awaited<ReturnType<typeof tagOf>>

  beforeAll(async () => {
    process.env.FILE_STORAGE_DIR = await mkdtemp(join(tmpdir(), 'pp-group-actions-'))
    process.env.THROTTLE_QUESTIONS_WRITE_PER_MINUTE = '100000'
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
    tag = await tagOf(t.db, refs.mathId, refs.t4Id)
  })
  afterAll(async () => {
    await t.close()
  })

  const stimulus = async (label = 'Petikan'): Promise<string> => {
    const res = await admin.post('/api/stimuli', { kind: 'passage', label, body: { ms: 'Teks petikan.' } })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return mutationEnvelopeOf(StimulusSchema).parse(res.body).data.id
  }
  const question = async (over: Record<string, unknown> = {}): Promise<string> => {
    const res = await admin.post('/api/questions', mcqBody(refs, over))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return mutationEnvelopeOf(QuestionSchema).parse(res.body).data.id
  }
  const draft = (over: Record<string, unknown> = {}) => question(over)
  const review = (over: Record<string, unknown> = {}) => question({ status: 'review', tag, ...over })
  const group = async (questionIds: string[], extra: Record<string, unknown> = {}) => {
    const res = await admin.post('/api/stimulus-groups', { stimulusIds: [await stimulus()], questionIds, ...extra })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return mutationEnvelopeOf(StimulusGroupDetailSchema).parse(res.body).data
  }
  /** A group whose first member is served, plus a second served member. */
  const servedGroup = async (n = 2) => {
    const g = await group([])
    const ids: string[] = []
    for (let i = 0; i < n; i += 1) {
      const res = await admin.post(`/api/stimulus-groups/${g.id}/questions`, mcqBody(refs, { status: 'approved', tag }))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      ids.push(mutationEnvelopeOf(QuestionSchema).parse(res.body).data.id)
    }
    return { id: g.id, ids, stimulusId: g.stimuli[0]!.id }
  }
  /** A group built the way the Studio does it: empty first, then served questions created inside it, then Draf / Semakan members attached. */
  const mixedGroup = async (kinds: ('served' | 'review' | 'draft')[]) => {
    const g = await group([])
    const ids: string[] = []
    for (const kind of kinds) {
      if (kind === 'served') {
        const res = await admin.post(`/api/stimulus-groups/${g.id}/questions`, mcqBody(refs, { status: 'approved', tag }))
        expect(res.status, JSON.stringify(res.body)).toBe(201)
        ids.push(mutationEnvelopeOf(QuestionSchema).parse(res.body).data.id)
      } else {
        const q = kind === 'review' ? await review() : await draft()
        expect((await admin.post(`/api/stimulus-groups/${g.id}/members`, { questionId: q })).status).toBe(200)
        ids.push(q)
      }
    }
    return { id: g.id, ids }
  }
  const statusOf = async (id: string): Promise<string> =>
    (await t.db.query<{ status: string }>(`select status from question_versions where question_id = $1 order by version_no desc limit 1`, [id]))[0]!.status
  const statuses = async (ids: string[]): Promise<string[]> => Promise.all(ids.map(statusOf))
  const members = async (groupId: string): Promise<string[]> =>
    (await t.db.query<{ id: string }>(`select id::text id from questions where group_id = $1 order by group_position`, [groupId])).map((r) => r.id)
  const groupExists = async (id: string): Promise<boolean> => (await t.db.query(`select 1 from stimulus_groups where id = $1`, [id])).length > 0
  const auditRows = (action: string) => t.db.query<{ target_id: string; detail: Record<string, unknown> | null }>(`select target_id, detail from audit_events where action = $1 order by id`, [action])
  const bulk = (body: Record<string, unknown>) => admin.post('/api/questions/bulk-action', body)

  // ---------------------------------------------------------------------------------------------------------- FR-QA-51

  describe('AC-QA-51 group scope (DM-51)', () => {
    it('create stores the Subjek, Tingkatan and Kertas of an EMPTY group and returns them', async () => {
      const g = await group([], { subjectId: refs.sciId, educationLevelId: refs.t4Id, kertas: '2' })
      expect(g).toMatchObject({ subjectId: refs.sciId, educationLevelId: refs.t4Id, kertas: '2', draftOfGroupId: null })
      const row = (await t.db.query<{ subject_id: string; education_level_id: string; kertas: number }>(`select subject_id::text, education_level_id::text, kertas from stimulus_groups where id = $1`, [g.id]))[0]
      expect(row).toEqual({ subject_id: refs.sciId, education_level_id: refs.t4Id, kertas: 2 })
    })

    it('attaching a question of another Subjek to the empty Sains T4 group answers 422 memberScope; the same Subjek and Tingkatan is accepted', async () => {
      const g = await group([], { subjectId: refs.sciId, educationLevelId: refs.t4Id })
      const math = await draft()
      const res = await admin.post(`/api/stimulus-groups/${g.id}/members`, { questionId: math })
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(res.body.error.fields.questionId).toBe(STIMULUS_MESSAGES.memberScope)
      const set = await admin.put(`/api/stimulus-groups/${g.id}/members`, { questionIds: [math] })
      expect(set.status).toBe(422)
      expect(set.body.error.fields.questionIds).toBe(STIMULUS_MESSAGES.memberScope)
      expect(await members(g.id)).toEqual([])
      const sci = await draft({ subjectId: refs.sciId })
      expect((await admin.post(`/api/stimulus-groups/${g.id}/members`, { questionId: sci })).status).toBe(200)
    })

    it('a member of another Tingkatan is refused by a group that has a level (memberScope), also on create', async () => {
      const g = await group([await draft()]) // scope derived: Matematik T4
      expect(g).toMatchObject({ subjectId: refs.mathId, educationLevelId: refs.t4Id })
      const t5 = await draft({ educationLevelId: refs.t5Id })
      const res = await admin.post(`/api/stimulus-groups/${g.id}/members`, { questionId: t5 })
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(res.body.error.fields.questionId).toBe(STIMULUS_MESSAGES.memberScope)
      const created = await admin.post('/api/stimulus-groups', { stimulusIds: [await stimulus()], questionIds: [t5], educationLevelId: refs.t4Id })
      expect(created.status).toBe(422)
      expect(created.body.error.fields.questionIds).toBe(STIMULUS_MESSAGES.memberScope)
    })

    it('create without a scope takes the common one from the members; mixed T4/T5 members give a NULL level; no member gives NULL', async () => {
      const common = await group([await draft(), await draft()])
      expect(common).toMatchObject({ subjectId: refs.mathId, educationLevelId: refs.t4Id, kertas: null })
      const mixed = await group([await draft(), await draft({ educationLevelId: refs.t5Id })])
      expect(mixed).toMatchObject({ subjectId: refs.mathId, educationLevelId: null })
      const empty = await group([])
      expect(empty).toMatchObject({ subjectId: null, educationLevelId: null, kertas: null })
      const twoKertas = await group([await draft({ kertas: '2' }), await draft({ kertas: '2' })])
      expect(twoKertas.kertas).toBe('2')
    })

    it('a NULL level skips the level check (the subject check stays): a T5 question joins the mixed group, another subject does not', async () => {
      const mixed = await group([await draft(), await draft({ educationLevelId: refs.t5Id })])
      const t5 = await draft({ educationLevelId: refs.t5Id })
      expect((await admin.post(`/api/stimulus-groups/${mixed.id}/members`, { questionId: t5 })).status).toBe(200)
      const sci = await draft({ subjectId: refs.sciId })
      const res = await admin.post(`/api/stimulus-groups/${mixed.id}/members`, { questionId: sci })
      expect(res.status).toBe(422)
      expect(res.body.error.fields.questionId).toBe(STIMULUS_MESSAGES.memberScope)
      // a group with no subject at all keeps the member-against-member rule
      const open = await group([])
      expect((await admin.post(`/api/stimulus-groups/${open.id}/members`, { questionId: await draft() })).status).toBe(200)
      const other = await admin.post(`/api/stimulus-groups/${open.id}/members`, { questionId: await draft({ subjectId: refs.sciId }) })
      expect(other.status).toBe(422)
      expect(other.body.error.fields.questionId).toBe(STIMULUS_MESSAGES.memberMixed)
    })

    it('a member save (PUT /questions) that leaves the group Tingkatan is 422 memberScope; in a NULL-level group it is allowed; POST with a group of another level is refused', async () => {
      const g = await group([await draft(), await draft()])
      const [a] = await members(g.id)
      const res = await admin.put(`/api/questions/${a}`, mcqBody(refs, { educationLevelId: refs.t5Id }))
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(res.body.error.fields.subjectId).toBe(STIMULUS_MESSAGES.memberScope)
      const post = await admin.post('/api/questions', mcqBody(refs, { educationLevelId: refs.t5Id, stimulusGroupId: g.id }))
      expect(post.status).toBe(422)
      expect(post.body.error.fields.stimulusGroupId).toBe(STIMULUS_MESSAGES.memberScope)

      const mixed = await group([await draft(), await draft({ educationLevelId: refs.t5Id })])
      const [m1] = await members(mixed.id)
      const ok = await admin.put(`/api/questions/${m1}`, mcqBody(refs, { educationLevelId: refs.t5Id }))
      expect(ok.status, JSON.stringify(ok.body)).toBe(200)
    })

    it('PUT may change the scope while the group has no member or every member matches; otherwise 422 memberScope', async () => {
      const empty = await group([])
      const moved = await admin.put(`/api/stimulus-groups/${empty.id}`, { subjectId: refs.sciId, educationLevelId: refs.t5Id, kertas: '3' })
      expect(moved.status, JSON.stringify(moved.body)).toBe(200)
      expect(moved.body.data).toMatchObject({ subjectId: refs.sciId, educationLevelId: refs.t5Id, kertas: '3' })

      const g = await group([await draft(), await draft()])
      const bad = await admin.put(`/api/stimulus-groups/${g.id}`, { subjectId: refs.sciId })
      expect(bad.status).toBe(422)
      expect(bad.body.error.fields.subjectId).toBe(STIMULUS_MESSAGES.memberScope)
      const badLevel = await admin.put(`/api/stimulus-groups/${g.id}`, { educationLevelId: refs.t5Id })
      expect(badLevel.status).toBe(422)
      expect(badLevel.body.error.fields.educationLevelId).toBe(STIMULUS_MESSAGES.memberScope)
      const same = await admin.put(`/api/stimulus-groups/${g.id}`, { subjectId: refs.mathId, educationLevelId: refs.t4Id })
      expect(same.status).toBe(200)
      const clear = await admin.put(`/api/stimulus-groups/${g.id}`, { educationLevelId: undefined, kertas: null })
      expect(clear.status).toBe(200)
      const stored = (await t.db.query<{ subject_id: string }>(`select subject_id::text from stimulus_groups where id = $1`, [g.id]))[0]!
      expect(stored.subject_id).toBe(refs.mathId)
    })

    it('an unknown Subjek or Tingkatan on create or update is 422 on that field', async () => {
      const res = await admin.post('/api/stimulus-groups', { stimulusIds: [await stimulus()], subjectId: '987654321', educationLevelId: '987654322' })
      expect(res.status).toBe(422)
      expect(res.body.error.fields).toEqual({ subjectId: QUESTION_MESSAGES.subject, educationLevelId: QUESTION_MESSAGES.level })
      const g = await group([])
      const upd = await admin.put(`/api/stimulus-groups/${g.id}`, { subjectId: '987654321' })
      expect(upd.status).toBe(422)
      expect(upd.body.error.fields.subjectId).toBe(QUESTION_MESSAGES.subject)
    })
  })

  // ---------------------------------------------------------------------------------------------------------- API-Q-04

  describe('AC-QA-50 / AC-QA-03 bulk status with groupId, and group-aware id lists (API-Q-04)', () => {
    it('{action: review, groupId}: every Draf member goes to Menunggu Semakan together; review and approved members are left as they are', async () => {
      const ids = [await draft(), await draft({ tag }), await draft()]
      const g = await group(ids)
      const res = await bulk({ action: 'review', groupId: g.id })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data).toEqual({ affected: 3, failed: [] })
      expect(await statuses(ids)).toEqual(['review', 'review', 'review'])
      // again: nothing is draft any more, nothing changes
      const again = await bulk({ action: 'review', groupId: g.id })
      expect(again.body.data.affected).toBe(0)
      expect((await auditRows('question.bulk_action')).some((r) => r.detail?.groupId === g.id && r.detail?.affected === 3)).toBe(true)
    })

    it('a group with an approved member and Draf members: only the Draf ones move', async () => {
      const g = await mixedGroup(['served', 'draft'])
      const [a, b] = g.ids
      const res = await bulk({ action: 'review', groupId: g.id })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data.affected).toBe(1)
      expect(await statuses([a!, b!])).toEqual(['approved', 'review'])
    })

    it('{action: draft, groupId}: every Menunggu Semakan member goes back to Draf in one call', async () => {
      const ids = [await review(), await review()]
      const g = await group(ids)
      const res = await bulk({ action: 'draft', groupId: g.id })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data.affected).toBe(2)
      expect(await statuses(ids)).toEqual(['draft', 'draft'])
    })

    it('an archived member makes the call 409 and nothing changes', async () => {
      const ids = [await draft(), await draft()]
      const g = await group(ids)
      expect((await bulk({ action: 'archived', ids: [ids[1]!] })).status).toBe(422) // part of a group (see below) ...
      await t.db.query(`update question_versions set status = 'archived' where question_id = $1`, [ids[1]])
      const res = await bulk({ action: 'review', groupId: g.id })
      expect(res.status, JSON.stringify(res.body)).toBe(409)
      expect(res.body.error.message).toBe(QUESTION_MESSAGES.groupArchivedMember)
      expect(await statuses(ids)).toEqual(['draft', 'archived'])
    })

    it('a group with 0 members answers 422 builderBlocker; an unknown group is 422 on groupId', async () => {
      const g = await group([])
      for (const action of ['review', 'draft']) {
        const res = await bulk({ action, groupId: g.id })
        expect(res.status).toBe(422)
        expect(res.body.error.fields.groupId).toBe(STIMULUS_MESSAGES.builderBlocker)
      }
      const unknown = await bulk({ action: 'review', groupId: '987654321' })
      expect(unknown.status).toBe(422)
      expect(unknown.body.error.fields.groupId).toBe(STIMULUS_MESSAGES.groupInvalid)
    })

    it('ids and groupId in one body is 422 on groupId; only draft or review is allowed with groupId', async () => {
      const g = await group([await draft()])
      const both = await bulk({ action: 'review', groupId: g.id, ids: ['1'] })
      expect(both.status).toBe(422)
      expect(both.body.error.fields.groupId).toBe(QUESTION_MESSAGES.bothIdsAndGroup)
      const approved = await bulk({ action: 'approved', groupId: g.id })
      expect(approved.status).toBe(422)
    })

    it('a member that fails the submit gate: 422 with a "Soalan {no}: ..." line per member and nothing changes', async () => {
      const ids = [await draft(), await draft(), await draft()]
      const g = await group(ids)
      await t.db.query(`update question_versions set subject_id = null where question_id = $1`, [ids[1]])
      const res = await bulk({ action: 'review', groupId: g.id })
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      const gate = res.body.error.details.gate as { questionId: string; message: string }[]
      expect(gate.map((x) => x.questionId)).toEqual([ids[1]])
      expect(gate[0]!.message.startsWith('Soalan 2: ')).toBe(true)
      expect(await statuses(ids)).toEqual(['draft', 'draft', 'draft'])
    })

    it('AC-QA-03: an ids list with some but not all members is 422 stimulus_group_split on the group; nothing changes', async () => {
      const ids = [await draft(), await draft(), await draft(), await draft()]
      const g = await group(ids)
      const loose = await draft()
      for (const action of ['review', 'approved', 'archived', 'draft']) {
        const res = await bulk({ action, ids: [ids[0]!, ids[1]!, loose] })
        expect(res.status, `${action} ${JSON.stringify(res.body)}`).toBe(422)
        expect(res.body.error.code).toBe('VALIDATION_ERROR')
        expect(res.body.error.message).toBe(QUESTION_MESSAGES.groupSplit)
        expect(res.body.error.details).toEqual({ reason: 'stimulus_group_split', group: g.id })
      }
      expect(await statuses([...ids, loose])).toEqual(['draft', 'draft', 'draft', 'draft', 'draft'])
    })

    it('AC-QA-03: an ids list with every member moves the group as one unit; ungrouped ids in the same list keep the per-id behaviour', async () => {
      const ids = [await draft(), await draft(), await draft()]
      const g = await group(ids)
      const loose = await draft()
      const res = await bulk({ action: 'review', ids: [...ids, loose] })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data).toMatchObject({ affected: 4, failed: [] })
      expect(await statuses([...ids, loose])).toEqual(['review', 'review', 'review', 'review'])
      expect(await members(g.id)).toEqual(ids)
    })

    it('a whole group whose member fails the gate in an ids list: 422 gate lines and nothing changes, not even the ungrouped ids', async () => {
      const ids = [await draft(), await draft()]
      await group(ids)
      const loose = await draft()
      await t.db.query(`update question_versions set subject_id = null where question_id = $1`, [ids[0]])
      const res = await bulk({ action: 'review', ids: [...ids, loose] })
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect((res.body.error.details.gate as unknown[]).length).toBe(1)
      expect(await statuses([...ids, loose])).toEqual(['draft', 'draft', 'draft'])
    })

    it('ungrouped ids keep the old per-id result shape (existing behaviour)', async () => {
      const [a, b] = [await draft(), await draft()] as [string, string]
      const res = await bulk({ action: 'review', ids: [a, b, '987654321'] })
      expect(res.status).toBe(200)
      expect(res.body.data.affected).toBe(2)
    })
  })

  // ---------------------------------------------------------------------------------------------------------- API-Q-31

  describe('AC-QA-02 / AC-QA-50 publish the group (API-Q-31)', () => {
    it('3 Draf members: 409 publishNotReady and nothing changes; after Hantar kumpulan all 3 are Menunggu Semakan; after Terbitkan kumpulan all 3 are Diluluskan together', async () => {
      const ids = [await draft({ tag }), await draft({ tag }), await draft({ tag })]
      const g = await group(ids)
      const early = await admin.post(`/api/stimulus-groups/${g.id}/publish`)
      expect(early.status, JSON.stringify(early.body)).toBe(409)
      expect(early.body.error.message).toBe(STIMULUS_MESSAGES.publishNotReady)
      expect(await statuses(ids)).toEqual(['draft', 'draft', 'draft'])

      expect((await bulk({ action: 'review', groupId: g.id })).status).toBe(200)
      expect(await statuses(ids)).toEqual(['review', 'review', 'review'])

      const res = await admin.post(`/api/stimulus-groups/${g.id}/publish`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const detail = mutationEnvelopeOf(StimulusGroupDetailSchema).parse(res.body).data
      expect(detail.id).toBe(g.id)
      expect(detail.members.map((m) => m.status)).toEqual(['approved', 'approved', 'approved'])
      expect(detail.members.every((m) => m.servable)).toBe(true)
      expect(await statuses(ids)).toEqual(['approved', 'approved', 'approved'])
      // one status event per member (draft -> review, review -> approved), and one audit row for the publish
      const events = await t.db.query(`select 1 from question_status_events where question_id = any($1::bigint[]) and to_status = 'approved'`, [ids])
      expect(events).toHaveLength(3)
      const audit = await auditRows('stimulus.group.published')
      expect(audit.at(-1)).toMatchObject({ target_id: g.id, detail: { approved: 3 } })
    })

    it('members already Diluluskan are left as they are; a group of Diluluskan members publishes as a no-op', async () => {
      const g = await mixedGroup(['served', 'review'])
      const res = await admin.post(`/api/stimulus-groups/${g.id}/publish`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(await statuses(await members(g.id))).toEqual(['approved', 'approved'])
      expect((await admin.post(`/api/stimulus-groups/${g.id}/publish`)).status).toBe(200)
    })

    it('one Draf member among Menunggu Semakan members is 409; nothing changes', async () => {
      const ids = [await review(), await draft({ tag })]
      const g = await group(ids)
      const res = await admin.post(`/api/stimulus-groups/${g.id}/publish`)
      expect(res.status).toBe(409)
      expect(res.body.error.message).toBe(STIMULUS_MESSAGES.publishNotReady)
      expect(await statuses(ids)).toEqual(['review', 'draft'])
    })

    it('0 members is 409 builderBlocker', async () => {
      const g = await group([])
      const res = await admin.post(`/api/stimulus-groups/${g.id}/publish`)
      expect(res.status).toBe(409)
      expect(res.body.error.message).toBe(STIMULUS_MESSAGES.builderBlocker)
    })

    it('AC-QA-02: member 3 fails the approve gate: 422 lists "Soalan 3: ..." and no member changes status', async () => {
      const ids = [await review(), await review(), await review()]
      const g = await group(ids)
      await t.db.query(`update question_versions set difficulty_tp = null where question_id = $1`, [ids[2]])
      const res = await admin.post(`/api/stimulus-groups/${g.id}/publish`)
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
      const gate = res.body.error.details.gate as { questionId: string; message: string }[]
      expect(gate).toHaveLength(1)
      expect(gate[0]!.questionId).toBe(ids[2])
      expect(gate[0]!.message.startsWith('Soalan 3: ')).toBe(true)
      expect(await statuses(ids)).toEqual(['review', 'review', 'review'])
      expect(await t.db.query(`select 1 from question_status_events where question_id = any($1::bigint[]) and to_status = 'approved'`, [ids])).toHaveLength(0)
    })

    it('an unknown group is 404; publish is admin-only (a teacher is refused)', async () => {
      expect((await admin.post('/api/stimulus-groups/987654321/publish')).status).toBe(404)
      const teacher = await loginAs(t, 'teacher')
      expect((await teacher.post('/api/stimulus-groups/1/publish')).status).toBe(403)
    })
  })

  // ---------------------------------------------------------------------------------------------------------- API-Q-32

  describe('AC-QA-04 the draft copy of a group (API-Q-32, DM-51)', () => {
    it('creates the copy: draftOfGroupId, copied stimuli (new rows), staged member ids, flash text and audit; the live group is unchanged', async () => {
      const s = await servedGroup(2)
      const res = await admin.post(`/api/stimulus-groups/${s.id}/edit-as-draft`)
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const body = mutationEnvelopeOf(StimulusGroupDetailSchema).parse(res.body)
      const copy = body.data
      expect(body.status).toBe(STIMULUS_MESSAGES.groupDraftCreated(copy.id))
      expect(copy.id).not.toBe(s.id)
      expect(copy.draftOfGroupId).toBe(s.id)
      expect(copy.questionIds).toEqual(s.ids)
      expect(copy.stimuli).toHaveLength(1)
      expect(copy.stimuli[0]!.id).not.toBe(s.stimulusId)
      expect(copy.stimuli[0]!.label).toBe('Petikan')
      const row = (await t.db.query<{ draft_members: string[]; draft_created_by: string | null; draft_created_at: string | null }>(`select draft_members, draft_created_by::text, draft_created_at::text from stimulus_groups where id = $1`, [copy.id]))[0]!
      expect(row.draft_members.map(String)).toEqual(s.ids)
      expect(row.draft_created_by).not.toBeNull()
      expect(row.draft_created_at).not.toBeNull()
      // the live group keeps serving, members and stimuli untouched
      expect(await members(s.id)).toEqual(s.ids)
      expect(await statuses(s.ids)).toEqual(['approved', 'approved'])
      const live = await admin.get(`/api/stimulus-groups/${s.id}`)
      expect(live.body.data.stimuli[0].id).toBe(s.stimulusId)
      expect(live.body.data.draftOfGroupId).toBeNull()
      expect((await auditRows('stimulus.group.draft_copied')).at(-1)).toMatchObject({ target_id: s.id, detail: { draftGroupId: copy.id } })
      // the copy is not in the group list and takes no members in place
      const list = await admin.get('/api/stimulus-groups?pageSize=100')
      expect((list.body.data as { id: string }[]).some((g) => g.id === copy.id)).toBe(false)
      const add = await admin.post(`/api/stimulus-groups/${copy.id}/members`, { questionId: await draft() })
      expect(add.status).toBe(409)
      expect((await admin.post(`/api/stimulus-groups/${copy.id}/publish`)).status).toBe(409)
      expect((await admin.post(`/api/stimulus-groups/${copy.id}/edit-as-draft`)).status).toBe(409)
    })

    it('a second request while a draft exists is 409 with details.id = the draft group id', async () => {
      const s = await servedGroup(1)
      const first = await admin.post(`/api/stimulus-groups/${s.id}/edit-as-draft`)
      const second = await admin.post(`/api/stimulus-groups/${s.id}/edit-as-draft`)
      expect(second.status, JSON.stringify(second.body)).toBe(409)
      expect(second.body.error.code).toBe('CONFLICT')
      expect(second.body.error.message).toBe(STIMULUS_MESSAGES.draftExists)
      expect(second.body.error.details).toEqual({ id: first.body.data.id })
      expect(await t.db.query(`select 1 from stimulus_groups where draft_of_group_id = $1`, [s.id])).toHaveLength(1)
    })

    it('DELETE /:id/draft is 204, discards the copy (and its stimulus copies) only; a third call is 409 noDraft; a new copy can be made after', async () => {
      const s = await servedGroup(2)
      const copy = (await admin.post(`/api/stimulus-groups/${s.id}/edit-as-draft`)).body.data as { id: string; stimuli: { id: string }[] }
      const del = await admin.delete(`/api/stimulus-groups/${s.id}/draft`)
      expect(del.status, JSON.stringify(del.body)).toBe(204)
      expect(await groupExists(copy.id)).toBe(false)
      expect(await t.db.query(`select 1 from stimuli where id = $1`, [copy.stimuli[0]!.id])).toHaveLength(0)
      // the live group, its members, their statuses and its stimulus are untouched
      expect(await groupExists(s.id)).toBe(true)
      expect(await members(s.id)).toEqual(s.ids)
      expect(await statuses(s.ids)).toEqual(['approved', 'approved'])
      expect(await t.db.query(`select 1 from stimuli where id = $1`, [s.stimulusId])).toHaveLength(1)
      expect((await t.db.query<{ n: string }>(`select count(*)::text n from question_versions where question_id = any($1::bigint[])`, [s.ids]))[0]!.n).toBe('2')
      const none = await admin.delete(`/api/stimulus-groups/${s.id}/draft`)
      expect(none.status).toBe(409)
      expect(none.body.error.message).toBe(STIMULUS_MESSAGES.noDraft)
      expect((await admin.post(`/api/stimulus-groups/${s.id}/edit-as-draft`)).status).toBe(201)
    })

    it('a group with no draft: DELETE /draft is 409; an unknown group is 404', async () => {
      const g = await group([await draft()])
      expect((await admin.delete(`/api/stimulus-groups/${g.id}/draft`)).status).toBe(409)
      expect((await admin.delete('/api/stimulus-groups/987654321/draft')).status).toBe(404)
      expect((await admin.post('/api/stimulus-groups/987654321/edit-as-draft')).status).toBe(404)
    })

    it('the copy keeps the option bank and the scope of the live group', async () => {
      const g = await group([await draft()], { optionBank: [{ label: 'A', body: { ms: 'Pilihan A' } }, { label: 'B', body: { ms: 'Pilihan B' } }] })
      const copy = (await admin.post(`/api/stimulus-groups/${g.id}/edit-as-draft`)).body.data
      expect(copy.optionBank).toEqual(g.optionBank)
      expect(copy).toMatchObject({ subjectId: g.subjectId, educationLevelId: g.educationLevelId })
    })
  })

  // ---------------------------------------------------------------------------------------------------------- API-Q-33

  describe('AC-QA-05 retire the group (API-Q-33)', () => {
    const paper = async (title: string, status: string, questionIds: string[]): Promise<string> => {
      const p = (
        await t.db.query<{ id: string }>(
          `insert into papers (kind, title, subject_id, kertas, printed_duration_min, status, is_test) values ('pilihan', $1, $2, 2, 60, $3, false) returning id::text`,
          [title, refs.mathId, status],
        )
      )[0]!.id
      const section = (await t.db.query<{ id: string }>(`insert into paper_sections (paper_id, position, label, question_count, mark_budget) values ($1, 1, 'A', $2, 10) returning id::text`, [p, questionIds.length]))[0]!.id
      for (const [i, q] of questionIds.entries()) {
        await t.db.query(`insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, $2, 1, $3)`, [section, q, i + 1])
      }
      return p
    }

    it('archives every member in one transaction, keeps the stimulus, names the Terbit papers (not draft ones) and writes an audit row', async () => {
      const s = await servedGroup(2)
      const live = await paper('Kertas Terbit', 'published', [s.ids[0]!, s.ids[1]!])
      await paper('Kertas Draf', 'draft', [s.ids[0]!])
      const res = await admin.post(`/api/stimulus-groups/${s.id}/retire`, { confirm: true })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data).toEqual({ archived: 2, affectedPapers: [{ id: live, title: 'Kertas Terbit' }] })
      expect(await statuses(s.ids)).toEqual(['archived', 'archived'])
      expect(await groupExists(s.id)).toBe(true)
      expect(await t.db.query(`select 1 from stimuli where id = $1`, [s.stimulusId])).toHaveLength(1)
      expect(await t.db.query(`select 1 from stimulus_group_stimuli where group_id = $1 and stimulus_id = $2`, [s.id, s.stimulusId])).toHaveLength(1)
      const live2 = await t.db.query<{ live_version_no: number | null }>(`select live_version_no from questions where id = any($1::bigint[])`, [s.ids])
      expect(live2.every((r) => r.live_version_no === null)).toBe(true)
      expect((await auditRows('stimulus.group.retired')).at(-1)).toMatchObject({ target_id: s.id, detail: { archived: 2, papers: [live] } })
    })

    it('members already archived are not counted; Draf and Menunggu Semakan members are archived too; no paper gives an empty list', async () => {
      const g = await mixedGroup(['draft', 'review', 'served'])
      const ids = g.ids
      await t.db.query(`update question_versions set status = 'archived' where question_id = $1`, [ids[0]])
      const res = await admin.post(`/api/stimulus-groups/${g.id}/retire`, { confirm: true })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data).toEqual({ archived: 2, affectedPapers: [] })
      expect(await statuses(ids)).toEqual(['archived', 'archived', 'archived'])
    })

    it('without confirm: true the body is 422 and nothing is archived', async () => {
      const s = await servedGroup(1)
      for (const body of [undefined, {}, { confirm: false }, { confirm: 'yes' }, { confirm: true, extra: 1 }]) {
        const res = await admin.post(`/api/stimulus-groups/${s.id}/retire`, body)
        expect(res.status, JSON.stringify(body)).toBe(422)
      }
      expect(await statuses(s.ids)).toEqual(['approved'])
      expect((await admin.post('/api/stimulus-groups/987654321/retire', { confirm: true })).status).toBe(404)
    })
  })

  // ---------------------------------------------------------------------------------------------------------- API-Q-34

  describe('AC-QA-06 move a member to another group (API-Q-34)', () => {
    it('a draft member leaves group A and joins the end of group B in one call; A closes up; both details come back; audit row', async () => {
      const [a1, a2, a3, b1] = [await draft(), await draft(), await draft(), await draft()] as [string, string, string, string]
      const a = await group([a1, a2, a3])
      const b = await group([b1])
      const res = await admin.post(`/api/stimulus-groups/${a.id}/members/${a2}/move`, { toGroupId: b.id })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data.from.questionIds).toEqual([a1, a3])
      expect(res.body.data.to.questionIds).toEqual([b1, a2])
      expect(await members(a.id)).toEqual([a1, a3])
      expect(await members(b.id)).toEqual([b1, a2])
      expect((await t.db.query<{ p: number }>(`select group_position p from questions where id = $1`, [a3]))[0]!.p).toBe(2)
      expect((await auditRows('stimulus.group.member_moved')).at(-1)).toMatchObject({ target_id: a.id, detail: { questionId: a2, from: a.id, to: b.id } })
    })

    it('the last member may move: the source group is left empty with the warning', async () => {
      const [a1, b1] = [await draft(), await draft()] as [string, string]
      const a = await group([a1])
      const b = await group([b1])
      const res = await admin.post(`/api/stimulus-groups/${a.id}/members/${a1}/move`, { toGroupId: b.id })
      expect(res.status).toBe(200)
      expect(res.body.data.from.questionIds).toEqual([])
      expect(res.body.data.from.warning).toBe(STIMULUS_MESSAGES.smallGroup())
    })

    it('a target of another Subjek is 422 memberMixed on toGroupId and nothing moves', async () => {
      const [a1, b1] = [await draft(), await draft({ subjectId: refs.sciId })] as [string, string]
      const a = await group([a1, await draft()])
      const b = await group([b1])
      const res = await admin.post(`/api/stimulus-groups/${a.id}/members/${a1}/move`, { toGroupId: b.id })
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(res.body.error.fields.toGroupId).toBe(STIMULUS_MESSAGES.memberMixed)
      expect(await members(a.id)).toHaveLength(2)
      expect(await members(b.id)).toEqual([b1])
    })

    it('a target of another Kertas is 422 memberKertas; a member with no kertas fits any', async () => {
      const [a1, b1] = [await draft({ kertas: '1' }), await draft({ kertas: '2' })] as [string, string]
      const a = await group([a1])
      const b = await group([b1])
      const res = await admin.post(`/api/stimulus-groups/${a.id}/members/${a1}/move`, { toGroupId: b.id })
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(res.body.error.fields.toGroupId).toBe(STIMULUS_MESSAGES.memberKertas)
      const c = await group([await draft()])
      const d = await group([await draft({ kertas: '2' })])
      expect((await admin.post(`/api/stimulus-groups/${c.id}/members/${(await members(c.id))[0]}/move`, { toGroupId: d.id })).status).toBe(200)
    })

    it('a target group with a Tingkatan the member does not have is 422 memberScope', async () => {
      const a1 = await draft()
      const a = await group([a1])
      const b = await group([await draft({ educationLevelId: refs.t5Id })])
      const res = await admin.post(`/api/stimulus-groups/${a.id}/members/${a1}/move`, { toGroupId: b.id })
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(res.body.error.fields.toGroupId).toBe(STIMULUS_MESSAGES.memberScope)
      // a target with a NULL level accepts it
      const open = await group([await draft(), await draft({ educationLevelId: refs.t5Id })])
      expect((await admin.post(`/api/stimulus-groups/${a.id}/members/${a1}/move`, { toGroupId: open.id })).status).toBe(200)
    })

    it('a question that is in another group than :id is 409 memberTaken; a question in no group is 404; an unknown or same target is 422', async () => {
      const [a1, b1] = [await draft(), await draft()] as [string, string]
      const a = await group([a1])
      const b = await group([b1])
      const c = await group([await draft()])
      const taken = await admin.post(`/api/stimulus-groups/${a.id}/members/${b1}/move`, { toGroupId: c.id })
      expect(taken.status, JSON.stringify(taken.body)).toBe(409)
      expect(taken.body.error.message).toBe(STIMULUS_MESSAGES.memberTaken)
      expect((await admin.post(`/api/stimulus-groups/${a.id}/members/${await draft()}/move`, { toGroupId: c.id })).status).toBe(404)
      expect((await admin.post(`/api/stimulus-groups/${a.id}/members/${a1}/move`, { toGroupId: '987654321' })).status).toBe(422)
      expect((await admin.post(`/api/stimulus-groups/${a.id}/members/${a1}/move`, { toGroupId: a.id })).status).toBe(422)
      expect((await admin.post(`/api/stimulus-groups/${a.id}/members/${a1}/move`, {})).status).toBe(422)
      expect(await members(b.id)).toEqual([b1])
    })

    it('a served member cannot move in place: 409 memberServed, nothing changes', async () => {
      const s = await servedGroup(2)
      const other = await group([await draft()])
      const res = await admin.post(`/api/stimulus-groups/${s.id}/members/${s.ids[0]}/move`, { toGroupId: other.id })
      expect(res.status, JSON.stringify(res.body)).toBe(409)
      expect(res.body.error.message).toBe(STIMULUS_MESSAGES.memberServed)
      expect(await members(s.id)).toEqual(s.ids)
    })
  })

  // ---------------------------------------------------------------------------------------------------------- API-Q-35

  describe('merge two groups (API-Q-35)', () => {
    it('appends the members of from to into in order, links the stimuli once, deletes from, writes an audit row, answers the detail of into', async () => {
      const [a1, a2, b1, b2] = [await draft(), await draft(), await draft(), await draft()] as [string, string, string, string]
      const shared = await stimulus('Kongsi')
      const into = await group([a1, a2], { stimulusIds: [shared] })
      const from = await group([b1, b2], { stimulusIds: [shared, await stimulus('Tambahan')] })
      const res = await admin.post('/api/stimulus-groups/merge', { fromGroupId: from.id, intoGroupId: into.id })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const detail = mutationEnvelopeOf(StimulusGroupDetailSchema).parse(res.body).data
      expect(detail.id).toBe(into.id)
      expect(detail.questionIds).toEqual([a1, a2, b1, b2])
      expect(detail.stimuli.map((x) => x.label)).toEqual(['Kongsi', 'Tambahan'])
      expect(await members(into.id)).toEqual([a1, a2, b1, b2])
      expect(await groupExists(from.id)).toBe(false)
      expect(await t.db.query(`select 1 from stimuli where id = $1`, [shared])).toHaveLength(1)
      expect((await auditRows('stimulus.group.merged')).at(-1)).toMatchObject({ target_id: into.id, detail: { fromGroupId: from.id, intoGroupId: into.id, members: 4, stimuli: 2 } })
    })

    it('more than 3 stimuli after the merge is 422 stimuliCount and nothing changes', async () => {
      const into = await group([await draft()], { stimulusIds: [await stimulus(), await stimulus()] })
      const from = await group([await draft()], { stimulusIds: [await stimulus(), await stimulus()] })
      const res = await admin.post('/api/stimulus-groups/merge', { fromGroupId: from.id, intoGroupId: into.id })
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(Object.values(res.body.error.fields)).toEqual([STIMULUS_MESSAGES.stimuliCount])
      expect(await groupExists(from.id)).toBe(true)
      expect(await members(from.id)).toHaveLength(1)
      expect(await members(into.id)).toHaveLength(1)
    })

    it('groups of another Subjek or Tingkatan are 422 memberScope; the same group, or an unknown group, is 422', async () => {
      const a = await group([await draft()])
      const sci = await group([await draft({ subjectId: refs.sciId })])
      const t5 = await group([await draft({ educationLevelId: refs.t5Id })])
      for (const other of [sci, t5]) {
        const res = await admin.post('/api/stimulus-groups/merge', { fromGroupId: other.id, intoGroupId: a.id })
        expect(res.status, JSON.stringify(res.body)).toBe(422)
        expect(Object.values(res.body.error.fields)).toEqual([STIMULUS_MESSAGES.memberScope])
        expect(await groupExists(other.id)).toBe(true)
      }
      expect((await admin.post('/api/stimulus-groups/merge', { fromGroupId: a.id, intoGroupId: a.id })).status).toBe(422)
      expect((await admin.post('/api/stimulus-groups/merge', { fromGroupId: '987654321', intoGroupId: a.id })).status).toBe(422)
    })

    it('a group with a served member keeps its members: merging it, or into it, is 409 groupServed', async () => {
      const s = await servedGroup(1)
      const plain = await group([await draft()])
      for (const [from, into] of [[s.id, plain.id], [plain.id, s.id]] as const) {
        const res = await admin.post('/api/stimulus-groups/merge', { fromGroupId: from, intoGroupId: into })
        expect(res.status, JSON.stringify(res.body)).toBe(409)
        expect(res.body.error.message).toBe(STIMULUS_MESSAGES.groupServed)
      }
      expect(await members(s.id)).toEqual(s.ids)
      expect(await groupExists(plain.id)).toBe(true)
    })

    it('more than 40 members after the merge is refused (membersTooMany)', async () => {
      const big = await group(await Promise.all(Array.from({ length: 21 }, () => draft())))
      const other = await group(await Promise.all(Array.from({ length: 20 }, () => draft())))
      const res = await admin.post('/api/stimulus-groups/merge', { fromGroupId: other.id, intoGroupId: big.id })
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(Object.values(res.body.error.fields)).toEqual([STIMULUS_MESSAGES.membersTooMany])
      expect(await members(other.id)).toHaveLength(20)
    })
  })
})
