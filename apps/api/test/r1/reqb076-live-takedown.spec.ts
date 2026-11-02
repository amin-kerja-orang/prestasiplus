import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { QuestionsRepository } from '../../src/modules/questions'
import { ACCOUNTS } from '../exam-builder/helpers'
import { makePng } from '../files/fixtures'
import { bootFullApp, loginFull, type FullApp, type FullClient } from './full-app'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 300_000 })

/**
 * REQ-B-076 (live path). `addVersion` carries `source_paper_id` to version n+1 and no approve gate reads
 * `source_papers.takedown_at`, so a RE-APPROVED version of a taken-down source was drawn again (practice, Kuiz random) and its pictures served (rule A).
 * The live path now reads the same fact as the pinned path (`NOT_SOURCE_TAKEN_DOWN_SQL`).
 */
describe('REQ-B-076: a re-approved version of a taken-down source is not served on the live path', () => {
  let t: FullApp
  let admin: FullClient
  let pupil: FullClient
  let subject: string
  let level: string
  let tag: { unitId: string; spIds: string[]; tp: number }
  let qid = ''
  let token = ''
  let sourceId = ''
  const STEM = 'Soalan sumber ditarik: berapakah 6 + 7?'
  const STEM2 = 'Soalan sumber ditarik versi dua: berapakah 8 + 9?'
  let counter = 0
  let last = ''

  const q = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)
  const one = async (sql: string) => String((await q(sql))[0]!.id)

  async function upload(): Promise<string> {
    const res = await admin.upload('/api/files?purpose=question_image', makePng({ width: 4 + counter++, height: 4 }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data.id as string
  }
  const body = (text: string, imageId: string) => ({
    subjectId: subject,
    educationLevelId: level,
    difficultyLevel: 3,
    questionType: 'mcq',
    questionText: text,
    options: ['11', '12', '13', '14'],
    correctAnswer: 2,
    explanation: 'Penjelasan ujian.',
    cognitiveLevel: 'mengaplikasi',
    kertas: '2',
    tag,
    questionImageFileId: imageId,
  })
  async function advance(id: string): Promise<void> {
    await q(
      `update question_versions set chapter_id = (select id from chapters where subject_id = $2::bigint and education_level_id = $3::bigint order by id limit 1) where question_id = $1::bigint and chapter_id is null`,
      [id, subject, level],
    )
    for (const action of ['review', 'approved']) {
      const res = await admin.post('/api/questions/bulk-action', { action, ids: [id] })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data, `${action}: ${JSON.stringify(res.body.data)}`).toMatchObject({ affected: 1, failed: [] })
    }
  }
  /** Is the question drawn: a Kuiz random session for MATH, and a targeted Latih Tubi session. */
  const kuizHas = async (text: string): Promise<boolean> => {
    const res = await pupil.post('/api/bijak/kuiz/sessions', { subject: 'MATH', count: 5 })
    last = `kuiz ${String(res.status)} ${JSON.stringify(res.body).slice(0, 200)}`
    return res.status === 201 && JSON.stringify(res.body).includes(text)
  }
  /** The learner draw scope that practice (Latih Tubi, Databank, Bab) and the counts read: `QuestionsRepository.eligibleIds` (status approved, active, learner-visible). */
  const practiceHas = async (id: string): Promise<boolean> => (await t.app.get(QuestionsRepository).eligibleIds({ subjectId: subject })).includes(id)
  const image = () => pupil.get(`/api/files/${token}`)

  beforeAll(async () => {
    t = await bootFullApp()
    admin = await loginFull(t, ACCOUNTS.admin)
    pupil = await loginFull(t, ACCOUNTS.student)
    subject = await one(`select id::text id from subjects where code = 'MATH'`)
    level = await one(`select id::text id from education_levels where code = 'T4'`)
    const unit = await one(`select id::text id from curriculum_nodes where kind = 'unit' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    const sp = await one(`select id::text id from curriculum_nodes where kind = 'sp' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    tag = { unitId: unit, spIds: [sp], tp: 3 }
    token = await upload()
    const made = await admin.post('/api/questions', body(STEM, token))
    expect(made.status, JSON.stringify(made.body)).toBe(201)
    qid = made.body.data.id as string
    await advance(qid)
    sourceId = await one(`insert into source_papers (rights_status) values ('own') returning id::text id`)
    await q(`update question_versions set source_paper_id = ${sourceId} where question_id = ${qid} and version_no = 1`)
  })
  afterAll(async () => {
    await t.close()
  })

  it('control: a live approved question of a source that is not taken down is drawn and its picture is readable', async () => {
    expect(await kuizHas(STEM), last).toBe(true)
    expect(await practiceHas(qid)).toBe(true)
    expect((await image()).status).toBe(200)
  })

  it('the source is taken down and a new version is re-approved (the source id is carried): not drawn in Kuiz random or practice, and the picture is 404 for a pupil with no sitting', async () => {
    await q(`update source_papers set takedown_at = now() where id = ${sourceId}`)
    const edit = await admin.put(`/api/questions/${qid}`, body(STEM2, token))
    expect(edit.status, JSON.stringify(edit.body)).toBe(200)
    await advance(qid)
    const live = await q(`select v.version_no n, v.status, v.source_paper_id::text sp from questions qq join question_versions v on v.question_id = qq.id and v.version_no = qq.live_version_no where qq.id = ${qid}`)
    expect(live[0], 'the re-approved version is live and carries the taken-down source').toMatchObject({ n: 2, status: 'approved', sp: sourceId })
    expect(await kuizHas(STEM2)).toBe(false)
    expect(await practiceHas(qid)).toBe(false)
    expect((await image()).status).toBe(404)
  })

  it('lifting the takedown_at brings the question back (the check reads the source row)', async () => {
    await q(`update source_papers set takedown_at = null where id = ${sourceId}`)
    expect(await kuizHas(STEM2)).toBe(true)
    expect((await image()).status).toBe(200)
  })
})
