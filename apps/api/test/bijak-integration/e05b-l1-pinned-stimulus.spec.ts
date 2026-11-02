/**
 * R1E2E-05b (B3 Low, E05B-L1): a question's OWN passage stimulus (not a group) whose version is later archived but stays pinned on a
 * published paper. A pupil's sitting reads it, so `PUT /api/stimuli/:id` must be refused with 409 (served lock) and the attempt view
 * keeps the original text. Real database, real `BijakIntegrationModule` wiring.
 */
import { BijakAttemptPaperViewSchema, SessionSchema } from '@pp/contract'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

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

/** An approved (Terbit) T4 MCQ, no group; returns its id and live version id. */
async function approvedBankMcq(): Promise<{ qid: string; vid: string }> {
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
const insertOwnStimulus = async (kind: string, extra: { body?: string; label?: string } = {}): Promise<string> =>
  (
    await one(`insert into stimuli (kind, asset_file_id, body_ms, label) values ($1, $2, $3, $4) returning id::text`, [
      kind,
      null,
      extra.body ?? null,
      extra.label ?? null,
    ])
  ).id!
const linkToVersion = (vid: string, sid: string, position = 1) =>
  t.db.query(`insert into question_version_stimuli (question_version_id, stimulus_id, position) values ($1, $2, $3)`, [vid, sid, position])

/** A Terbit pilihan paper that places the question pinned to version 1 (its live version), as the builder publishes it. */
async function paperPinningLiveVersion(qid: string): Promise<string> {
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

describe('E05B-L1 the served lock of a question\'s OWN stimulus after its version is archived', () => {
  it('pinned on a published paper with a sitting open: PUT /api/stimuli/:id is refused with 409 and the pupil still reads the original text', async () => {
    const { qid, vid } = await approvedBankMcq()
    const sid = await insertOwnStimulus('passage', { body: 'Petikan asal untuk soalan ini.', label: 'Petikan' })
    await linkToVersion(vid, sid)
    const paperId = await paperPinningLiveVersion(qid)

    const started = await pupil.post('/api/bijak/attempts', { paperId, mode: 'exam' })
    expect(started.status, JSON.stringify(started.body)).toBe(201)
    const attemptId = (started.body as { data: { attemptId: string } }).data.attemptId

    // the question is archived; its version stays pinned on the published paper
    const arch = await admin.post('/api/questions/bulk-action').set('X-CSRF-Token', adminCsrf).send({ action: 'archived', ids: [qid] })
    expect(arch.status, JSON.stringify(arch.body)).toBe(200)
    expect(arch.body.data.affected).toBe(1)
    expect((await one(`select v.status from question_versions v where v.question_id = $1 and v.version_no = 1`, [qid])).status).toBe('archived')

    const put = await admin.put(`/api/stimuli/${sid}`).set('X-CSRF-Token', adminCsrf).send({ body: { ms: 'Teks yang diubah.' } })
    expect(put.status, JSON.stringify(put.body)).toBe(409)
    expect((await one(`select body_ms from stimuli where id = $1`, [sid])).body_ms).toBe('Petikan asal untuk soalan ini.')

    const v = BijakAttemptPaperViewSchema.parse((await pupil.get(`/api/bijak/attempts/${attemptId}`)).body.data)
    expect(v.questions.find((x) => x.id === qid)?.stimuli?.[0]).toMatchObject({ kind: 'passage', text: 'Petikan asal untuk soalan ini.' })
  })

  // The served lock of an own stimulus (stimulus.repository `stimulusServed` -> served-rule `VERSION_SERVED` / `paperHeld`) is held by a PIN: a paper
  // placement that pins the archived version, on a paper that is still held. A published paper is held by itself; a withdrawn paper only while
  // sittings exist. The positive test above has pin + published paper + sitting together; the controls below take them apart.
  const archive = async (qid: string): Promise<void> => {
    const arch = await admin.post('/api/questions/bulk-action').set('X-CSRF-Token', adminCsrf).send({ action: 'archived', ids: [qid] })
    expect(arch.status, JSON.stringify(arch.body)).toBe(200)
    expect(arch.body.data.affected).toBe(1)
  }
  const editStimulus = (sid: string, ms: string) => admin.put(`/api/stimuli/${sid}`).set('X-CSRF-Token', adminCsrf).send({ body: { ms } })
  const bodyOf = async (sid: string): Promise<string> => (await one(`select body_ms from stimuli where id = $1`, [sid])).body_ms!
  /** An approved question with an own passage stimulus, not yet on any paper. */
  async function questionWithStimulus(body: string): Promise<{ qid: string; sid: string }> {
    const { qid, vid } = await approvedBankMcq()
    const sid = await insertOwnStimulus('passage', { body, label: 'Petikan' })
    await linkToVersion(vid, sid)
    return { qid, sid }
  }
  const startSitting = async (paperId: string): Promise<void> => {
    const started = await pupil.post('/api/bijak/attempts', { paperId, mode: 'exam' })
    expect(started.status, JSON.stringify(started.body)).toBe(201)
  }

  it('negative control (a): a sitting WITHOUT the pin does not lock: the published paper with an open sitting does not place this question, so the edit is 200', async () => {
    const { qid, sid } = await questionWithStimulus('Petikan tanpa pin.')
    const other = await approvedBankMcq() // the published paper places THIS question instead; pupils sit it
    await startSitting(await paperPinningLiveVersion(other.qid))
    await archive(qid)
    const put = await editStimulus(sid, 'Teks diubah.')
    expect(put.status, JSON.stringify(put.body)).toBe(200)
    expect(await bodyOf(sid)).toBe('Teks diubah.')
  })

  it('negative control (b): the pin WITHOUT a sitting still locks while the paper is published: the sitting is not a guard on its own there, the edit is 409', async () => {
    const { qid, sid } = await questionWithStimulus('Petikan dengan pin sahaja.')
    await paperPinningLiveVersion(qid) // published, pins version 1, nobody has started it
    await archive(qid)
    const put = await editStimulus(sid, 'Teks yang diubah.')
    expect(put.status, JSON.stringify(put.body)).toBe(409)
    expect(await bodyOf(sid)).toBe('Petikan dengan pin sahaja.')
  })

  it('the sitting is a guard where the paper is withdrawn: the pin keeps the stimulus locked only while a sitting exists (409), and not without one (200)', async () => {
    const withdraw = (paperId: string) => t.db.prisma.paper.update({ where: { id: BigInt(paperId) }, data: { status: 'withdrawn' } })
    // withdrawn + pin + sitting: still held (the pupil keeps reading the pinned version)
    const sat = await questionWithStimulus('Petikan kertas ditarik balik, ada sesi.')
    const satPaper = await paperPinningLiveVersion(sat.qid)
    await startSitting(satPaper)
    await withdraw(satPaper)
    await archive(sat.qid)
    const locked = await editStimulus(sat.sid, 'Teks diubah.')
    expect(locked.status, JSON.stringify(locked.body)).toBe(409)
    expect(await bodyOf(sat.sid)).toBe('Petikan kertas ditarik balik, ada sesi.')
    // withdrawn + pin, no sitting: nothing holds the version any more
    const empty = await questionWithStimulus('Petikan kertas ditarik balik, tiada sesi.')
    await withdraw(await paperPinningLiveVersion(empty.qid))
    await archive(empty.qid)
    const free = await editStimulus(empty.sid, 'Teks diubah.')
    expect(free.status, JSON.stringify(free.body)).toBe(200)
    expect(await bodyOf(empty.sid)).toBe('Teks diubah.')
  })

  it('negative control (c): neither pin nor sitting (the archived own stimulus on NO published paper) is not locked, the edit is 200', async () => {
    const { qid, vid } = await approvedBankMcq()
    const sid = await insertOwnStimulus('passage', { body: 'Petikan tanpa kertas.', label: 'Petikan' })
    await linkToVersion(vid, sid)
    await archive(qid)
    const put = await editStimulus(sid, 'Teks diubah.')
    expect(put.status, JSON.stringify(put.body)).toBe(200)
    expect(await bodyOf(sid)).toBe('Teks diubah.')
  })
})
