import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { QuestionSchema, STIMULUS_MESSAGES, StimulusGroupDetailSchema, StimulusSchema, mutationEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, tagOf, type Refs } from './http-helpers'

/**
 * S1-T01 part 3b (lead decisions 25 and 26 on #418): publishing a group draft copy swaps it in for the served group in ONE transaction, and a
 * served member moves between two draft copies (it takes effect when both copies are published). Real database, real session guard.
 */
describe('[CI] the swap: publishing a group draft copy (API-Q-31, API-Q-32, API-Q-34)', () => {
  let t: QuestionsTestApp
  let admin: Client
  let refs: Refs
  let tag: Awaited<ReturnType<typeof tagOf>>

  beforeAll(async () => {
    process.env.FILE_STORAGE_DIR = await mkdtemp(join(tmpdir(), 'pp-group-swap-'))
    process.env.THROTTLE_QUESTIONS_WRITE_PER_MINUTE = '100000'
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
    tag = await tagOf(t.db, refs.mathId, refs.t4Id)
  })
  afterAll(async () => {
    await t.close()
  })

  const q = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)
  const question = async (over: Record<string, unknown> = {}): Promise<string> => {
    const res = await admin.post('/api/questions', mcqBody(refs, over))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return mutationEnvelopeOf(QuestionSchema).parse(res.body).data.id
  }
  const review = () => question({ status: 'review', tag })
  const stimulus = async (label: string): Promise<string> => {
    const res = await admin.post('/api/stimuli', { kind: 'passage', label, body: { ms: 'Teks petikan.' } })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return mutationEnvelopeOf(StimulusSchema).parse(res.body).data.id
  }
  /** A served group of `n` approved members (created inside the group, as the Studio does). */
  const servedGroup = async (n: number, extra: Record<string, unknown> = {}) => {
    const created = await admin.post('/api/stimulus-groups', { stimulusIds: [await stimulus('Petikan')], questionIds: [], ...extra })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const g = mutationEnvelopeOf(StimulusGroupDetailSchema).parse(created.body).data
    const ids: string[] = []
    for (let i = 0; i < n; i += 1) {
      const res = await admin.post(`/api/stimulus-groups/${g.id}/questions`, mcqBody(refs, { status: 'approved', tag }))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      ids.push(mutationEnvelopeOf(QuestionSchema).parse(res.body).data.id)
    }
    return { id: g.id, ids, stimulusId: g.stimuli[0]!.id }
  }
  const copyOf = async (groupId: string) => {
    const res = await admin.post(`/api/stimulus-groups/${groupId}/edit-as-draft`)
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return mutationEnvelopeOf(StimulusGroupDetailSchema).parse(res.body).data
  }
  /** Version 2 of a served question, edited and sent for review (the Studio path: Edit sebagai draf, edit, Hantar). */
  const editedMember = async (id: string, stem: string, status: 'draft' | 'review' = 'review') => {
    expect((await admin.post(`/api/questions/${id}/edit-as-draft`)).status).toBe(201)
    // S1-T02: the Bab is an approve gate item, so the edited copy carries a valid one (a chapter of the question's own subject and level)
    await q(
      `update question_versions v set stem_ms = $2, status = $3,
              chapter_id = (select c.id from chapters c where c.subject_id = v.subject_id and c.education_level_id = v.education_level_id and c.is_active and c.in_tree order by c.id limit 1)
        where v.question_id = $1 and v.version_no = 2`,
      [id, stem, status],
    )
  }
  const stage = (copyId: string, ids: string[]) => q(`update stimulus_groups set draft_members = $2::jsonb where id = $1`, [copyId, JSON.stringify(ids)])
  const members = async (groupId: string): Promise<string[]> => (await q(`select id::text id from questions where group_id = $1 order by group_position`, [groupId])).map((r) => r.id as string)
  const staged = async (copyId: string): Promise<string[]> => ((await q(`select draft_members d from stimulus_groups where id = $1`, [copyId]))[0]!.d as unknown[]).map(String)
  const exists = async (id: string): Promise<boolean> => (await q(`select 1 from stimulus_groups where id = $1`, [id])).length > 0
  const versions = (id: string) => q(`select version_no, status, archive_reason from question_versions where question_id = $1 order by version_no`, [id])
  const live = async (id: string) => (await q(`select live_version_no l from questions where id = $1`, [id]))[0]!.l
  const stimuliOf = async (groupId: string): Promise<string[]> => (await q(`select stimulus_id::text id from stimulus_group_stimuli where group_id = $1 order by position`, [groupId])).map((r) => r.id as string)
  const optionsOf = async (groupId: string): Promise<string[]> => (await q(`select label from stimulus_group_options where group_id = $1 order by position`, [groupId])).map((r) => r.label as string)
  const audits = () => q(`select target_id, detail from audit_events where action = 'stimulus.group.published' order by id`)
  const publish = (id: string) => admin.post(`/api/stimulus-groups/${id}/publish`)

  it('swaps in a copy with an edited, an added and a removed member: exactly effects 1 to 5, the group id unchanged, a paper still resolves, audit has fromDraftId', async () => {
    const s = await servedGroup(3)
    const [a, b, c] = s.ids as [string, string, string]
    const added = await review()
    // a published paper that places a member of the group
    const paper = (await q(`insert into papers (kind, title, subject_id, kertas, printed_duration_min, status, is_test) values ('pilihan', 'Kertas Terbit', $1, 2, 60, 'published', false) returning id::text id`, [refs.mathId]))[0]!.id as string
    const section = (await q(`insert into paper_sections (paper_id, position, label, question_count, mark_budget) values ($1, 1, 'A', 1, 10) returning id::text id`, [paper]))[0]!.id as string
    await q(`insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, $2, 1, 1)`, [section, b])

    const copy = await copyOf(s.id)
    expect((await admin.put(`/api/stimulus-groups/${copy.id}`, { label: 'Kumpulan baharu' })).status).toBe(200)
    await q(`insert into stimulus_group_options (group_id, label, body_ms, position) values ($1, 'A', 'Pilihan A', 1), ($1, 'B', 'Pilihan B', 2)`, [copy.id])
    await editedMember(a, 'Soalan a yang disunting')
    await stage(copy.id, [b, a, added]) // b and a kept (reordered), added joins, c is removed
    const copyStimuli = await stimuliOf(copy.id)
    expect(copyStimuli).not.toContain(s.stimulusId)
    const before = (await audits()).length

    const res = await publish(copy.id)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const detail = mutationEnvelopeOf(StimulusGroupDetailSchema).parse(res.body).data
    // the served group id never changes; the answer is the served group
    expect(detail).toMatchObject({ id: s.id, draftOfGroupId: null, label: 'Kumpulan baharu' })
    expect(detail.questionIds).toEqual([b, a, added])
    expect(await members(s.id)).toEqual([b, a, added])
    // 1: a is now version 2, version 1 archived `superseded`; b was already served; the added member is live
    expect(await versions(a)).toEqual([
      { version_no: 1, status: 'archived', archive_reason: 'superseded' },
      { version_no: 2, status: 'approved', archive_reason: null },
    ])
    expect(await live(a)).toBe(2)
    expect((await q(`select stem_ms from question_versions where question_id = $1 and version_no = 2`, [a]))[0]!.stem_ms).toBe('Soalan a yang disunting')
    expect(await live(added)).toBe(1)
    expect((await versions(b)).map((v) => v.status)).toEqual(['approved'])
    // 2: the removed member is released, not deleted
    expect((await q(`select group_id, group_position from questions where id = $1`, [c]))[0]).toEqual({ group_id: null, group_position: null })
    expect(await versions(c)).toEqual([{ version_no: 1, status: 'approved', archive_reason: null }])
    // 3: stimuli (copy rows, relinked), option bank and label replaced; the old stimulus row is kept, unlinked
    expect(await stimuliOf(s.id)).toEqual(copyStimuli)
    expect(await optionsOf(s.id)).toEqual(['A', 'B'])
    expect(await q(`select 1 from stimuli where id = $1`, [s.stimulusId])).toHaveLength(1)
    expect(await q(`select 1 from stimulus_group_stimuli where stimulus_id = $1`, [s.stimulusId])).toHaveLength(0)
    // 4: the copy is gone, with nothing left of it
    expect(await exists(copy.id)).toBe(false)
    expect(await q(`select 1 from stimulus_group_options where group_id = $1`, [copy.id])).toHaveLength(0)
    // 5: the audit row carries fromDraftId and names the served group
    const rows = await audits()
    expect(rows.length).toBe(before + 1)
    expect(rows.at(-1)).toMatchObject({ target_id: s.id, detail: { fromDraftId: copy.id, approved: 2, added: 1, removed: 1 } })
    // a paper that holds the group still resolves it: the group, its member and the pinned placement
    expect((await admin.get(`/api/stimulus-groups/${s.id}`)).status).toBe(200)
    const placed = await q(`select qq.group_id::text g from paper_placements pl join questions qq on qq.id = pl.question_id where pl.question_id = $1`, [b])
    expect(placed).toEqual([{ g: s.id }])
    expect((await q(`select pinned_version_no from paper_placements where question_id = $1`, [b]))[0]!.pinned_version_no).toBe(1)
    // the served group can be edited as a draft again
    expect((await admin.post(`/api/stimulus-groups/${s.id}/edit-as-draft`)).status).toBe(201)
  })

  it('decisions 25.3 and 54: the live group takes the copy\'s scope, Subjek, Tingkatan and Kertas, label, stimuli and option bank', async () => {
    const s = await servedGroup(2, { label: 'Asal' })
    expect(await q(`select subject_id, education_level_id, kertas, scope from stimulus_groups where id = $1`, [s.id])).toEqual([{ subject_id: null, education_level_id: null, kertas: null, scope: 'section' }])
    const copy = await copyOf(s.id)
    expect((await admin.put(`/api/stimulus-groups/${copy.id}`, { subjectId: refs.mathId, educationLevelId: refs.t4Id, kertas: '2', label: 'Baharu' })).status).toBe(200)
    await q(`update stimulus_groups set scope = 'paper' where id = $1`, [copy.id])
    const res = await publish(copy.id)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(await q(`select label, scope, subject_id::text subject_id, education_level_id::text education_level_id, kertas from stimulus_groups where id = $1`, [s.id])).toEqual([
      { label: 'Baharu', scope: 'paper', subject_id: refs.mathId, education_level_id: refs.t4Id, kertas: 2 },
    ])
    expect(res.body.data).toMatchObject({ id: s.id, subjectId: refs.mathId, educationLevelId: refs.t4Id, kertas: '2', scope: 'paper' })
  })

  it('part 3b guard: set, remove and order on a draft copy are still 409 (add is checked in group-actions); the copy is unchanged', async () => {
    const s = await servedGroup(2)
    const copy = await copyOf(s.id)
    const extra = await review()
    const calls = [
      await admin.put(`/api/stimulus-groups/${copy.id}/members`, { questionIds: [extra] }),
      await admin.delete(`/api/stimulus-groups/${copy.id}/members/${s.ids[0]}`),
      await admin.put(`/api/stimulus-groups/${copy.id}/members/order`, { questionIds: [...s.ids].reverse() }),
    ]
    for (const res of calls) expect(res.status, JSON.stringify(res.body)).toBe(409)
    expect(await staged(copy.id)).toEqual(s.ids)
    expect(await members(s.id)).toEqual(s.ids)
  })

  it('the gate refuses while a copy member is still Draf: 409, nothing changes, the copy stays', async () => {
    const s = await servedGroup(2)
    const copy = await copyOf(s.id)
    await editedMember(s.ids[0]!, 'Masih draf', 'draft')
    const before = (await audits()).length
    const res = await publish(copy.id)
    expect(res.status, JSON.stringify(res.body)).toBe(409)
    expect(res.body.error.message).toBe(STIMULUS_MESSAGES.publishNotReady)
    expect(await exists(copy.id)).toBe(true)
    expect(await members(s.id)).toEqual(s.ids)
    expect(await stimuliOf(s.id)).toEqual([s.stimulusId])
    expect(await live(s.ids[0]!)).toBe(1)
    expect((await audits()).length).toBe(before)
  })

  describe('all or nothing', () => {
    it('a member that fails the approve gate AFTER the group was already rewritten rolls everything back (422 details.gate)', async () => {
      const s = await servedGroup(2)
      const [a, b] = s.ids as [string, string]
      const added = await review()
      const copy = await copyOf(s.id)
      await q(`insert into stimulus_group_options (group_id, label, body_ms, position) values ($1, 'A', 'Pilihan A', 1)`, [copy.id])
      await editedMember(a, 'Boleh')
      await editedMember(b, 'Gagal gate')
      await q(`update question_versions set difficulty_tp = null, difficulty_level = null where question_id = $1 and version_no = 2`, [b])
      await stage(copy.id, [b, added, a])
      const before = (await audits()).length
      const res = await publish(copy.id)
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(res.body.error.details.gate).toHaveLength(1)
      // the original is intact
      expect(await members(s.id)).toEqual(s.ids)
      expect(await stimuliOf(s.id)).toEqual([s.stimulusId])
      expect(await optionsOf(s.id)).toEqual([])
      expect(await live(a)).toBe(1)
      expect((await versions(a)).map((v) => v.status)).toEqual(['approved', 'review'])
      expect((await versions(added)).map((v) => v.status)).toEqual(['review'])
      expect(await q(`select 1 from question_status_events where question_id = any($1::bigint[]) and to_status = 'approved' and version_no = 2`, [[a, b]])).toHaveLength(0)
      // the copy is intact too
      expect(await exists(copy.id)).toBe(true)
      expect(await stimuliOf(copy.id)).toHaveLength(1)
      expect(await optionsOf(copy.id)).toEqual(['A'])
      expect(await staged(copy.id)).toEqual([b, added, a])
      expect((await audits()).length).toBe(before)
    })

    it('a staged member that sits in another group nobody is moving it out of is 409 memberTaken (the holder cannot release it) and the original is intact', async () => {
      const s = await servedGroup(2)
      const added = await review()
      const copy = await copyOf(s.id)
      await stage(copy.id, [...s.ids, added])
      const other = await servedGroup(0)
      await q(`update questions set group_id = $2, group_position = 1 where id = $1`, [added, other.id])
      const res = await publish(copy.id)
      expect(res.status, JSON.stringify(res.body)).toBe(409)
      expect(res.body.error.message).toBe(STIMULUS_MESSAGES.memberTaken)
      expect(await members(s.id)).toEqual(s.ids)
      expect(await members(other.id)).toEqual([added])
      expect(await stimuliOf(s.id)).toEqual([s.stimulusId])
      expect(await exists(copy.id)).toBe(true)
    })

    it('an empty staged list is 409 builderBlocker and changes nothing', async () => {
      const s = await servedGroup(1)
      const copy = await copyOf(s.id)
      await stage(copy.id, [])
      const res = await publish(copy.id)
      expect(res.status, JSON.stringify(res.body)).toBe(409)
      expect(res.body.error.message).toBe(STIMULUS_MESSAGES.builderBlocker)
      expect(await members(s.id)).toEqual(s.ids)
      expect(await exists(copy.id)).toBe(true)
    })

    it('the scope check AFTER the live group was rewritten (assertScope) rolls back label, scope, stimuli, options and members', async () => {
      const s = await servedGroup(2, { label: 'Asal' })
      const [a0, a1] = s.ids as [string, string]
      const copy = await copyOf(s.id)
      expect((await admin.put(`/api/stimulus-groups/${copy.id}`, { label: 'Dari salinan', subjectId: refs.sciId })).status).toBe(200) // members are Matematik
      await q(`insert into stimulus_group_options (group_id, label, body_ms, position) values ($1, 'A', 'Pilihan A', 1)`, [copy.id])
      await stage(copy.id, [a1, a0]) // reordered, so the live members were already rewritten when the scope check fails
      const liveRow = () => q(`select label, scope, subject_id::text subject_id, education_level_id::text education_level_id, kertas from stimulus_groups where id = $1`, [s.id])
      const before = await liveRow()
      const res = await publish(copy.id)
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(res.body.error.fields.questionIds).toBe(STIMULUS_MESSAGES.memberScope)
      expect(await liveRow()).toEqual(before)
      expect(before[0]!.label).toBe('Asal')
      expect(await stimuliOf(s.id)).toEqual([s.stimulusId])
      expect(await optionsOf(s.id)).toEqual([])
      expect(await members(s.id)).toEqual([a0, a1])
      expect(await exists(copy.id)).toBe(true)
      expect(await optionsOf(copy.id)).toEqual(['A'])
    })

    it('two swaps that need each other\'s groups, run at the same time, both finish (the copy is locked first, the rest in id order)', async () => {
      const a = await servedGroup(2)
      const b = await servedGroup(1)
      const [a0, a1] = a.ids as [string, string]
      const b0 = b.ids[0]!
      const copyA = await copyOf(a.id)
      const copyB = await copyOf(b.id)
      expect((await admin.post(`/api/stimulus-groups/${copyA.id}/members/${a0}/move`, { toGroupId: copyB.id })).status).toBe(200)
      await stage(copyA.id, [a1, b0]) // b0 comes from group B, which swaps in the same moment and takes a0 from group A
      await stage(copyB.id, [a0]) // and b0 is no longer staged in B
      const [r1, r2] = await Promise.all([publish(copyA.id), publish(copyB.id)])
      expect([r1.status, r2.status], JSON.stringify([r1.body, r2.body])).toEqual([200, 200])
      expect(await members(a.id)).toEqual([a1, b0])
      expect(await members(b.id)).toEqual([a0])
    })
  })

  describe('decision 26: a served member moves between two draft copies', () => {
    it('is accepted, changes only the staged members, and takes effect when both copies are published (source first)', async () => {
      const a = await servedGroup(2)
      const b = await servedGroup(1)
      const [a0, a1] = a.ids as [string, string]
      const copyA = await copyOf(a.id)
      const copyB = await copyOf(b.id)
      const res = await admin.post(`/api/stimulus-groups/${copyA.id}/members/${a0}/move`, { toGroupId: copyB.id })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data.from.questionIds).toEqual([a1])
      expect(res.body.data.to.questionIds).toEqual([b.ids[0], a0])
      expect(await staged(copyA.id)).toEqual([a1])
      expect(await staged(copyB.id)).toEqual([b.ids[0], a0])
      // nothing is served differently yet
      expect(await members(a.id)).toEqual([a0, a1])
      expect(await members(b.id)).toEqual(b.ids)
      expect((await publish(copyA.id)).status).toBe(200)
      expect(await members(a.id)).toEqual([a1])
      expect((await q(`select group_id from questions where id = $1`, [a0]))[0]!.group_id).toBeNull()
      expect((await publish(copyB.id)).status).toBe(200)
      expect(await members(b.id)).toEqual([b.ids[0], a0])
      expect(await live(a0)).toBe(1)
      expect(await exists(copyA.id)).toBe(false)
      expect(await exists(copyB.id)).toBe(false)
    })

    it('the target copy may be published first: the member is taken over from the source group, then the source copy swaps without it', async () => {
      const a = await servedGroup(2)
      const b = await servedGroup(1)
      const [a0, a1] = a.ids as [string, string]
      const copyA = await copyOf(a.id)
      const copyB = await copyOf(b.id)
      expect((await admin.post(`/api/stimulus-groups/${copyA.id}/members/${a0}/move`, { toGroupId: copyB.id })).status).toBe(200)
      expect((await publish(copyB.id)).status).toBe(200)
      expect(await members(b.id)).toEqual([b.ids[0], a0])
      expect(await members(a.id)).toEqual([a1])
      expect((await publish(copyA.id)).status).toBe(200)
      expect(await members(a.id)).toEqual([a1])
      expect(await members(b.id)).toEqual([b.ids[0], a0])
    })

    it('the target copy cannot be published first while the member is still staged in the source copy (409)', async () => {
      const a = await servedGroup(2)
      const b = await servedGroup(1)
      const copyA = await copyOf(a.id)
      const copyB = await copyOf(b.id)
      await stage(copyB.id, [b.ids[0]!, a.ids[0]!]) // staged in both copies
      const res = await publish(copyB.id)
      expect(res.status, JSON.stringify(res.body)).toBe(409)
      expect(await members(b.id)).toEqual(b.ids)
      expect(await members(a.id)).toEqual(a.ids)
      expect(await exists(copyA.id)).toBe(true)
    })

    it('a served member that is not between two draft copies is still 409 (live to live, live to a copy, copy to live)', async () => {
      const a = await servedGroup(2)
      const b = await servedGroup(1)
      const copyA = await copyOf(a.id)
      const copyB = await copyOf(b.id)
      const live = await admin.post(`/api/stimulus-groups/${a.id}/members/${a.ids[0]}/move`, { toGroupId: b.id })
      expect(live.status, JSON.stringify(live.body)).toBe(409)
      expect(live.body.error.message).toBe(STIMULUS_MESSAGES.memberServed)
      expect((await admin.post(`/api/stimulus-groups/${a.id}/members/${a.ids[0]}/move`, { toGroupId: copyB.id })).status).toBe(409)
      expect((await admin.post(`/api/stimulus-groups/${copyA.id}/members/${a.ids[0]}/move`, { toGroupId: b.id })).status).toBe(409)
      expect(await members(a.id)).toEqual(a.ids)
      expect(await members(b.id)).toEqual(b.ids)
      expect(await staged(copyA.id)).toEqual(a.ids)
      expect(await staged(copyB.id)).toEqual(b.ids)
    })

    it('a member that is not staged in the source copy is 404', async () => {
      const a = await servedGroup(1)
      const b = await servedGroup(1)
      const copyA = await copyOf(a.id)
      const copyB = await copyOf(b.id)
      const res = await admin.post(`/api/stimulus-groups/${copyA.id}/members/${b.ids[0]}/move`, { toGroupId: copyB.id })
      expect(res.status, JSON.stringify(res.body)).toBe(404)
    })
  })
})
