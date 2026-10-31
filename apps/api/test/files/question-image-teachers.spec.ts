import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsService } from '../../src/modules/questions'
import { ACCOUNTS, bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from '../questions/helpers'
import { tagBody, tagOf, userIdOf, type Tag } from '../questions/fixtures'
import { makePng } from './fixtures'
import { teacherTwo } from './teacher-two'

/**
 * REQ-B-008 (B3): who may read a `question_image` file. Admin reads all. A TEACHER reads the files they uploaded and the images of
 * questions they AUTHORED (their drafts included), and, like everyone signed in, a file served with a published question. A teacher
 * never reads another author's draft image or a per-pupil Jana image. A refused read is 404 (no oracle); anonymous is 401.
 */
describe('question images: teacher A / teacher B / admin / pupil matrix (real database)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let admin: Client
  let teacherA: Client
  let teacherB: Client
  let pupil: Client
  let tag: Tag
  let adminId: string
  let aId: string
  let pupilId: string

  beforeAll(async () => {
    process.env.FILE_STORAGE_DIR = await mkdtemp(join(tmpdir(), 'pp-q-teachers-'))
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    admin = await loginAs(t, 'admin')
    teacherA = await loginAs(t, 'teacher')
    teacherB = await teacherTwo(t) // acting as a teacher (loginAs starts this account as school_admin)
    pupil = await loginAs(t, 'student')
    adminId = await userIdOf(t.db, ACCOUNTS.admin)
    aId = await userIdOf(t.db, ACCOUNTS.teacher)
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
  async function upload(by: Client): Promise<Img> {
    const res = await by.post('/api/files?purpose=question_image').attach('file', makePng(), { filename: 'r.png', contentType: 'image/png' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const { id, url } = res.body.data as { id: string; url: string }
    return { id, url, dbId: (await one(`select id::text from files where public_id = $1`, [id])).id! }
  }
  /** A draft question authored by `authorId`, role `role`; returns its id and version id. */
  async function draft(authorId: string, role: 'admin' | 'teacher'): Promise<{ qid: string; vid: string }> {
    const created = await svc.create(
      { subjectId: tag.subjectId, educationLevelId: tag.levelId, difficultyLevel: 3, questionType: 'mcq', questionText: 'Soalan draf untuk matriks imej guru.', options: ['4', '5', '6', '7'], correctAnswer: 1, tag: tagBody(tag, 3) } as never,
      { userId: authorId, role },
    )
    return { qid: created.id, vid: (await one(`select id::text from question_versions where question_id = $1 and version_no = 1`, [created.id])).id! }
  }
  const onOption = (vid: string, img: Img) =>
    t.db.query(
      `update part_options set image_file_id = $2 where id = (select o.id from part_options o join question_parts p on p.id = o.part_id where p.question_version_id = $1 order by o.position limit 1)`,
      [vid, img.dbId],
    )
  const status = async (c: Client, img: Img) => (await c.get(img.url)).status

  it('the file a teacher uploaded is theirs, even before it is attached; another teacher gets 404, admin 200', async () => {
    const mine = await upload(teacherA)
    expect(await status(teacherA, mine)).toBe(200)
    expect(await status(teacherB, mine)).toBe(404)
    expect(await status(admin, mine)).toBe(200)
    expect(await status(pupil, mine)).toBe(404)
    expect((await t.http().get(mine.url)).status).toBe(401)
  })

  it('an image on a draft the teacher authored is readable by that teacher (the edit form), not by another teacher or a pupil', async () => {
    const { vid } = await draft(aId, 'teacher')
    const img = await upload(admin) // uploaded by the admin, attached to A's question
    await onOption(vid, img)
    expect(await status(teacherA, img)).toBe(200)
    expect(await status(admin, img)).toBe(200)
    expect(await status(teacherB, img)).toBe(404)
    expect(await status(pupil, img)).toBe(404)
  })

  it('an image on another author\'s draft (an admin\'s) is 404 for both teachers', async () => {
    const { vid } = await draft(adminId, 'admin')
    const img = await upload(admin)
    await onOption(vid, img)
    expect(await status(admin, img)).toBe(200)
    expect(await status(teacherA, img)).toBe(404)
    expect(await status(teacherB, img)).toBe(404)
  })

  it('once the question is published (served), every signed-in user reads its image, teachers included; archived again it closes', async () => {
    const { qid, vid } = await draft(adminId, 'admin')
    const img = await upload(admin)
    await onOption(vid, img)
    await t.db.query(`update question_versions set status = 'approved', published_at = now() where question_id = $1`, [qid])
    await t.db.query(`update questions set live_version_no = 1 where id = $1`, [qid])
    for (const [name, c] of Object.entries({ teacherA, teacherB, pupil, admin })) expect(await status(c, img), name).toBe(200)
    await t.db.query(`update questions set live_version_no = null, is_active = true where id = $1`, [qid])
    await t.db.query(`update question_versions set status = 'archived' where question_id = $1`, [qid])
    expect(await status(teacherA, img)).toBe(404)
    expect(await status(teacherB, img)).toBe(404)
    expect(await status(admin, img)).toBe(200)
  })

  it('a per-pupil Jana paper image is the pupil\'s alone: teachers get 404, the pupil it was made for gets 200', async () => {
    const { qid, vid } = await draft(adminId, 'admin')
    const img = await upload(admin)
    await onOption(vid, img)
    await t.db.query(`update question_versions set status = 'archived', published_at = now() where question_id = $1`, [qid]) // pinned version of a paper, no longer live
    const paper = (await one(
      `insert into papers (kind, title, subject_id, kertas, printed_duration_min, status, generated_for_user_id) values ('jana', 'Jana', $1, 1, 60, 'published', $2) returning id::text`,
      [tag.subjectId, pupilId],
    )).id!
    const section = (await one(`insert into paper_sections (paper_id, position, label, question_count, mark_budget) values ($1, 1, 'A', 1, 1) returning id::text`, [paper])).id!
    await t.db.query(`insert into paper_placements (paper_section_id, question_id, position, pinned_version_no) values ($1, $2, 1, 1)`, [section, qid])
    expect(await status(pupil, img)).toBe(200)
    expect(await status(teacherA, img)).toBe(404)
    expect(await status(teacherB, img)).toBe(404)
    expect(await status(admin, img)).toBe(200)
  })
})
