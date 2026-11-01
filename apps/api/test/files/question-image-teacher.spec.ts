import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ACCOUNTS, bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from '../questions/helpers'
import { tagBody, tagOf, userIdOf, type Tag } from '../questions/fixtures'
import { makePng } from './fixtures'
import { teacherTwo } from './teacher-two'

/**
 * REQ-B-008: who may read a `question_image` file. Admin reads all (unchanged). A TEACHER reads the files they uploaded and the
 * images of questions they created, plus what is served; NOT another author's draft and NOT a Jana-only image (an image only a
 * per-pupil generated paper pins). A pupil reads served images only (unchanged); anonymous is 401. A refused read is a uniform 404.
 */
describe('question image read rule for teachers (REQ-B-008, real database)', () => {
  let t: QuestionsTestApp
  let admin: Client
  let teacherA: Client
  let teacherB: Client
  let pupil: Client
  let tag: Tag
  let teacherAId: string
  let teacherBId: string
  let pupilId: string

  beforeAll(async () => {
    process.env.FILE_STORAGE_DIR = await mkdtemp(join(tmpdir(), 'pp-q-teacher-'))
    t = await bootQuestionsApp()
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    admin = await loginAs(t, 'admin')
    teacherA = await loginAs(t, 'teacher')
    teacherB = await teacherTwo(t)
    pupil = await loginAs(t, 'student')
    teacherAId = await userIdOf(t.db, ACCOUNTS.teacher)
    teacherBId = await userIdOf(t.db, ACCOUNTS.teacher2)
    pupilId = await userIdOf(t.db, ACCOUNTS.student)
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
  /** A question_image file uploaded by `as`. */
  async function upload(as: Client = admin): Promise<Img> {
    const res = await as.post('/api/files?purpose=question_image').attach('file', makePng(), { filename: 'r.png', contentType: 'image/png' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const { id, url } = res.body.data as { id: string; url: string }
    return { id, url, dbId: (await one(`select id::text from files where public_id = $1`, [id])).id! }
  }
  /** A question (admin API) authored by `author` (the row's created_by_id), with the image on an option of its version 1. */
  async function question(author: string, status: 'draft' | 'approved', img: Img): Promise<{ qid: string; vid: string }> {
    const res = await admin.post('/api/questions').send({
      subjectId: tag.subjectId,
      educationLevelId: tag.levelId,
      difficultyLevel: 3,
      questionType: 'mcq',
      questionText: 'Berapakah hasil tambah 2 dan 3?',
      options: ['4', '5', '6', '7'],
      correctAnswer: 1,
      ...(status === 'approved' ? { tag: tagBody(tag, 3), status: 'approved' } : {}),
    })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const qid = res.body.data.id as string
    await t.db.query(`update questions set created_by_id = $2 where id = $1`, [qid, author])
    const vid = (await one(`select id::text from question_versions where question_id = $1 and version_no = 1`, [qid])).id!
    await t.db.query(
      `update part_options set image_file_id = $2 where id = (select o.id from part_options o join question_parts p on p.id = o.part_id
                                                             where p.question_version_id = $1 order by o.position limit 1)`,
      [vid, img.dbId],
    )
    return { qid, vid }
  }
  const status = async (c: Client | null, img: Img) => (await (c ?? { get: (u: string) => t.http().get(u) }).get(img.url)).status

  it('teacher A / teacher B / admin / pupil / anonymous x own draft, other author draft, served and Jana-only images', async () => {
    // own draft of teacher A: the file is uploaded by the admin (intake-like), so only AUTHORSHIP can open it for A
    const ownDraft = await upload(admin)
    await question(teacherAId, 'draft', ownDraft)
    // another author's draft: authored by teacher B (file uploaded by the admin)
    const otherDraft = await upload(admin)
    await question(teacherBId, 'draft', otherDraft)
    // a draft authored by the admin
    const adminDraft = await upload(admin)
    await question(await userIdOf(t.db, ACCOUNTS.admin), 'draft', adminDraft)
    // served: a live approved question of the admin
    const served = await upload(admin)
    await question(await userIdOf(t.db, ACCOUNTS.admin), 'approved', served)
    // Jana-only: the image sits on version 1 of an ARCHIVED question that only a published per-pupil Jana paper pins
    const jana = await upload(admin)
    const jq = await question(await userIdOf(t.db, ACCOUNTS.admin), 'approved', jana)
    await t.db.query(`update question_versions set status = 'archived' where id = $1`, [jq.vid])
    await t.db.query(`update questions set live_version_no = null where id = $1`, [jq.qid])
    const paper = (
      await one(
        `insert into papers (kind, title, subject_id, kertas, printed_duration_min, status, generated_for_user_id)
         values ('jana', 'Jana pelajar', $1, 1, 60, 'published', $2) returning id::text`,
        [tag.subjectId, pupilId],
      )
    ).id!
    const section = (await one(`insert into paper_sections (paper_id, position, label, question_count, mark_budget) values ($1, 1, 'A', 1, 1) returning id::text`, [paper])).id!
    await t.db.query(`insert into paper_placements (paper_section_id, question_id, position, pinned_version_no) values ($1, $2, 1, 1)`, [section, jq.qid])

    // [admin, teacher A, teacher B, pupil, anonymous]
    const row = async (img: Img) => [await status(admin, img), await status(teacherA, img), await status(teacherB, img), await status(pupil, img), await status(null, img)]
    expect(await row(ownDraft)).toEqual([200, 200, 404, 404, 401])
    expect(await row(otherDraft)).toEqual([200, 404, 200, 404, 401])
    expect(await row(adminDraft)).toEqual([200, 404, 404, 404, 401])
    expect(await row(served)).toEqual([200, 200, 200, 200, 401])
    expect(await row(jana)).toEqual([200, 404, 404, 200, 401])
  })

  it('a teacher reads a file they uploaded even before it is attached; another teacher does not', async () => {
    const mine = await upload(teacherA)
    expect([await status(teacherA, mine), await status(teacherB, mine), await status(pupil, mine), await status(admin, mine)]).toEqual([200, 404, 404, 200])
  })

  it('a refused teacher read is the same 404 as a token that does not exist (no oracle)', async () => {
    const img = await upload(admin)
    await question(teacherBId, 'draft', img)
    const denied = await teacherA.get(img.url)
    const ghost = await teacherA.get('/api/files/AAAAAAAAAAAAAAAAAAAAAA')
    expect(denied.status).toBe(404)
    expect(denied.body.error).toEqual({ ...ghost.body.error, requestId: denied.body.error.requestId })
  })

  it('authorship follows the question, not the version: a teacher keeps reading their question after it is archived, and loses nothing to others', async () => {
    const img = await upload(admin)
    const q = await question(teacherAId, 'draft', img)
    await t.db.query(`update question_versions set status = 'archived' where question_id = $1`, [q.qid])
    expect(await status(teacherA, img)).toBe(200)
    expect(await status(teacherB, img)).toBe(404)
  })
})
