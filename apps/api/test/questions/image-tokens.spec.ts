import type { QuestionPart } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsService } from '../../src/modules/questions'
import { makePng } from '../files/fixtures'
import { bootQuestionsApp, expectError, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqInput, rich, tagBody, tagOf, type Tag } from './fixtures'

const TOKEN = /^[A-Za-z0-9_-]{22}$/
const URL_OF = /^\/api\/files\/[A-Za-z0-9_-]{22}$/

/** Every [key, value] pair of a JSON value, however deep. */
function pairs(value: unknown, out: Array<[string, unknown]> = []): Array<[string, unknown]> {
  if (Array.isArray(value)) value.forEach((v) => pairs(v, out))
  else if (typeof value === 'object' && value !== null) {
    for (const [k, v] of Object.entries(value)) {
      out.push([k, v])
      pairs(v, out)
    }
  }
  return out
}

/** Every file reference a response carries: token or URL, never a decimal id. */
function imageRefs(body: unknown): string[] {
  const refs: string[] = []
  for (const [k, v] of pairs(body)) {
    if (k === 'imageId' && typeof v === 'string') refs.push(v)
    if (k === 'questionImage' && typeof v === 'string') refs.push(v)
    if (k === 'optionImages' && Array.isArray(v)) for (const x of v) if (typeof x === 'string') refs.push(x)
  }
  return refs.sort()
}

describe('BE-09 image references are public file tokens (internal ids never reach the wire)', () => {
  let t: QuestionsTestApp
  let admin: Client
  let teacher: Client
  let student: Client
  let tag: Tag
  let service: QuestionsService

  beforeAll(async () => {
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    teacher = await loginAs(t, 'teacher')
    student = await loginAs(t, 'student')
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    service = t.app.get(QuestionsService)
  })
  afterAll(async () => {
    await t.close()
  })

  async function uploadAs(who: Client, purpose = 'question_image'): Promise<{ token: string; internalId: string }> {
    const res = await who.post(`/api/files?purpose=${purpose}`).attach('file', makePng(), { filename: 'rajah.png', contentType: 'image/png' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const token = (res.body as { data: { id: string } }).data.id
    const rows = await t.db.query<{ id: string }>(`select id::text from files where public_id = $1`, [token])
    return { token, internalId: rows[0]!.id }
  }

  const parts = (imageId: string | null): QuestionPart[] =>
    [
      {
        label: '1',
        prompt: rich('Yang manakah rajah yang betul?'),
        mode: 'mcq',
        marks: 1,
        options: ['A', 'B', 'C', 'D'].map((l) => ({ label: l, body: rich(l), imageId: l === 'A' ? imageId : null })),
        key: { kind: 'option', correct: 'B' },
      },
    ] as unknown as QuestionPart[]

  const body = (imageId: string | null, over: Record<string, unknown> = {}) => ({
    subjectId: tag.subjectId,
    educationLevelId: tag.levelId,
    difficultyLevel: 3,
    questionType: 'essay',
    questionText: 'Soalan bergambar BE-09.',
    parts: parts(imageId),
    ...over,
  })

  it('upload, create with the token, read back as the token everywhere, and fetch /api/files/<token> under the read rules', async () => {
    const file = await uploadAs(admin)
    expect(file.token).toMatch(TOKEN)

    const created = await admin.post('/api/questions', body(file.token, { status: 'published', tag: tagBody(tag, 3) }))
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const id = (created.body as { data: { id: string } }).data.id
    expect(imageRefs(created.body)).toEqual([`/api/files/${file.token}`, file.token].sort())

    // Admin detail and list, structured routes are covered by the same view code; the owner view of a Guru is below.
    const detail = await admin.get(`/api/questions/${id}`)
    expect(detail.status).toBe(200)
    const list = await admin.get('/api/questions?pageSize=100')
    expect(list.status).toBe(200)
    const responses: unknown[] = [created.body, detail.body, list.body]
    for (const res of responses) {
      for (const ref of imageRefs(res)) {
        expect(ref).not.toBe(file.internalId)
        expect(ref).toMatch(new RegExp(`${TOKEN.source}|${URL_OF.source}`))
      }
      // No value anywhere in the response equals the internal id of the file.
      expect(pairs(res).filter(([k, v]) => /image/i.test(k) && (v === file.internalId || (Array.isArray(v) && v.includes(file.internalId))))).toEqual([])
    }

    // Learner projection (no HTTP route for students: BE-12/15/41 use the service).
    const pub = await service.getPublicForLearner(id)
    expect(imageRefs(pub)).toEqual([file.token])
    expect(pairs(pub).some(([, v]) => v === file.internalId && typeof v === 'string' && /^\d+$/.test(v) && v.length > 3)).toBe(false)

    // The file route: staff read, pupils get 404, anonymous 401.
    expect((await admin.get(`/api/files/${file.token}`)).status).toBe(200)
    expect((await teacher.get(`/api/files/${file.token}`)).status).toBe(200)
    expectError(await student.get(`/api/files/${file.token}`), 'NOT_FOUND')
    expectError(await t.http().get(`/api/files/${file.token}`), 'UNAUTHORIZED')

    // A partial edit that repeats the flat fields keeps the image, still as a token.
    const updated = await admin.put(`/api/questions/${id}`, body(file.token, { questionText: 'Soalan bergambar BE-09 (suntingan).' }))
    expect(updated.status, JSON.stringify(updated.body)).toBe(200)
    expect(imageRefs(updated.body)).toEqual([`/api/files/${file.token}`, file.token].sort())
    const stored = await t.db.query<{ image_file_id: string | null }>(
      `select o.image_file_id::text from part_options o join question_parts p on p.id = o.part_id join question_versions v on v.id = p.question_version_id where v.question_id = $1 and o.image_file_id is not null`,
      [id],
    )
    expect(stored.map((r) => r.image_file_id)).toEqual([file.internalId, file.internalId])
  })

  it('a Guru sees the same tokens on their own rows (list and detail)', async () => {
    const file = await uploadAs(teacher)
    const created = await admin.post('/api/questions', body(file.token))
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const id = (created.body as { data: { id: string } }).data.id
    await t.db.query(`update questions set created_by_id = $1 where id = $2`, [teacher.userId, id])
    const detail = await teacher.get(`/api/guru/questions/${id}`)
    expect(detail.status, JSON.stringify(detail.body)).toBe(200)
    expect(imageRefs(detail.body)).toEqual([`/api/files/${file.token}`])
    const list = await teacher.get('/api/guru/questions?pageSize=100')
    expect(list.status).toBe(200)
    expect(pairs(list.body).some(([, v]) => v === file.internalId)).toBe(false)
  })

  it('an unknown token, an internal decimal id and a file of another purpose are 422 on the image key', async () => {
    const wrong = await uploadAs(admin, 'cms_image')
    const ok = await uploadAs(admin)
    for (const ref of ['unknownTokenAAAAAAAAAA', ok.internalId, wrong.token, wrong.internalId]) {
      const res = await admin.post('/api/questions', body(ref))
      const error = expectError(res, 'VALIDATION_ERROR')
      expect(Object.keys(error.fields ?? {}), ref).toEqual(['optionImages.0'])
    }
  })

  it('a service-level batch: reading many questions with images costs one file lookup', async () => {
    const a = await uploadAs(admin)
    const b = await uploadAs(admin)
    await admin.post('/api/questions', body(a.token))
    await admin.post('/api/questions', body(b.token))
    const files = t.app.get((await import('../../src/modules/files')).FilesService)
    let calls = 0
    const original = files.publicIdsOf.bind(files)
    files.publicIdsOf = (ids) => {
      calls += 1
      return original(ids)
    }
    try {
      const res = await admin.get('/api/questions?pageSize=100')
      expect(res.status).toBe(200)
      expect(calls).toBe(1)
    } finally {
      files.publicIdsOf = original
    }
  })

  it('the shared mcqInput helper (no images) still round-trips', async () => {
    const res = await admin.post('/api/questions', mcqInput(tag))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(imageRefs(res.body).filter((r) => r !== '')).toEqual([])
  })
})
