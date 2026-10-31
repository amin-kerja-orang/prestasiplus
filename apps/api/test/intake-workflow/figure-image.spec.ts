import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { binary } from '../intake-files/helpers'
import { bootWorkflowApp, draft, extractAndRun, itemsOf, loginAs, paper, post, readyBatch, type LoggedIn, type WorkflowTestApp } from './helpers'

/**
 * AC-R1-14.3: a figure of the PDF is cropped, stored, and on accept the bank stimulus carries it as a `question_image` file that the
 * accepted questions share through one stimulus group. The intake crop itself (`intake_figure`) is for reviewers only; the question
 * image follows the question-image read rule: admin and teacher always, a pupil only while the question is served (approved).
 * Real path: batch, upload, extract with a figure region, crop job, review, accept, publish.
 */
let t: WorkflowTestApp
let teacher: LoggedIn
let admin: LoggedIn
let student: LoggedIn

beforeAll(async () => {
  t = await bootWorkflowApp()
  teacher = await loginAs(t, 'guru@demo.test')
  admin = await loginAs(t, 'admin@demo.test')
  student = await loginAs(t, 'pelajar@demo.test')
}, 120_000)
afterAll(async () => {
  await t.close()
})

const REGION = { page: 1, x: 0.1, y: 0.1, w: 0.5, h: 0.4 }

describe('a cropped figure becomes a question_image on the accepted stimulus (AC-R1-14.3)', () => {
  let batchId: string
  let cropFileId: string
  let questionIds: string[]
  let imageToken: string

  beforeAll(async () => {
    t.ai.paper = () =>
      paper([draft(t.codes, '1', { stimulusId: 'stim-1' }), draft(t.codes, '2', { stimulusId: 'stim-1' })], {
        stimuli: [{ id: 'stim-1', kind: 'diagram', label: 'Rajah 1', alt: 'Rajah segi tiga sama kaki', page: 1, region: REGION }],
      })
    batchId = (await readyBatch(t, teacher)).batchId
    await extractAndRun(t, teacher, batchId)
  }, 120_000)

  it('extraction crops the region into an intake_figure file linked to the intake stimulus', async () => {
    const rows = await t.db.query<{ figure_id: string; crop_file_id: string; purpose: string; mime: string }>(
      `select s.figure_id::text, g.crop_file_id::text, f.purpose, f.mime
         from intake_stimuli s join intake_figures g on g.id = s.figure_id join files f on f.id = g.crop_file_id
        where s.batch_id = $1`,
      [batchId],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ purpose: 'intake_figure', mime: 'image/png' })
    cropFileId = (rows[0] as { crop_file_id: string }).crop_file_id
  })

  it('accept stores a question_image copy of the crop, linked to the one stimulus the two questions share', async () => {
    const items = await itemsOf(teacher, batchId)
    expect(items).toHaveLength(2)
    questionIds = []
    for (const i of items) {
      const res = await post(teacher, `/intake/items/${i.id}/accept`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      questionIds.push(res.body.data.question.id as string)
    }
    const owner = (await t.db.query<{ id: string }>(`select owner_user_id::text id from intake_batches where id = $1`, [batchId]))[0]?.id
    const stim = await t.db.query<{ id: string; asset_file_id: string; purpose: string; mime: string; owner_user_id: string | null; public_id: string; size_bytes: string }>(
      `select st.id::text, st.asset_file_id::text, f.purpose, f.mime, f.owner_user_id::text, f.public_id, f.size_bytes::text
         from questions q join stimulus_group_stimuli gs on gs.group_id = q.group_id join stimuli st on st.id = gs.stimulus_id join files f on f.id = st.asset_file_id
        where q.id = any($1::bigint[]) group by st.id, f.id`,
      [questionIds],
    )
    expect(stim).toHaveLength(1) // one stimulus, one group, for both questions
    const s = stim[0]!
    expect(s.purpose).toBe('question_image')
    expect(s.mime).toBe('image/png')
    expect(s.owner_user_id).toBe(owner)
    expect(s.asset_file_id).not.toBe(cropFileId) // its own file, not the reviewer-only crop
    const groups = await t.db.query<{ g: string }>(`select distinct group_id::text g from questions where id = any($1::bigint[])`, [questionIds])
    expect(groups).toHaveLength(1)
    const stored = await t.db.query<{ size_bytes: string }>(`select size_bytes::text from files where id = $1`, [cropFileId])
    expect(s.size_bytes).toBe(stored[0]?.size_bytes) // the same bytes as the crop
    imageToken = s.public_id
    const alt = await t.db.query<{ alt_text: string | null }>(`select alt_text from stimuli where id = $1`, [s.id])
    expect(alt[0]?.alt_text).toBe('Rajah segi tiga sama kaki')
  })

  it('the draft question image is readable by admin and teacher, never by a pupil (404)', async () => {
    const statuses = await t.db.query<{ status: string }>(`select v.status from question_versions v where v.question_id = any($1::bigint[])`, [questionIds])
    expect(new Set(statuses.map((r) => r.status))).toEqual(new Set(['draft']))
    const url = `/api/files/${imageToken}`
    for (const who of [teacher, admin]) {
      const res = await who.agent.get(url).buffer().parse(binary)
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toBe('image/png')
    }
    const denied = await student.agent.get(url)
    expect(denied.status).toBe(404)
    expect((await t.http().get(url)).status).toBe(401)
  })

  it('the reviewer-only crop is never readable by a pupil, even after the question is approved', async () => {
    // Draf -> Semakan -> Terbit (ADR-0027: approved = servable).
    for (const action of ['review', 'approved']) {
      const res = await admin.agent.post('/api/questions/bulk-action').set('X-CSRF-Token', admin.csrf).send({ action, ids: questionIds })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data.failed, JSON.stringify(res.body)).toEqual([])
    }
    const live = await t.db.query<{ status: string }>(`select v.status from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where q.id = any($1::bigint[])`, [questionIds])
    expect(live.map((r) => r.status)).toEqual(['approved', 'approved'])
    const cropToken = (await t.db.query<{ public_id: string }>(`select public_id from files where id = $1`, [cropFileId]))[0]!.public_id
    expect((await student.agent.get(`/api/files/${cropToken}`)).status).toBe(404)
  })

  it('once the question is approved (served), the pupil reads the question image', async () => {
    const res = await student.agent.get(`/api/files/${imageToken}`).buffer().parse(binary)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('image/png')
  })
})
