import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { makePng } from '../files/fixtures'
import { expectError, loginAs, bootQuestionsApp, type Client, type QuestionsTestApp } from './helpers'
import { tagOf, type Tag } from './fixtures'

/**
 * T13: pictures of the options of a part tree travel as public tokens in and out (the same token `POST /files` returns), the
 * unit/SP/TP/cognitive tags of every leaf round-trip, and a bad picture is refused under the field of that option.
 */
describe('Studio part tree: option pictures and per-leaf DSKP tags', () => {
  let t: QuestionsTestApp
  let admin: Client
  let tag: Tag

  beforeAll(async () => {
    process.env.FILE_STORAGE_DIR = await mkdtemp(join(tmpdir(), 'pp-q-studio-img-'))
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
  })
  afterAll(async () => {
    await t.close()
  })

  const upload = async (): Promise<string> => {
    const res = await admin.post('/api/files?purpose=question_image').attach('file', makePng(), { filename: 'pilihan.png', contentType: 'image/png' })
    expect(res.status).toBe(201)
    return (res.body.data as { id: string }).id
  }
  const leaf = (label: string, extra: Record<string, unknown> = {}) => ({
    label,
    prompt: { ms: `Soalan bahagian ${label}` },
    mode: 'mcq',
    marks: 1,
    options: [
      { label: 'A', body: { ms: 'Satu' } },
      { label: 'B', body: { ms: 'Dua' } },
      { label: 'C', body: { ms: 'Tiga' } },
    ],
    key: { kind: 'option', correct: 'B' },
    ...extra,
  })
  const body = (parts: unknown[]) => ({
    subjectId: tag.subjectId,
    educationLevelId: tag.levelId,
    difficultyLevel: 3,
    questionType: 'essay',
    questionText: 'Berdasarkan Rajah 1, jawab soalan berikut dengan teliti.',
    parts,
    tag: { unitId: tag.unitId, spIds: [tag.spId], tp: 4 },
  })

  it('stores the internal id, answers with the token, and keeps leaf TP and cognitive level', async () => {
    const token = await upload()
    const parts = [
      leaf('a', { difficultyTp: 2, kbat: 'bukan', options: [{ label: 'A', body: { ms: 'Satu' }, imageId: token }, { label: 'B', body: { ms: 'Dua' } }, { label: 'C', body: { ms: 'Tiga' } }] }),
      leaf('b', { difficultyTp: 4, kbat: 'menganalisis' }),
    ]
    const res = await admin.post('/api/questions', body(parts))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = res.body.data.id as string
    const out = res.body.data.parts as Array<{ label: string; difficultyTp: number; kbat: string; options: Array<{ imageId?: string }> }>
    expect(out[0]?.options[0]?.imageId).toBe(token)
    expect(out.map((p) => [p.label, p.difficultyTp, p.kbat])).toEqual([['a', 2, 'bukan'], ['b', 4, 'menganalisis']])

    const stored = await t.db.query<{ image_file_id: string; public_id: string }>(
      `select o.image_file_id::text image_file_id, f.public_id from part_options o join question_parts p on p.id = o.part_id
         join question_versions v on v.id = p.question_version_id join files f on f.id = o.image_file_id where v.question_id = $1`,
      [id],
    )
    expect(stored).toHaveLength(1)
    expect(stored[0]?.public_id).toBe(token)
    expect(stored[0]?.image_file_id).not.toBe(token)

    const read = await admin.get(`/api/questions/${id}`)
    expect((read.body.data.parts as typeof out)[0]?.options[0]?.imageId).toBe(token)
    // The tokens read back are accepted again: an edit that sends the tree it read does not lose the picture.
    const again = await admin.put(`/api/questions/${id}`, { ...body(read.body.data.parts as unknown[]), questionText: 'Berdasarkan Rajah 1, jawab soalan berikut dengan lebih teliti.' })
    expect(again.status, JSON.stringify(again.body)).toBe(200)
    expect((again.body.data.parts as typeof out)[0]?.options[0]?.imageId).toBe(token)
  })

  it('refuses an option picture that is not an uploaded question image, under the field of that option', async () => {
    const res = await admin.post('/api/questions', body([leaf('a', { options: [{ label: 'A', body: { ms: 'Satu' }, imageId: 'bukanfailsebenar12345' }, { label: 'B', body: { ms: 'Dua' } }, { label: 'C', body: { ms: 'Tiga' } }] })]))
    expect(expectError(res, 'VALIDATION_ERROR').fields).toEqual({ 'optionImages.0': 'Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB.' })
  })
})
