import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsService } from '../../src/modules/questions'
import { ACCOUNTS, bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from '../questions/helpers'
import { tagBody, tagOf, userIdOf, type Tag } from '../questions/fixtures'
import { makePng } from './fixtures'

/**
 * R1-B20: what a pupil may read of a `question_image` file. Allowed: a file on the LIVE version of an active approved/published
 * learner-visible question (option image, stimulus asset, part stimulus, shared-group stimulus), or on the version pinned by a
 * placement of a published paper the pupil can sit, or a reference-sheet image of such a paper. Everything else is 404 (no
 * oracle); anonymous is 401.
 */
describe('question image read rule for pupils (real database)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let admin: Client
  let pupil: Client
  let tag: Tag
  let adminId: string
  let pupilId: string

  beforeAll(async () => {
    process.env.FILE_STORAGE_DIR = await mkdtemp(join(tmpdir(), 'pp-q-access-'))
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    admin = await loginAs(t, 'admin')
    pupil = await loginAs(t, 'student')
    adminId = await userIdOf(t.db, ACCOUNTS.admin)
    pupilId = await userIdOf(t.db, ACCOUNTS.student)
  })
  afterAll(async () => {
    await t.close()
  })

  const one = async (sql: string, params: unknown[] = []) => (await t.db.query<Record<string, string>>(sql, params))[0]!
  const base = () => ({
    subjectId: tag.subjectId,
    educationLevelId: tag.levelId,
    difficultyLevel: 3,
    questionType: 'mcq',
    questionText: 'Berapakah hasil tambah 2 dan 3?',
    options: ['4', '5', '6', '7'],
    correctAnswer: 1,
  })

  interface Img {
    id: string
    url: string
    dbId: string
  }
  async function upload(): Promise<Img> {
    const res = await admin.post('/api/files?purpose=question_image').attach('file', makePng(), { filename: 'r.png', contentType: 'image/png' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const { id, url } = res.body.data as { id: string; url: string }
    return { id, url, dbId: (await one(`select id::text from files where public_id = $1`, [id])).id! }
  }
  /** A published question; returns its id and the id of its live version. */
  async function liveQuestion(): Promise<{ qid: string; vid: string }> {
    const res = await admin.post('/api/questions').send({ ...base(), tag: tagBody(tag, 3), status: 'published' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const qid = res.body.data.id as string
    return { qid, vid: (await one(`select id::text from question_versions where question_id = $1 and version_no = 1`, [qid])).id! }
  }
  const onOption = (vid: string, img: Img) =>
    t.db.query(
      `update part_options set image_file_id = $2 where id = (select o.id from part_options o join question_parts p on p.id = o.part_id
                                                             where p.question_version_id = $1 order by o.position limit 1)`,
      [vid, img.dbId],
    )
  const newStimulus = async (img: Img): Promise<string> =>
    (await one(`insert into stimuli (kind, asset_file_id) values ('image', $1) returning id::text`, [img.dbId])).id!
  const linkStimulus = (vid: string, sid: string) =>
    t.db.query(`insert into question_version_stimuli (question_version_id, stimulus_id, position) values ($1, $2, 1)`, [vid, sid])
  async function publishedPaper(): Promise<{ paper: string; section: string }> {
    const paper = (await one(
      `insert into papers (kind, title, subject_id, kertas, printed_duration_min, status)
       values ('pilihan', 'Terbit', $1, 1, 60, 'published') returning id::text`,
      [tag.subjectId],
    )).id!
    const section = (await one(
      `insert into paper_sections (paper_id, position, label, question_count, mark_budget) values ($1, 1, 'A', 1, 1) returning id::text`,
      [paper],
    )).id!
    return { paper, section }
  }
  const place = (section: string, qid: string, pinned = 1) =>
    t.db.query(`insert into paper_placements (paper_section_id, question_id, position, pinned_version_no) values ($1, $2, 1, $3)`, [section, qid, pinned])
  const status = async (c: Client, img: Img) => (await c.get(img.url)).status

  it('allows option, stem/stimulus, part-stimulus and shared-group images of a live approved question; staff always; anonymous is 401', async () => {
    const { qid, vid } = await liveQuestion()
    const opt = await upload()
    const stem = await upload()
    const partImg = await upload()
    const groupImg = await upload()
    await onOption(vid, opt)
    await linkStimulus(vid, await newStimulus(stem))
    await t.db.query(`update question_parts set stimulus_id = $2 where question_version_id = $1`, [vid, await newStimulus(partImg)])
    const gid = (await one(`insert into stimulus_groups (label) values ('Rajah 1') returning id::text`)).id!
    await t.db.query(`insert into stimulus_group_stimuli (group_id, stimulus_id, position) values ($1, $2, 1)`, [gid, await newStimulus(groupImg)])
    await t.db.query(`update questions set group_id = $2, group_position = 1 where id = $1`, [qid, gid])
    for (const img of [opt, stem, partImg, groupImg]) {
      expect(await status(pupil, img)).toBe(200)
      expect(await status(admin, img)).toBe(200)
      expect((await t.http().get(img.url)).status).toBe(401)
    }
  })

  it('accepts the future `approved` status as servable as well as the current `published`', async () => {
    const { vid } = await liveQuestion()
    const img = await upload()
    await onOption(vid, img)
    expect(await status(pupil, img)).toBe(200)
    await t.db.query(`update question_versions set status = 'approved' where id = $1`, [vid])
    expect(await status(pupil, img)).toBe(200)
    await t.db.query(`update question_versions set status = 'review' where id = $1`, [vid])
    expect(await status(pupil, img)).toBe(404)
    await t.db.query(`update question_versions set status = 'published' where id = $1`, [vid])
  })

  it('denies a draft, an archived question, an inactive question, an unattached file and an image of another question in a paper', async () => {
    const draft = await admin.post('/api/questions').send({ ...base() })
    const dvid = (await one(`select id::text from question_versions where question_id = $1`, [draft.body.data.id])).id!
    const dImg = await upload()
    await onOption(dvid, dImg)
    expect(await status(pupil, dImg)).toBe(404)

    const { qid, vid } = await liveQuestion()
    const img = await upload()
    await onOption(vid, img)
    expect(await status(pupil, img)).toBe(200)
    await t.db.query(`update questions set is_active = false where id = $1`, [qid])
    expect(await status(pupil, img)).toBe(404)
    await t.db.query(`update questions set is_active = true where id = $1`, [qid])
    await svc.setStatus(qid, 'archived', adminId)
    expect(await status(pupil, img)).toBe(404)

    const loose = await upload()
    expect(await status(pupil, loose)).toBe(404)
    expect(await status(admin, loose)).toBe(200)
  })

  it('denies an old version, a hidden level and a PKSK question; the 404 is identical to a non-existing token', async () => {
    const { qid, vid } = await liveQuestion()
    const img = await upload()
    await onOption(vid, img)
    // Old version: version 2 goes live, version 1 (and its image) is archived.
    const v2 = await upload()
    expect((await admin.put(`/api/questions/${qid}`).send({ ...base(), questionImageFileId: v2.id })).status).toBe(200)
    // Version 2 was cloned from version 1 including its option image: drop it so the old image sits on version 1 only.
    await t.db.query(
      `update part_options set image_file_id = null where part_id in (select p.id from question_parts p
         join question_versions v on v.id = p.question_version_id where v.question_id = $1 and v.version_no = 2)`,
      [qid],
    )
    for (const s of ['review', 'approved', 'published'] as const) await svc.setStatus(qid, s, adminId)
    expect(await status(pupil, img)).toBe(404)
    expect(await status(pupil, v2)).toBe(200)

    await t.db.query(`update education_levels set is_active = false where id = $1`, [tag.levelId])
    expect(await status(pupil, v2)).toBe(404)
    await t.db.query(`update education_levels set is_active = true where id = $1`, [tag.levelId])
    await t.db.query(`insert into question_tags (question_id, kind, code) values ($1, 'pksk_domain', 'ZZ')`, [qid])
    expect(await status(pupil, v2)).toBe(404)
    await t.db.query(`delete from question_tags where question_id = $1 and kind = 'pksk_domain'`, [qid])
    expect(await status(pupil, v2)).toBe(200)

    const ghost = await pupil.get('/api/files/AAAAAAAAAAAAAAAAAAAAAA')
    const denied = await pupil.get(img.url)
    expect(denied.status).toBe(ghost.status)
    expect(denied.body.error.code).toBe(ghost.body.error.code)
    expect(denied.body.error.message).toBe(ghost.body.error.message)
  })

  it('a published paper serves the PINNED version image even when the question is archived or the old version superseded', async () => {
    const { qid, vid } = await liveQuestion()
    const img = await upload()
    await onOption(vid, img)
    const { section } = await publishedPaper()
    await place(section, qid, 1)
    // Supersede version 1 (archived) and withdraw the question: the published paper still pins version 1.
    await svc.setStatus(qid, 'archived', adminId)
    expect(await status(pupil, img)).toBe(200)
    expect((await t.http().get(img.url)).status).toBe(401)
  })

  it('a paper does not open images of other versions or other questions; unpublished and foreign per-pupil papers open nothing', async () => {
    const a = await liveQuestion()
    const b = await liveQuestion()
    const imgA = await upload()
    const imgB = await upload()
    await onOption(a.vid, imgA)
    await onOption(b.vid, imgB)
    await svc.setStatus(a.qid, 'archived', adminId)
    await svc.setStatus(b.qid, 'archived', adminId)
    expect(await status(pupil, imgA)).toBe(404)

    // Only question A sits in a published paper: B stays denied; a placement pinning version 2 does not open version 1.
    const pub = await publishedPaper()
    await place(pub.section, a.qid, 1)
    expect(await status(pupil, imgA)).toBe(200)
    expect(await status(pupil, imgB)).toBe(404)
    await t.db.query(`update paper_placements set pinned_version_no = 2 where paper_section_id = $1`, [pub.section])
    expect(await status(pupil, imgA)).toBe(404)

    // Draft / ready / withdrawn papers open nothing.
    for (const st of ['draft', 'ready', 'withdrawn']) {
      await t.db.query(`update paper_placements set pinned_version_no = 1 where paper_section_id = $1`, [pub.section])
      await t.db.query(`update papers set status = $2 where id = $1`, [pub.paper, st])
      expect(await status(pupil, imgA), st).toBe(404)
    }
    await t.db.query(`update papers set status = 'published' where id = $1`, [pub.paper])
    expect(await status(pupil, imgA)).toBe(200)

    // A per-pupil `jana` paper opens the image for its pupil only.
    await t.db.query(`delete from paper_placements where paper_section_id = $1`, [pub.section])
    await t.db.query(`update papers set kind = 'jana', generated_for_user_id = $2 where id = $1`, [pub.paper, pupilId])
    await place(pub.section, a.qid, 1)
    expect(await status(pupil, imgA)).toBe(200)
    await t.db.query(`update papers set generated_for_user_id = $2 where id = $1`, [pub.paper, await userIdOf(t.db, ACCOUNTS.teacher)])
    expect(await status(pupil, imgA)).toBe(404)
  })

  it('a paper pinning a draft version does not leak it', async () => {
    const { qid } = await liveQuestion()
    const img = await upload()
    expect((await admin.put(`/api/questions/${qid}`).send({ ...base(), questionImageFileId: img.id })).status).toBe(200) // v2 draft
    const { section } = await publishedPaper()
    await place(section, qid, 2)
    expect(await status(pupil, img)).toBe(404)
  })

  it('a reference-sheet image of a published paper is readable by token or decimal id; an unpublished paper keeps it private', async () => {
    const byToken = await upload()
    const byId = await upload()
    const { paper } = await publishedPaper()
    await t.db.query(`update papers set reference_sheets = $2::jsonb where id = $1`, [
      paper,
      JSON.stringify([{ title: 'Rumus', items: ['a'], imageFileId: byToken.id }, { title: 'Jadual', items: [], imageFileId: byId.dbId }]),
    ])
    expect(await status(pupil, byToken)).toBe(200)
    expect(await status(pupil, byId)).toBe(200)
    await t.db.query(`update papers set status = 'draft' where id = $1`, [paper])
    expect(await status(pupil, byToken)).toBe(404)
    expect(await status(pupil, byId)).toBe(404)
  })
})
