import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../src/common/errors/api-error'
import { QuestionsService } from '../../src/modules/questions'

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
    // Draf -> Semakan -> Terbit (ADR-0027: approved = servable). Semakan asks for the Bab, which the reviewer picks after accept.
    await t.db.query(`update question_versions set chapter_id = (select id from chapters limit 1) where question_id = any($1::bigint[])`, [questionIds])
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

describe('a refused accept leaves no figure copy, stimulus or group behind (T42b minor)', () => {
  const counts = async () => ({
    images: Number((await t.db.query<{ n: string }>(`select count(*)::text n from files where purpose = 'question_image'`))[0]!.n),
    stimuli: Number((await t.db.query<{ n: string }>(`select count(*)::text n from stimuli`))[0]!.n),
    groups: Number((await t.db.query<{ n: string }>(`select count(*)::text n from stimulus_groups`))[0]!.n),
  })

  it('a 422 after the bank stimulus was made rolls its file, stimulus and group back; a retry then makes exactly one', async () => {
    t.ai.paper = () =>
      paper([draft(t.codes, '1', { stimulusId: 'stim-9' })], {
        stimuli: [{ id: 'stim-9', kind: 'diagram', label: 'Rajah 9', alt: 'Rajah segi empat', page: 1, region: REGION }],
      })
    const { batchId } = await readyBatch(t, teacher)
    await extractAndRun(t, teacher, batchId)
    const [item] = await itemsOf(teacher, batchId)
    const before = await counts()

    const svc = t.app.get(QuestionsService)
    const spy = vi.spyOn(svc, 'createFromIntake').mockRejectedValue(ApiError.of('VALIDATION_ERROR', { fields: { stem: 'Teks soalan tidak sah.' } }))
    for (let i = 0; i < 3; i++) {
      const res = await post(teacher, `/intake/items/${item!.id}/accept`)
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(await counts(), `retry ${String(i + 1)}`).toEqual(before) // no orphan per retry
    }
    spy.mockRestore()

    const ok = await post(teacher, `/intake/items/${item!.id}/accept`)
    expect(ok.status, JSON.stringify(ok.body)).toBe(200)
    expect(await counts()).toEqual({ images: before.images + 1, stimuli: before.stimuli + 1, groups: before.groups + 1 })
  })
})
