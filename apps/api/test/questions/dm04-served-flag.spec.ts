import { QuestionSchema, STIMULUS_MESSAGES, StimulusSchema, mutationEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { StimuliRepository } from '../../src/modules/questions/stimuli.repository'
import { bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, tagOf, type Refs } from './http-helpers'

/**
 * S1-T07 (DM-04, 50 section 4.1): a question excluded by an open servability flag (DM-05) is NOT "served" for the group lock, so QE-08 can attach
 * it to a group; a served unflagged member stays locked; a dismissed flag ("Bukan masalah") locks it again. Real database, real routes.
 */
describe('DM-04 served lock and the open flag', () => {
  let t: QuestionsTestApp
  let admin: Client
  let refs: Refs
  let repo: StimuliRepository
  let tag: Awaited<ReturnType<typeof tagOf>>

  beforeAll(async () => {
    process.env.THROTTLE_QUESTIONS_WRITE_PER_MINUTE = '100000'
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
    tag = await tagOf(t.db, refs.mathId, refs.t4Id)
    repo = t.app.get(StimuliRepository)
  })
  afterAll(async () => {
    await t.close()
  })

  const q = (sql: string, params: unknown[] = []) => t.db.query(sql, params)
  async function question(text: string, publish: boolean): Promise<string> {
    const res = await admin.post('/api/questions', mcqBody(refs, { questionText: text, tag }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = mutationEnvelopeOf(QuestionSchema).parse(res.body).data.id
    if (publish) {
      await q(`update question_versions set status = 'approved', published_at = now(), paper_code = '1449/2' where question_id = $1`, [id])
      await q(`update questions set live_version_no = 1 where id = $1`, [id])
    }
    return id
  }
  const setFlag = (id: string, flag: 'stimulus_missing' | 'figure_only' | null) =>
    q(`update question_versions set stimulus_flag = $2, stimulus_flag_at = now(), flag_dismissed_at = null where question_id = $1 and version_no = 1`, [id, flag])

  /** A group whose only member is published (live approved) and, when given, flagged in place. Returns ids. */
  async function servedGroup(label: string, flag: 'stimulus_missing' | 'figure_only' | null): Promise<{ g: string; member: string; stimulusId: string }> {
    const member = await question(`Hitung ${label} campur 15 dengan teliti.`, false)
    const s = await admin.post('/api/stimuli', { kind: 'passage', label: `DM04 ${label}`, body: { ms: 'Teks rangsangan.' } })
    const stimulusId = mutationEnvelopeOf(StimulusSchema).parse(s.body).data.id
    const res = await admin.post('/api/stimulus-groups', { stimulusIds: [stimulusId], questionIds: [member] })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    await q(`update question_versions set status = 'approved', published_at = now(), paper_code = '1449/2' where question_id = $1`, [member])
    await q(`update questions set live_version_no = 1 where id = $1`, [member])
    if (flag !== null) await setFlag(member, flag)
    return { g: res.body.data.id as string, member, stimulusId }
  }
  const dismiss = (id: string, flag: string) => admin.post(`/api/admin/questions/${id}/flags/dismiss`, { flag })
  /** The group-lock path (`GroupMembers.assertNotServed`, group-members.ts:54): changing the stimuli of a group. */
  async function changeStimuli(g: string) {
    const s = await admin.post('/api/stimuli', { kind: 'passage', label: 'DM04 baru', body: { ms: 'Teks baru.' } })
    return admin.put(`/api/stimulus-groups/${g}`, { stimulusIds: [mutationEnvelopeOf(StimulusSchema).parse(s.body).data.id] })
  }
  const listIds = async (query: string): Promise<string[]> => ((await admin.get(`/api/stimulus-groups?${query}&pageSize=100`)).body.data as { id: string }[]).map((r) => r.id)

  it('[CI] DM-04: a served, unflagged member stays locked (group lock 409, stimulus lock 409, member lock 409)', async () => {
    const { g, member, stimulusId } = await servedGroup('1', null)
    expect(await repo.servingMemberIds(g)).toEqual([member])
    expect((await changeStimuli(g)).body.error?.message ?? '').toBe(STIMULUS_MESSAGES.groupServed)
    expect(await repo.stimulusServed(stimulusId)).toBe(true)
    expect((await admin.put(`/api/stimuli/${stimulusId}`, { label: 'Lain' })).status).toBe(409)
    const served = await question('Hitung 14 campur 15 dengan teliti.', true)
    const bad = await admin.post(`/api/stimulus-groups/${g}/members`, { questionId: served })
    expect(bad.status).toBe(409)
  })

  for (const flag of ['stimulus_missing', 'figure_only'] as const) {
    it(`[CI] DM-04: a ${flag} member (open flag) does not lock the group, the stimulus or the list filters; dismissing through the route locks them again`, async () => {
      const { g, member, stimulusId } = await servedGroup(`2${flag}`, flag)
      expect(await repo.servingMemberIds(g)).toEqual([])
      expect(await repo.stimulusServed(stimulusId)).toBe(false)
      expect(await listIds('status=served')).not.toContain(g)
      expect(await listIds('joinable=true')).toContain(g)
      expect((await admin.put(`/api/stimuli/${stimulusId}`, { label: 'Lain' })).status).toBe(200)
      // The group-lock path (group-members.ts:54) lets the stimuli of a group with only a flagged member change.
      const spare = await servedGroup(`3${flag}`, flag)
      const changed = await changeStimuli(spare.g)
      expect(changed.status, JSON.stringify(changed.body)).toBe(200)
      // A flagged served question can be added to another group on the normal route (no regroup flag).
      const other = await question(`Soalan bertanda ${flag} untuk ujian.`, true)
      await setFlag(other, flag)
      const empty = await admin.post('/api/stimulus-groups', { stimulusIds: [(await admin.post('/api/stimuli', { kind: 'passage', label: 'DM04 kosong', body: { ms: 'Teks.' } })).body.data.id], questionIds: [] })
      const add = await admin.post(`/api/stimulus-groups/${empty.body.data.id as string}/members`, { questionId: other })
      expect(add.status, JSON.stringify(add.body)).toBe(200)
      // "Bukan masalah" through the real route: served again, locks again.
      expect((await dismiss(member, flag)).status).toBe(200)
      expect(await repo.servingMemberIds(g)).toEqual([member])
      expect(await repo.stimulusServed(stimulusId)).toBe(true)
      expect(await listIds('status=served')).toContain(g)
      expect(await listIds('joinable=true')).not.toContain(g)
      expect((await changeStimuli(g)).status).toBe(409)
    })
  }

  it('[CI] DM-04: a flagged question pinned by a published paper stays locked (branch B)', async () => {
    const { g, member } = await servedGroup('4', 'stimulus_missing')
    expect(await repo.servingMemberIds(g)).toEqual([])
    const subject = (await q(`select subject_id::text id from question_versions where question_id = $1 and version_no = 1`, [member]))[0] as { id: string }
    const p = (await q(`insert into papers (kind, title, subject_id, kertas, printed_duration_min, status, published_at) values ('pilihan', 'DM04 kertas', $1, 1, 60, 'published', now()) returning id::text id`, [subject.id]))[0] as { id: string }
    const sec = (await q(`insert into paper_sections (paper_id, position, label, question_count, mark_budget) values ($1, 1, 'A', 1, 0) returning id::text id`, [p.id]))[0] as { id: string }
    await q(`insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, $2, 1, 1)`, [sec.id, member])
    expect(await repo.servingMemberIds(g)).toEqual([member])
    expect((await changeStimuli(g)).status).toBe(409)
  })

  it('[CI] DM-04: a stem_duplicated flag never excluded a question, so it still counts as served', async () => {
    const { g, member } = await servedGroup('5', null)
    await q(`update question_versions set stimulus_flag = 'stem_duplicated' where question_id = $1 and version_no = 1`, [member])
    expect(await repo.servingMemberIds(g)).toEqual([member])
  })
})
