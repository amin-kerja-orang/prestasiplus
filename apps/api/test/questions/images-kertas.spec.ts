import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsService } from '../../src/modules/questions'
import { paperCodeWithKertas } from '../../src/modules/questions/projection'
import { kertasOfSourcePaper } from '../../src/modules/intake/workflow/review.service'
import { makePng } from '../files/fixtures'
import { ACCOUNTS, bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { adminActor, mcqInput, tagBody, tagOf, userIdOf, type Tag } from './fixtures'

/**
 * Question images as ids of uploaded files (decision 2026-10-29): stem image = image stimulus, option images on the
 * options, the token `POST /files` returns is accepted, ownership is checked only for NEW files, and a pupil reads a
 * question image only while it belongs to a published live question. Kertas = trailing digit of `paper_code`.
 */
describe('question images and kertas (real database)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let admin: Client
  let guru: Client
  let pupil: Client
  let tag: Tag

  beforeAll(async () => {
    process.env.FILE_STORAGE_DIR = await mkdtemp(join(tmpdir(), 'pp-q-images-'))
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    admin = await loginAs(t, 'admin')
    guru = await loginAs(t, 'teacher')
    pupil = await loginAs(t, 'student')
  })
  afterAll(async () => {
    await t.close()
  })

  const base = () => ({
    subjectId: tag.subjectId,
    educationLevelId: tag.levelId,
    difficultyLevel: 3,
    questionType: 'mcq',
    questionText: 'Berapakah hasil tambah 2 dan 3?',
    options: ['4', '5', '6', '7'],
    correctAnswer: 1,
  })

  async function uploadAs(who: Client): Promise<{ id: string; url: string }> {
    const res = await who.post('/api/files?purpose=question_image').attach('file', makePng(), { filename: 'rajah.png', contentType: 'image/png' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data as { id: string; url: string }
  }
  const one = async (sql: string, params: unknown[] = []) => (await t.db.query<Record<string, string | null>>(sql, params))[0]

  it('creates with the upload tokens: option image on the option, stem image as an image stimulus; the response echoes tokens', async () => {
    const stem = await uploadAs(admin)
    const opt = await uploadAs(admin)
    const res = await admin.post('/api/questions').send({ ...base(), questionImageFileId: stem.id, optionImageFileIds: [opt.id, null, null, null] })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.data.questionImage).toBe(stem.id)
    expect(res.body.data.optionImages).toEqual([opt.id, null, null, null])
    const qid = res.body.data.id as string
    const row = await one(
      `select s.kind, f.public_id from question_versions v join question_version_stimuli vs on vs.question_version_id = v.id
         join stimuli s on s.id = vs.stimulus_id join files f on f.id = s.asset_file_id where v.question_id = $1`,
      [qid],
    )
    expect(row).toMatchObject({ kind: 'image', public_id: stem.id })
    const read = await admin.get(`/api/questions/${qid}`)
    expect(read.body.data.questionImage).toBe(stem.id)
    expect(read.body.data.optionImages[0]).toBe(opt.id)
  })

  it('replaces and removes the stem image on update; an omitted field keeps it', async () => {
    const a = await uploadAs(admin)
    const b = await uploadAs(admin)
    const created = await admin.post('/api/questions').send({ ...base(), questionImageFileId: a.id })
    const qid = created.body.data.id as string
    const keep = await admin.put(`/api/questions/${qid}`).send({ ...base(), questionText: 'Teks baharu yang cukup panjang.' })
    expect(keep.status, JSON.stringify(keep.body)).toBe(200)
    expect(keep.body.data.questionImage).toBe(a.id)
    const swap = await admin.put(`/api/questions/${qid}`).send({ ...base(), questionImageFileId: b.id })
    expect(swap.body.data.questionImage).toBe(b.id)
    const gone = await admin.put(`/api/questions/${qid}`).send({ ...base(), removeQuestionImage: true })
    expect(gone.body.data.questionImage).toBeNull()
    const again = await admin.put(`/api/questions/${qid}`).send({ ...base(), questionImageFileId: b.id })
    expect(again.body.data.questionImage).toBe(b.id)
    const nulled = await admin.put(`/api/questions/${qid}`).send({ ...base(), questionImageFileId: null })
    expect(nulled.body.data.questionImage).toBeNull()
  })

  it('option images: replace by id, remove with removeOptionImage, keep when omitted', async () => {
    const a = await uploadAs(admin)
    const b = await uploadAs(admin)
    const qid = (await admin.post('/api/questions').send({ ...base(), optionImageFileIds: [a.id, null, b.id, null] })).body.data.id as string
    const keep = await admin.put(`/api/questions/${qid}`).send({ ...base() })
    expect(keep.body.data.optionImages).toEqual([a.id, null, b.id, null])
    const swap = await admin.put(`/api/questions/${qid}`).send({ ...base(), optionImageFileIds: [b.id], removeOptionImage: [false, false, true] })
    expect(swap.body.data.optionImages).toEqual([b.id, null, null, null])
  })

  it('a bad image id is 422 under questionImage / optionImages.<i>; a Guru cannot attach an admin new file', async () => {
    const adminFile = await uploadAs(admin)
    const bad = await guru.post('/api/guru/questions').send({ ...base(), questionImageFileId: adminFile.id })
    expect(bad.status).toBe(422)
    expect(Object.keys(bad.body.error.fields)).toEqual(['questionImage'])
    const missing = await guru.post('/api/guru/questions').send({ ...base(), questionImageFileId: 'AAAAAAAAAAAAAAAAAAAAAA' })
    expect(missing.body.error.fields).toEqual(bad.body.error.fields) // no existence oracle
    const optBad = await admin.post('/api/questions').send({ ...base(), optionImageFileIds: [null, 'AAAAAAAAAAAAAAAAAAAAAA'] })
    expect(optBad.status).toBe(422)
    expect(Object.keys(optBad.body.error.fields)).toEqual(['optionImages.1'])
  })

  it('a Guru can edit an admin-made question that already has images (ownership only on new ids)', async () => {
    const adminFile = await uploadAs(admin)
    const adminOpt = await uploadAs(admin)
    const guruId = await userIdOf(t.db, ACCOUNTS.teacher)
    const made = await svc.create(
      mcqInput(tag, { questionImageFileId: adminFile.id, optionImageFileIds: [adminOpt.id, null, null, null] } as never),
      { userId: guruId, role: 'admin' },
    )
    expect(made.version.stemImageId).not.toBeNull()
    await t.db.query(`update questions set created_by_id = $1 where id = $2`, [guruId, made.id])
    const edited = await guru.put(`/api/guru/questions/${made.id}`).send({ questionText: 'Teks guru selepas suntingan yang panjang.' })
    expect(edited.status, JSON.stringify(edited.body)).toBe(200)
    const check = await admin.get(`/api/questions/${made.id}`)
    expect(check.body.data.questionImage).toBe(adminFile.id)
    expect(check.body.data.optionImages[0]).toBe(adminOpt.id)
    // A new admin file is still refused for the Guru.
    const fresh = await uploadAs(admin)
    const refused = await guru.put(`/api/guru/questions/${made.id}`).send({ questionText: 'Teks guru sekali lagi yang panjang.', questionImageFileId: fresh.id })
    expect(refused.status).toBe(422)
  })

  it('a pupil reads a question image only while it belongs to a published live question', async () => {
    const draftFile = await uploadAs(admin)
    const liveFile = await uploadAs(admin)
    const draft = await admin.post('/api/questions').send({ ...base(), questionImageFileId: draftFile.id })
    expect(draft.status).toBe(201)
    const live = await admin.post('/api/questions').send({ ...base(), questionImageFileId: liveFile.id, optionImageFileIds: [null, null, null, null], tag: tagBody(tag, 3), status: 'approved' })
    expect(live.status, JSON.stringify(live.body)).toBe(201)
    expect((await pupil.get(draftFile.url)).status).toBe(404)
    expect((await admin.get(draftFile.url)).status).toBe(200)
    expect((await pupil.get(liveFile.url)).status).toBe(200)
    // Withdrawn: the image leaves the pupil again.
    await svc.setStatus(live.body.data.id as string, 'archived', await userIdOf(t.db, ACCOUNTS.admin))
    expect((await pupil.get(liveFile.url)).status).toBe(404)
    // A file attached to nothing stays staff-only.
    const loose = await uploadAs(admin)
    expect((await pupil.get(loose.url)).status).toBe(404)
  })

  it('kertas is stored as the trailing digit of the paper code and read back; update changes or clears it', async () => {
    const res = await admin.post('/api/questions').send({ ...base(), kertas: '2' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.data.kertas).toBe('2')
    const qid = res.body.data.id as string
    expect((await one(`select paper_code from question_versions where question_id = $1`, [qid]))?.paper_code).toBe('MATH/2')
    const keep = await admin.put(`/api/questions/${qid}`).send({ ...base() })
    expect(keep.body.data.kertas).toBe('2')
    const change = await admin.put(`/api/questions/${qid}`).send({ ...base(), kertas: '1' })
    expect(change.body.data.kertas).toBe('1')
    await t.db.query(`update question_versions set paper_code = '1449/1' where question_id = $1`, [qid])
    const real = await admin.put(`/api/questions/${qid}`).send({ ...base(), kertas: '2' })
    expect((await one(`select paper_code from question_versions where question_id = $1`, [qid]))?.paper_code).toBe('1449/2')
    expect(real.body.data.kertas).toBe('2')
    const cleared = await admin.put(`/api/questions/${qid}`).send({ ...base(), kertas: null })
    expect(cleared.body.data.kertas).toBeNull()
    const bad = await admin.post('/api/questions').send({ ...base(), kertas: '9' })
    expect(bad.status).toBe(422)
    expect(Object.keys(bad.body.error.fields)).toEqual(['kertas'])
  })

  it('the intake rule derives the kertas from the source paper (code first, then the printed label)', () => {
    expect(kertasOfSourcePaper({ paperCode: '1449/2', kertas: null })).toBe('2')
    expect(kertasOfSourcePaper({ paperCode: null, kertas: 'K1' })).toBe('1')
    expect(kertasOfSourcePaper({ paperCode: null, kertas: 'P2' })).toBe('2')
    expect(kertasOfSourcePaper({ paperCode: '1449/1', kertas: 'K2' })).toBe('1')
    expect(kertasOfSourcePaper({ paperCode: '1449/5', kertas: 'abc' })).toBeNull()
    expect(kertasOfSourcePaper(null)).toBeNull()
  })

  it('an intake provenance paper code is stored verbatim', async () => {
    const adminA = await adminActor(t.db)
    const q = await svc.createFromIntake(mcqInput(tag, { tag: tagBody(tag, 3) }), adminA, {
      sourceType: 'pdf', numberLabel: '1', sourcePage: 1, sourceRegion: null, sourcePaperId: null, intakeItemId: null, sourceFileId: null, aiRunId: null, aiModel: null,
      paperCode: '1449/2',
    })
    expect((await one(`select paper_code from question_versions where question_id = $1`, [q.id]))?.paper_code).toBe('1449/2')
  })

  it('paperCodeWithKertas: null removes only a valid trailing /1../3; nothing is invented without a subject code', () => {
    expect(paperCodeWithKertas('1449/4', null, 'MATH')).toBe('1449/4')
    expect(paperCodeWithKertas('SPM2023', null, 'MATH')).toBe('SPM2023')
    expect(paperCodeWithKertas('1449/2', null, 'MATH')).toBe('1449')
    expect(paperCodeWithKertas('MATH/2', null, 'MATH')).toBe('MATH')
    expect(paperCodeWithKertas('/2', null, 'MATH')).toBeNull()
    expect(paperCodeWithKertas(null, null, 'MATH')).toBeNull()
    expect(paperCodeWithKertas(null, '2', 'MATH')).toBe('MATH/2')
    expect(paperCodeWithKertas(null, '2', null)).toBeNull()
    expect(paperCodeWithKertas('SPM2023', '2', null)).toBe('SPM2023')
    expect(paperCodeWithKertas('1449/4', '2', 'MATH')).toBe('1449/2')
  })

  it('an edit without kertas, or with kertas null, keeps a real paper code such as 1449/4 or SPM2023', async () => {
    const qid = (await admin.post('/api/questions').send({ ...base() })).body.data.id as string
    for (const code of ['1449/4', 'SPM2023']) {
      await t.db.query(`update question_versions set paper_code = $2 where question_id = $1`, [qid, code])
      for (const extra of [{}, { kertas: null }]) {
        const res = await admin.put(`/api/questions/${qid}`).send({ ...base(), ...extra })
        expect(res.status, JSON.stringify(res.body)).toBe(200)
        expect((await one(`select paper_code from question_versions where question_id = $1`, [qid]))?.paper_code).toBe(code)
      }
    }
  })

  const internalIdOf = async (token: string): Promise<string> => (await one(`select id::text as id from files where public_id = $1`, [token]))!.id!
  const loose = async (owner: string | null, purpose = 'question_image'): Promise<string> => {
    const n = `x${Math.random().toString(36).slice(2)}`.padEnd(22, 'B').slice(0, 22)
    return (await one(
      `insert into files (public_id, owner_user_id, purpose, mime, size_bytes, sha256, storage_key)
       values ($1, $2, $3, 'image/png', 10, $4, $5) returning id::text as id`,
      [n, owner, purpose, 'a'.repeat(64), `key-${n}`],
    ))!.id!
  }

  it('image id checks: a guessed decimal id, an unowned file, a wrong-purpose file and a file of another question are all the same 422', async () => {
    const adminFile = await uploadAs(admin)
    const bad = await guru.post('/api/guru/questions').send({ ...base(), questionImageFileId: adminFile.id })
    expect(bad.status).toBe(422)
    // Another user's file named by its guessable decimal id: same status, key and message as the token.
    const byDecimal = await guru.post('/api/guru/questions').send({ ...base(), questionImageFileId: await internalIdOf(adminFile.id) })
    expect(byDecimal.status).toBe(422)
    expect(byDecimal.body.error.fields).toEqual(bad.body.error.fields)
    // A file with no owner is foreign for a Guru (fail closed) but an admin may use it.
    const orphan = await loose(null)
    const orphanGuru = await guru.post('/api/guru/questions').send({ ...base(), questionImageFileId: orphan })
    expect(orphanGuru.body.error?.fields).toEqual(bad.body.error.fields)
    expect((await admin.post('/api/questions').send({ ...base(), questionImageFileId: orphan })).status).toBe(201)
    // Wrong purpose, even for the admin and even when the Guru owns it.
    const guruId = await userIdOf(t.db, ACCOUNTS.teacher)
    const avatar = await loose(guruId, 'avatar')
    expect((await guru.post('/api/guru/questions').send({ ...base(), questionImageFileId: avatar })).body.error.fields).toEqual(bad.body.error.fields)
    expect((await admin.post('/api/questions').send({ ...base(), questionImageFileId: avatar })).status).toBe(422)
    // The admin's file already sits on the admin's question; the Guru still cannot put it on theirs.
    await admin.post('/api/questions').send({ ...base(), questionImageFileId: adminFile.id })
    const again = await guru.post('/api/guru/questions').send({ ...base(), optionImageFileIds: [adminFile.id, null, null, null] })
    expect(again.status).toBe(422)
    expect(Object.keys(again.body.error.fields)).toEqual(['optionImages.0'])
  })

  it('a pupil reads only images of the live version: an old version, a hidden level and a PKSK question are 404; anonymous is 401', async () => {
    const adminId = await userIdOf(t.db, ACCOUNTS.admin)
    const v1 = await uploadAs(admin)
    const v2 = await uploadAs(admin)
    const created = await admin.post('/api/questions').send({ ...base(), questionImageFileId: v1.id, tag: tagBody(tag, 3), status: 'approved' })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const qid = created.body.data.id as string
    expect((await pupil.get(v1.url)).status).toBe(200)
    expect((await t.http().get(v1.url)).status).toBe(401)
    // Edit: v2 is a draft, v1 still live; v2's image is not readable yet.
    expect((await admin.put(`/api/questions/${qid}`).send({ ...base(), questionImageFileId: v2.id })).status).toBe(200)
    expect((await pupil.get(v1.url)).status).toBe(200)
    expect((await pupil.get(v2.url)).status).toBe(404)
    for (const status of ['review', 'approved'] as const) await svc.setStatus(qid, status, adminId)
    expect((await pupil.get(v1.url)).status).toBe(404) // version 1 is archived now
    expect((await pupil.get(v2.url)).status).toBe(200)
    // A hidden (inactive) education level hides the question's images from a pupil.
    await t.db.query(`update education_levels set is_active = false where id = $1`, [tag.levelId])
    expect((await pupil.get(v2.url)).status).toBe(404)
    expect((await admin.get(v2.url)).status).toBe(200)
    await t.db.query(`update education_levels set is_active = true where id = $1`, [tag.levelId])
    expect((await pupil.get(v2.url)).status).toBe(200)
    // A PKSK-tagged question is served by M07 only.
    await t.db.query(`insert into question_tags (question_id, kind, code) values ($1, 'pksk_domain', 'ZZ')`, [qid])
    expect((await pupil.get(v2.url)).status).toBe(404)
    await t.db.query(`delete from question_tags where question_id = $1 and kind = 'pksk_domain'`, [qid])
    expect((await pupil.get(v2.url)).status).toBe(200)
  })
})
