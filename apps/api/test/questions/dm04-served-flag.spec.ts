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
  async function group(questionIds: string[]): Promise<string> {
    const s = await admin.post('/api/stimuli', { kind: 'passage', label: 'DM04', body: { ms: 'Teks rangsangan.' } })
    const stimulusId = mutationEnvelopeOf(StimulusSchema).parse(s.body).data.id
    const res = await admin.post('/api/stimulus-groups', { stimulusIds: [stimulusId], questionIds })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data.id as string
  }
  const setFlag = (id: string, flag: 'stimulus_missing' | 'figure_only' | null) =>
    q(`update question_versions set stimulus_flag = $2, stimulus_flag_at = now(), flag_dismissed_at = null where question_id = $1 and version_no = 1`, [id, flag])

  it('[CI] DM-04: a served, unflagged member stays locked (the group lock and the member lock answer 409)', async () => {
    const member = await question('Hitung 12 campur 15 dengan teliti.', false)
    const g = await group([member])
    await q(`update question_versions set status = 'approved', published_at = now(), paper_code = '1449/2' where question_id = $1`, [member])
    await q(`update questions set live_version_no = 1 where id = $1`, [member])
    expect(await repo.servingMemberIds(g)).toEqual([member])
    const other = await question('Hitung 13 campur 15 dengan teliti.', false)
    const res = await admin.post(`/api/stimulus-groups/${g}/members`, { questionId: other })
    expect(res.status).toBe(200) // a new draft may still be appended
    const served = await question('Hitung 14 campur 15 dengan teliti.', true)
    const bad = await admin.post(`/api/stimulus-groups/${g}/members`, { questionId: served })
    expect(bad.status).toBe(409)
    expect(bad.body.error?.message ?? bad.body.message).toBe(STIMULUS_MESSAGES.memberServed)
  })

  for (const flag of ['stimulus_missing', 'figure_only'] as const) {
    it(`[CI] DM-04: a ${flag} member (open flag) is not locked on the normal group routes; a dismissed flag locks it again`, async () => {
      // Attaching to a group re-runs the detectors (a group clears the flag), so the lock is read on a member that is flagged in place.
      const flagged = await question(`Soalan bertanda ${flag} untuk ujian.`, true)
      await setFlag(flagged, flag)
      const target = await group([])
      const add = await admin.post(`/api/stimulus-groups/${target}/members`, { questionId: flagged })
      expect(add.status, JSON.stringify(add.body)).toBe(200) // not served: no regroup flag needed on the normal route
      const member = await question(`Ahli kumpulan ${flag} untuk ujian.`, false)
      const g = await group([member])
      await q(`update question_versions set status = 'approved', published_at = now(), paper_code = '1449/2' where question_id = $1`, [member])
      await q(`update questions set live_version_no = 1 where id = $1`, [member])
      await setFlag(member, flag)
      expect(await repo.servingMemberIds(g)).toEqual([])
      // Dismissed ("Bukan masalah"): shown to pupils again, so the group is locked again.
      await q(`update question_versions set flag_dismissed_at = now() where question_id = $1 and version_no = 1`, [member])
      expect(await repo.servingMemberIds(g)).toEqual([member])
      // A stem_duplicated flag never excluded a question, so it counts as served.
      await q(`update question_versions set stimulus_flag = 'stem_duplicated', flag_dismissed_at = null where question_id = $1 and version_no = 1`, [member])
      expect(await repo.servingMemberIds(g)).toEqual([member])
    })
  }
})
