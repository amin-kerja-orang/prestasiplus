/**
 * API-GUR-17 structured variant, mock (S6-T17): POST / PUT / DELETE `/api/guru/intake/structured` with the
 * contract's 422 keys, 404 for another owner and 409 once the admin accepted the item.
 */
import { beforeAll, describe, expect, it } from 'vitest'

import { setUser } from '@/mock/core-data/set-user'
import type { MockRuntime } from '@/mock/index'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { GURU_SUBMISSION_PREFIX, guruSubmissions } from '@/modules/m04-question-bank/mock'
import { dskpRepo } from '../../mock/repository/dskp'

import {
  buildBody,
  emptyPart,
  emptyValues,
  type StructuredSubmitBody,
} from '../../lib/structured-form'
import { LOCKED_MESSAGE } from '../../mock/handlers/structured-submit'
import { bootM10 } from '../mock/helpers'

const ADMIN = 1
const PELAJAR = 2
const GURU = 5
const OTHER_GURU = 4501

let runtime: MockRuntime
let body: StructuredSubmitBody

/** A secondary (Tingkatan) level + a subject linked to it, and what D112 then requires. */
function pick() {
  const level = curriculum.levels().find((l) => l.isActive && l.stage !== 'primary')!
  const subject = curriculum
    .subjects()
    .find((x) => x.isActive && x.educationLevelIds.includes(level.id))!
  const chapter = curriculum.chapters(subject.id, level.id).find((c) => c.isActive)
  const sp = dskpRepo
    .bidang({ subjectId: subject.id, educationLevelId: level.id })
    .flatMap((b) => dskpRepo.sk(b.id))
    .flatMap((k) => dskpRepo.sp(k.id))[0]
  return { level, subject, chapter, sp }
}

beforeAll(async () => {
  ;({ runtime } = await bootM10())
  const { level, subject, chapter, sp } = pick()
  body = buildBody(
    {
      ...emptyValues(),
      levelId: String(level.id),
      subjectId: String(subject.id),
      chapterId: chapter ? String(chapter.id) : '',
      spId: sp ? String(sp.id) : '',
      tp: sp ? '3' : '',
      cognitiveLevel: sp ? 'memahami' : '',
      difficulty: '3',
      stimulus: 'Petikan untuk dua sub-soalan.',
      parts: [
        { ...emptyPart(), text: 'Soalan (a)', marks: '3', scheme: 'Skema (a)' },
        { ...emptyPart(), text: 'Soalan (b)', marks: '5', scheme: 'Skema (b)' },
      ],
    },
    null,
  )
}, 240_000)

async function call<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  as: number | null,
  payload?: unknown,
) {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (as !== null) headers.authorization = `Bearer ${setUser(as).token}`
  if (payload !== undefined) headers['content-type'] = 'application/json'
  const res = await runtime.transport.request({
    method,
    url,
    headers,
    ...(payload !== undefined ? { body: payload } : {}),
  })
  return { status: res.status, body: res.body as T }
}

interface Detail {
  data: {
    id: string
    status: string
    editable: boolean
    totalMarks: number
    subCount: number
    stimulus: string
    source: string
    subQuestions: { partLabel: string; marks: number; modelAnswer: string }[]
    form: { rejectionReason: string | null; difficultyLevel: number }
  }
}
interface Err {
  error: { message: string; fields?: Record<string, string> }
}

const URL = '/api/guru/intake/structured'

describe('POST /api/guru/intake/structured', () => {
  it('401 for a guest, 403 for a pupil', async () => {
    expect((await call('POST', URL, null, body)).status).toBe(401)
    expect((await call('POST', URL, PELAJAR, body)).status).toBe(403)
  })

  it('AC-GUR-44b-5: a stimulus with 2 questions is stored once, as "review", editable, total computed', async () => {
    const r = await call<Detail>('POST', URL, GURU, body)
    expect(r.status).toBe(201)
    const d = r.body.data
    expect(d.id.startsWith(GURU_SUBMISSION_PREFIX)).toBe(true)
    expect(d).toMatchObject({
      status: 'review',
      editable: true,
      source: 'submission',
      subCount: 2,
      totalMarks: 8,
    })
    expect(d.stimulus).toBe('Petikan untuk dua sub-soalan.')
    expect(d.subQuestions.map((s) => s.partLabel)).toEqual(['a', 'b'])
    expect(guruSubmissions.getOwn(GURU, d.id)?.parts).toHaveLength(2)
  })

  it('the admin account may also submit', async () => {
    expect((await call('POST', URL, ADMIN, body)).status).toBe(201)
  })

  it('AC-GUR-44b-8: marks 21 is a 422 on parts.0.marks and nothing is created', async () => {
    const before = guruSubmissions.listOwn(GURU).length
    const bad = { ...body, parts: [{ ...body.parts[0]!, marks: 21 }] }
    const r = await call<Err>('POST', URL, GURU, bad)
    expect(r.status).toBe(422)
    expect(r.body.error.fields).toEqual({ 'parts.0.marks': 'Markah mesti antara 1 dan 20.' })
    expect(guruSubmissions.listOwn(GURU)).toHaveLength(before)
  })

  it('422 keys and BM texts of the contract', async () => {
    const r = await call<Err>('POST', URL, GURU, {
      stimulus: 'x'.repeat(4001),
      tp: 9,
      difficultyLevel: 6,
      parts: [],
      totalMarks: 8,
    })
    expect(r.status).toBe(422)
    expect(r.body.error.fields).toMatchObject({
      subjectId: 'Sila pilih subjek.',
      educationLevelId: 'Sila pilih tingkatan.',
      tp: 'Tahap Penguasaan (TP) mesti antara 1 dan 6.',
      difficultyLevel: 'Sila pilih kesukaran.',
      stimulus: 'Rangsangan tidak boleh melebihi 4000 aksara.',
      parts: 'Sekurang-kurangnya satu sub-soalan diperlukan.',
      _: 'Unrecognized key: "totalMarks"',
    })
    const eleven = await call<Err>('POST', URL, GURU, {
      ...body,
      parts: Array.from({ length: 11 }, () => body.parts[0]),
    })
    expect(eleven.body.error.fields?.parts).toBe('Bilangan sub-soalan mesti antara 1 dan 10.')
  })
})

describe('tags and D112 (the BE resolveTags and guruDskpFields)', () => {
  it('an unknown or inactive Subjek / Tingkatan is a 422 with the PRD texts, a Darjah too', async () => {
    const bad = await call<Err>('POST', URL, GURU, {
      ...body,
      subjectId: '99999999',
      educationLevelId: '99999999',
    })
    expect(bad.status).toBe(422)
    expect(bad.body.error.fields).toEqual({
      subjectId: 'Sila pilih subjek.',
      educationLevelId: 'Sila pilih tingkatan.',
    })
    const darjah = curriculum.levels().find((l) => l.stage === 'primary')
    if (darjah) {
      const r = await call<Err>('POST', URL, GURU, { ...body, educationLevelId: String(darjah.id) })
      expect(r.body.error.fields?.educationLevelId).toBe('Sila pilih tingkatan.')
    }
  })

  it('names the unknown key of a part as parts.{i} and several keys together', async () => {
    const r = await call<Err>('POST', URL, GURU, {
      ...body,
      a: 1,
      b: 2,
      parts: [{ ...body.parts[0]!, x: 1 }],
    })
    expect(r.body.error.fields).toEqual({
      _: 'Unrecognized keys: "a", "b"',
      'parts.0': 'Unrecognized key: "x"',
    })
  })

  it('D112: Bab, SP, TP and Aras are required where chapters / DSKP nodes exist', async () => {
    const { chapter, sp } = pick()
    const bare = { ...body, chapterId: null, spIds: null, tp: null, cognitiveLevel: null }
    const r = await call<Err>('POST', URL, GURU, bare)
    const fields = r.body.error.fields ?? {}
    expect('chapterId' in fields).toBe(chapter !== undefined)
    expect('spIds' in fields).toBe(sp !== undefined)
    expect('tp' in fields).toBe(sp !== undefined)
    expect('cognitiveLevel' in fields).toBe(sp !== undefined)
    if (chapter) expect(fields.chapterId).toBe('Sila pilih bab.')
    if (sp) {
      expect(fields.spIds).toBe('Sila pilih Standard Pembelajaran (SP).')
      expect(fields.tp).toBe('Sila pilih TP.')
      expect(fields.cognitiveLevel).toBe('Sila pilih aras pemikiran.')
    }
  })

  it('createdAt is the +08:00 stamp of the BE', async () => {
    const made = (await call<Detail>('POST', URL, GURU, body)).body.data as Detail['data'] & {
      createdAt: string
    }
    expect(made.createdAt).toMatch(/\+08:00$/)
  })
})

describe('one store with the API-GUR-26 reads (M04 mock)', () => {
  it('a submission created through the form appears in GET /api/guru/structured-questions?status=review and its detail', async () => {
    const made = (await call<Detail>('POST', URL, GURU, body)).body.data
    const list = await call<{
      data: { id: string; source: string; editable: boolean; marks: number }[]
    }>('GET', '/api/guru/structured-questions?status=review', GURU)
    const row = list.body.data.find((r) => r.id === made.id)
    expect(row).toMatchObject({ source: 'submission', editable: true, marks: 8 })
    const detail = await call<Detail>('GET', `/api/guru/structured-questions/${made.id}`, GURU)
    expect(detail.body.data.form.difficultyLevel).toBe(3)
    // Another teacher does not see it.
    const other = await call<{ data: { id: string }[] }>(
      'GET',
      '/api/guru/structured-questions?status=review',
      OTHER_GURU,
    )
    expect(other.body.data.some((r) => r.id === made.id)).toBe(false)
  })
})

describe('PUT and DELETE /api/guru/intake/structured/:id', () => {
  it('PUT replaces the full body of an own item', async () => {
    const made = (await call<Detail>('POST', URL, GURU, body)).body.data
    const next = { ...body, difficultyLevel: 5, parts: [{ ...body.parts[0]!, marks: 10 }] }
    const r = await call<Detail>('PUT', `${URL}/${made.id}`, GURU, next)
    expect(r.status).toBe(200)
    expect(r.body.data).toMatchObject({
      id: made.id,
      subCount: 1,
      totalMarks: 10,
      status: 'review',
    })
    expect(r.body.data.form.difficultyLevel).toBe(5)
  })

  it('AC-GUR-44b-6: another teacher gets 404 on PUT and DELETE', async () => {
    const made = (await call<Detail>('POST', URL, GURU, body)).body.data
    expect((await call('PUT', `${URL}/${made.id}`, OTHER_GURU, body)).status).toBe(404)
    expect((await call('DELETE', `${URL}/${made.id}`, OTHER_GURU)).status).toBe(404)
    expect((await call('PUT', `${URL}/g99999`, GURU, body)).status).toBe(404)
  })

  it('409 with the server message once the admin accepted the item', async () => {
    const made = (await call<Detail>('POST', URL, GURU, body)).body.data
    guruSubmissions.accept(guruSubmissions.getOwn(GURU, made.id)!)
    const put = await call<Err>('PUT', `${URL}/${made.id}`, GURU, body)
    expect(put.status).toBe(409)
    expect(put.body.error.message).toBe(LOCKED_MESSAGE)
    // 409 before 422, and the detail reads "approved".
    expect((await call('PUT', `${URL}/${made.id}`, GURU, { parts: [] })).status).toBe(409)
    expect((await call('DELETE', `${URL}/${made.id}`, GURU)).status).toBe(409)
  })

  it('DELETE answers {removed: 1} and the item is gone', async () => {
    const made = (await call<Detail>('POST', URL, GURU, body)).body.data
    const r = await call<{ data: { removed: number } }>('DELETE', `${URL}/${made.id}`, GURU)
    expect(r.status).toBe(200)
    expect(r.body.data).toEqual({ removed: 1 })
    expect(guruSubmissions.getOwn(GURU, made.id)).toBeNull()
  })
})
