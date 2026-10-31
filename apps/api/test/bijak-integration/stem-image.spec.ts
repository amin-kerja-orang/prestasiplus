/**
 * R1E2E-05 (CRITICAL): a published bank question with a stem image (and one with option images, and one with its own
 * non-group stimulus) must START in a Terbit paper (200, never 403 "Percubaan tidak dapat dimulakan.") and the pupil must
 * be able to read each image URL the served paper carries. Real database, real `BijakIntegrationModule` wiring, real files.
 */
import { BijakAttemptPaperViewSchema, BijakAttemptResultViewSchema, SessionSchema } from '@pp/contract'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { Be09BijakQuestionSource } from '../../src/modules/bijak/question-bridge'
import { makePng } from '../files/fixtures'
import { tagBody, tagOf, type Tag } from '../questions/fixtures'
import { bootIntegrationApp, ADMIN, DEMO_PASSWORD, loginAs, START, STUDENT, type Client, type IntegrationApp } from './helpers'

let t: IntegrationApp
let pupil: Client
let admin: TestAgent
let adminCsrf = ''
let tag: Tag

beforeAll(async () => {
  t = await bootIntegrationApp()
  pupil = await loginAs(t, STUDENT)
  admin = t.agent()
  const res = await admin.post('/api/auth/login').send({ identifier: ADMIN, password: DEMO_PASSWORD, remember: false })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  adminCsrf = SessionSchema.parse(res.body.data).csrf
  tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
})
afterAll(async () => {
  await t.close()
})

const one = async (sql: string, params: unknown[] = []) => (await t.db.query<Record<string, string>>(sql, params))[0]!

interface Img {
  id: string
  url: string
  dbId: string
}
async function upload(): Promise<Img> {
  const res = await admin
    .post('/api/files?purpose=question_image')
    .set('X-CSRF-Token', adminCsrf)
    .attach('file', makePng(), { filename: 'r.png', contentType: 'image/png' })
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  const { id, url } = res.body.data as { id: string; url: string }
  return { id, url, dbId: (await one(`select id::text from files where public_id = $1`, [id])).id! }
}

/** An approved (Terbit) T4 MCQ, no group; returns its id and live version id. */
async function approvedMcq(): Promise<{ qid: string; vid: string }> {
  const res = await admin
    .post('/api/questions')
    .set('X-CSRF-Token', adminCsrf)
    .send({
      subjectId: tag.subjectId,
      educationLevelId: tag.levelId,
      difficultyLevel: 3,
      questionType: 'mcq',
      questionText: 'Perhatikan gambar. Berapakah hasil tambah 2 dan 3?',
      options: ['4', '5', '6', '7'],
      correctAnswer: 1,
      tag: tagBody(tag, 3),
      status: 'approved',
    })
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  const qid = res.body.data.id as string
  expect(
    (await one(`select count(*)::text c from questions where id = $1 and group_id is null and live_version_no = 1`, [qid])).c,
  ).toBe('1')
  return { qid, vid: (await one(`select id::text from question_versions where question_id = $1 and version_no = 1`, [qid])).id! }
}
const newStimulus = async (kind: string, extra: { img?: Img; body?: string; label?: string } = {}): Promise<string> =>
  (
    await one(`insert into stimuli (kind, asset_file_id, body_ms, label) values ($1, $2, $3, $4) returning id::text`, [
      kind,
      extra.img?.dbId ?? null,
      extra.body ?? null,
      extra.label ?? null,
    ])
  ).id!
const linkStimulus = (vid: string, sid: string, position = 1) =>
  t.db.query(`insert into question_version_stimuli (question_version_id, stimulus_id, position) values ($1, $2, $3)`, [vid, sid, position])

/** A Terbit pilihan paper placing the question (pinned to its live version), as the builder publishes it. */
async function publishedPaper(qid: string): Promise<string> {
  const paper = await t.db.prisma.paper.create({
    data: {
      kind: 'pilihan',
      title: 'Kertas gambar soalan',
      subjectId: BigInt(tag.subjectId),
      kertas: 2,
      paperCode: '1449/2',
      printedDurationMin: 60,
      status: 'published',
      publishedAt: new Date(START),
      sections: {
        create: [
          {
            position: 1,
            label: 'Bahagian A',
            questionCount: 1,
            markBudget: 1,
            placements: { create: [{ questionId: BigInt(qid), position: 1, pinnedVersionNo: 1 }] },
          },
        ],
      },
    },
  })
  return paper.id.toString()
}

/** Starting an attempt answers 201 (created). */
const start = (paperId: string) => pupil.post('/api/bijak/attempts', { paperId, mode: 'exam' })
async function view(paperId: string) {
  const res = await start(paperId)
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  const attemptId = (res.body as { data: { attemptId: string } }).data.attemptId
  const v = await pupil.get(`/api/bijak/attempts/${attemptId}`)
  expect(v.status, JSON.stringify(v.body)).toBe(200)
  return BijakAttemptPaperViewSchema.parse(v.body.data)
}
/** The pupil's GET of an image URL returns the picture. */
async function expectReadable(url: string): Promise<void> {
  const r = await pupil.get(url)
  expect(r.status, url).toBe(200)
  expect(String(r.headers['content-type'])).toContain('image/png')
  expect((await t.agent().get(url)).status, 'anonymous').toBe(401)
}

describe('R1E2E-05 a bank question with a picture starts in a Terbit paper', () => {
  it('1. an approved T4 MCQ with a stem image (no group): the paper starts (200) and the pupil reads the stem image', async () => {
    const { qid, vid } = await approvedMcq()
    const stem = await upload()
    await linkStimulus(vid, await newStimulus('image', { img: stem }))
    const paperId = await publishedPaper(qid)

    const v = await view(paperId)
    const q = v.questions.find((x) => x.id === qid)!
    expect(q.stemImage?.image?.url).toBe(stem.url)
    expect(v.groups).toEqual([])
    await expectReadable(q.stemImage!.image!.url)
    // The answer key is not on the served paper.
    expect(JSON.stringify(v)).not.toContain('correctOption')
  })

  it('2. MCQ option images: starts (200) and the pupil reads every option image', async () => {
    const { qid, vid } = await approvedMcq()
    const a = await upload()
    const b = await upload()
    const opts = await t.db.query<{ id: string }>(
      `select o.id::text id from part_options o join question_parts p on p.id = o.part_id
        where p.question_version_id = $1 order by o.position limit 2`,
      [vid],
    )
    await t.db.query(`update part_options set image_file_id = $2 where id = $1`, [opts[0]!.id, a.dbId])
    await t.db.query(`update part_options set image_file_id = $2 where id = $1`, [opts[1]!.id, b.dbId])
    const v = await view(await publishedPaper(qid))
    const urls = (v.questions.find((x) => x.id === qid)!.mcq?.options ?? []).flatMap((o) => (o.image ? [o.image.url] : []))
    expect(urls).toEqual([a.url, b.url])
    for (const u of urls) await expectReadable(u)
  })

  it('3. stem image AND option images together start and every picture is readable', async () => {
    const { qid, vid } = await approvedMcq()
    const stem = await upload()
    const opt = await upload()
    await linkStimulus(vid, await newStimulus('image', { img: stem }))
    await t.db.query(
      `update part_options set image_file_id = $2 where id = (select o.id from part_options o join question_parts p on p.id = o.part_id
                                                             where p.question_version_id = $1 order by o.position limit 1)`,
      [vid, opt.dbId],
    )
    const q = (await view(await publishedPaper(qid))).questions.find((x) => x.id === qid)!
    expect(q.stemImage?.image?.url).toBe(stem.url)
    expect(q.mcq?.options.find((o) => o.image)?.image?.url).toBe(opt.url)
    await expectReadable(stem.url)
    await expectReadable(opt.url)
  })

  it('4. a question whose own stimulus is a diagram, map, graph or infographic picture starts and the pupil reads it', async () => {
    for (const kind of ['diagram', 'map', 'graph', 'infographic']) {
      const { qid, vid } = await approvedMcq()
      const img = await upload()
      await linkStimulus(vid, await newStimulus(kind, { img, label: 'Rajah 1' }))
      const q = (await view(await publishedPaper(qid))).questions.find((x) => x.id === qid)!
      expect(q.stimuli?.map((x) => x.kind), kind).toEqual([kind])
      expect(q.stimuli?.[0]?.image?.url, kind).toBe(img.url)
      expect(q.stemImage?.image?.url, kind).toBe(img.url)
      await expectReadable(img.url)
    }
  })
})

/** R1E2E-05b: V2 serves a question's OWN stimuli inline (cloud-student-mechanism 1.5): any kind, 1..N, in link order. */
describe('R1E2E-05b a question serves its own stimuli', () => {
  const grid = { head: ['Bulan', 'Jumlah'], rows: [['Jan', '10'], ['Feb', '12']] }

  async function ownTable(vid: string): Promise<string> {
    const sid = await newStimulus('table', { label: 'Jadual 1' })
    await t.db.query(`update stimuli set table_data = $2::jsonb, caption = 'Jualan bulanan' where id = $1`, [sid, JSON.stringify(grid)])
    await linkStimulus(vid, sid, 1)
    return sid
  }
  async function submitAndRead(attemptId: string) {
    const sub = await pupil.post(`/api/bijak/attempts/${attemptId}/submit`, { idempotencyKey: `own-${attemptId}`, changes: [] })
    expect(sub.status, JSON.stringify(sub.body)).toBe(200)
    const r = await pupil.get(`/api/bijak/attempts/${attemptId}/result`)
    expect(r.status, JSON.stringify(r.body)).toBe(200)
    return BijakAttemptResultViewSchema.parse(r.body.data)
  }
  async function startOk(paperId: string): Promise<string> {
    const res = await start(paperId)
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return (res.body as { data: { attemptId: string } }).data.attemptId
  }

  it('5. an own text passage (with source line and caption): starts and is on the view and in Semakan', async () => {
    const { qid, vid } = await approvedMcq()
    const sid = await newStimulus('passage', { body: 'Petikan ringkas untuk soalan ini.', label: 'Petikan' })
    await t.db.query(`update stimuli set source_citation = 'Sumber: buku teks', caption = 'Rajah petikan' where id = $1`, [sid])
    await linkStimulus(vid, sid)
    const attemptId = await startOk(await publishedPaper(qid))
    const v = BijakAttemptPaperViewSchema.parse((await pupil.get(`/api/bijak/attempts/${attemptId}`)).body.data)
    const q = v.questions.find((x) => x.id === qid)!
    expect(q.stimuli).toHaveLength(1)
    expect(q.stimuli?.[0]).toMatchObject({ kind: 'passage', label: 'Petikan', text: 'Petikan ringkas untuk soalan ini.', source: 'Sumber: buku teks', caption: 'Rajah petikan' })
    expect(q.stemImage).toBeUndefined()
    expect(v.groups).toEqual([])
    const res = await submitAndRead(attemptId)
    expect(res.paper.questions.find((x) => x.id === qid)?.stimuli?.[0]?.text).toBe('Petikan ringkas untuk soalan ini.')
  })

  it('6. an own table: the grid from the stored table data, with its caption', async () => {
    const { qid, vid } = await approvedMcq()
    await ownTable(vid)
    const attemptId = await startOk(await publishedPaper(qid))
    const v = BijakAttemptPaperViewSchema.parse((await pupil.get(`/api/bijak/attempts/${attemptId}`)).body.data)
    expect(v.questions.find((x) => x.id === qid)?.stimuli?.[0]).toMatchObject({ kind: 'table', label: 'Jadual 1', caption: 'Jualan bulanan', table: grid })
    const res = await submitAndRead(attemptId)
    expect(res.paper.questions.find((x) => x.id === qid)?.stimuli?.[0]?.table).toEqual(grid)
  })

  it('7. two own pictures: both served in link order, both readable by the pupil, in Semakan too', async () => {
    const { qid, vid } = await approvedMcq()
    const a = await upload()
    const b = await upload()
    await linkStimulus(vid, await newStimulus('image', { img: a, label: 'Gambar A' }), 1)
    await linkStimulus(vid, await newStimulus('diagram', { img: b, label: 'Rajah B' }), 2)
    const attemptId = await startOk(await publishedPaper(qid))
    const v = BijakAttemptPaperViewSchema.parse((await pupil.get(`/api/bijak/attempts/${attemptId}`)).body.data)
    const q = v.questions.find((x) => x.id === qid)!
    expect(q.stimuli?.map((x) => [x.kind, x.label, x.image?.url])).toEqual([['image', 'Gambar A', a.url], ['diagram', 'Rajah B', b.url]])
    expect(q.stemImage).toBeUndefined() // two own stimuli: no single-picture slot
    await expectReadable(a.url)
    await expectReadable(b.url)
    const res = await submitAndRead(attemptId)
    expect(res.paper.questions.find((x) => x.id === qid)?.stimuli?.map((x) => x.image?.url)).toEqual([a.url, b.url])
  })

  it('8. mixed: a picture and a passage, in link order (passage first), picture readable', async () => {
    const { qid, vid } = await approvedMcq()
    const img = await upload()
    await linkStimulus(vid, await newStimulus('passage', { body: 'Baca petikan ini.', label: 'Petikan' }), 1)
    await linkStimulus(vid, await newStimulus('infographic', { img, label: 'Infografik' }), 2)
    const attemptId = await startOk(await publishedPaper(qid))
    const v = BijakAttemptPaperViewSchema.parse((await pupil.get(`/api/bijak/attempts/${attemptId}`)).body.data)
    const q = v.questions.find((x) => x.id === qid)!
    expect(q.stimuli?.map((x) => x.kind)).toEqual(['passage', 'infographic'])
    expect(q.stimuli?.find((x) => x.kind === 'infographic')?.image?.url).toBe(img.url)
    await expectReadable(img.url)
    const res = await submitAndRead(attemptId)
    expect(res.paper.questions.find((x) => x.id === qid)?.stimuli?.map((x) => x.kind)).toEqual(['passage', 'infographic'])
  })

  it('9. a stimulus shared by two questions but not set up as a group is still refused with a BM reason (D90)', async () => {
    const a = await approvedMcq()
    const b = await approvedMcq()
    const sid = await newStimulus('passage', { body: 'Petikan dikongsi.', label: 'Petikan kongsi' })
    await linkStimulus(a.vid, sid)
    await linkStimulus(b.vid, sid)
    for (const qid of [a.qid, b.qid]) {
      expect((await start(await publishedPaper(qid))).status).toBe(403)
      const refusal = (await t.app.get(Be09BijakQuestionSource).refusalsOf([qid])).get(qid)
      expect(refusal?.code).toBe('stimulus_shared_ungrouped')
      expect(refusal?.reasonMs).toContain('kumpulan rangsangan')
    }
  })

  it('10. an audio-only own stimulus is not displayable: refused, never dropped', async () => {
    const { qid, vid } = await approvedMcq()
    await linkStimulus(vid, await newStimulus('audio', { label: 'Bunyi' }))
    expect((await start(await publishedPaper(qid))).status).toBe(403)
    expect((await t.app.get(Be09BijakQuestionSource).refusalsOf([qid])).get(qid)?.code).toBe('stimulus_outside_group')
  })
})
