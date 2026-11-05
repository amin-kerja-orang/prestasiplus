/**
 * API-GUR-24 mock handlers over the real M01–M05 + M10 stores (the mock the FE is built against while the BE is blocked).
 * Tests run in order and share one runtime.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { setUser } from '@/mock/core-data/set-user'
import type { MockRuntime } from '@/mock/index'

import { bootM10 } from '../mock/helpers'

const GURU = 5
const OTHER_GURU = 4503
const PELAJAR = 2

let runtime: MockRuntime
beforeAll(async () => {
  ;({ runtime } = await bootM10())
}, 240_000)

interface Answer<T = unknown> {
  status: number
  body: T
}
interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> }
}
interface Row {
  id: number
  subjectName: string
  educationLevelId: number
  text: string
  options: { text: string }[]
  correctIndex: number
  referenceUrl: string | null
  createdAt: string
}
interface Page {
  data: Row[]
  meta: { page: number; pageSize: number; totalItems: number }
}

async function call<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  options: { as?: number | null; body?: unknown } = {},
): Promise<Answer<T>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  const who = options.as === undefined ? GURU : options.as
  if (who !== null) headers.authorization = `Bearer ${setUser(who).token}`
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  const res = await runtime.transport.request({
    method,
    url,
    headers,
    ...(options.body !== undefined ? { body: options.body } : {}),
  })
  return { status: res.status, body: res.body as T }
}
const fieldsOf = (a: Answer): Record<string, string> => (a.body as ErrorBody).error.fields ?? {}
const messageOf = (a: Answer): string => (a.body as ErrorBody).error.message

/** Kimia Tingkatan 1 has no chapters and no DSKP nodes, so the DSKP fields are optional (D112). */
const KIMIA = 10
const TINGKATAN_1 = 7
const BASE = '/api/guru/personal-questions'
const body = (over: Record<string, unknown> = {}) => ({
  subjectId: KIMIA,
  educationLevelId: TINGKATAN_1,
  difficulty: 3,
  text: 'Apakah nilai 7 x 6?',
  options: [{ text: '36' }, { text: '42' }, { text: '48' }, { text: '49' }],
  correctIndex: 1,
  referenceUrl: 'https://example.org/rujukan',
  ...over,
})

describe('guards', () => {
  it('401 to a guest and 403 to a pupil on every route', async () => {
    for (const [method, url] of [
      ['GET', BASE],
      ['POST', BASE],
      ['GET', `${BASE}/7801`],
      ['PUT', `${BASE}/7801`],
      ['DELETE', `${BASE}/7801`],
    ] as const) {
      expect((await call(method, url, { as: null, body: {} })).status, `${url} guest`).toBe(401)
      expect((await call(method, url, { as: PELAJAR, body: {} })).status, `${url} pelajar`).toBe(
        403,
      )
    }
  })
})

describe('list (FR-GUR-44a-1)', () => {
  it('own questions only, newest first, with the list envelope', async () => {
    const a = await call<Page>('GET', BASE)
    expect(a.status).toBe(200)
    expect(a.body.meta).toMatchObject({ page: 1, pageSize: 20, totalItems: 6 })
    const dates = a.body.data.map((r) => r.createdAt)
    expect([...dates].sort().reverse()).toEqual(dates)
    expect(a.body.data[0]).toMatchObject({ subjectName: expect.any(String) as string })
    expect((await call<Page>('GET', BASE, { as: OTHER_GURU })).body.meta.totalItems).toBe(0)
  })

  it('the Tahap filter keeps the rows of that Tingkatan', async () => {
    const a = await call<Page>('GET', `${BASE}?educationLevelId=11`)
    expect(a.body.data.length).toBeGreaterThan(0)
    expect(a.body.data.every((r) => r.educationLevelId === 11)).toBe(true)
  })
})

describe('create and read (AC-GUR-44a-1)', () => {
  let id = 0
  it('201 stores the correct option B and the link; the list shows it first', async () => {
    const a = await call<{ data: Row }>('POST', BASE, { body: body() })
    expect(a.status).toBe(201)
    expect(a.body.data).toMatchObject({
      subjectName: 'Kimia',
      correctIndex: 1,
      referenceUrl: 'https://example.org/rujukan',
    })
    id = a.body.data.id
    const list = await call<Page>('GET', BASE)
    expect(list.body.data[0]?.id).toBe(id)
    expect(list.body.meta.totalItems).toBe(7)
  })

  it('GET /:id returns the same shape; another teacher gets 404 on read, edit and delete', async () => {
    const a = await call<{ data: Row }>('GET', `${BASE}/${String(id)}`)
    expect(a.status).toBe(200)
    expect(a.body.data.options).toHaveLength(4)
    expect((await call('GET', `${BASE}/${String(id)}`, { as: OTHER_GURU })).status).toBe(404)
    expect(
      (await call('PUT', `${BASE}/${String(id)}`, { as: OTHER_GURU, body: body() })).status,
    ).toBe(404)
    expect((await call('DELETE', `${BASE}/${String(id)}`, { as: OTHER_GURU })).status).toBe(404)
    expect((await call('GET', `${BASE}/99999999`)).status).toBe(404)
  })

  it('PUT replaces the question', async () => {
    const a = await call<{ data: Row }>('PUT', `${BASE}/${String(id)}`, {
      body: body({ text: 'Apakah nilai 8 x 6?', correctIndex: 2, referenceUrl: null }),
    })
    expect(a.status).toBe(200)
    expect(a.body.data).toMatchObject({
      text: 'Apakah nilai 8 x 6?',
      correctIndex: 2,
      referenceUrl: null,
    })
  })

  it('DELETE answers {deleted: 1} and the question is gone', async () => {
    const a = await call<{ data: { deleted: number } }>('DELETE', `${BASE}/${String(id)}`)
    expect(a.status).toBe(200)
    expect(a.body.data).toEqual({ deleted: 1 })
    expect((await call('GET', `${BASE}/${String(id)}`)).status).toBe(404)
  })
})

describe('422 messages (PRD-20 44a field table)', () => {
  it('an empty body names every required field', async () => {
    const f = fieldsOf(await call('POST', BASE, { body: {} }))
    expect(f).toMatchObject({
      subjectId: 'Sila pilih subjek.',
      educationLevelId: 'Sila pilih tingkatan.',
      difficulty: 'Sila pilih kesukaran.',
      text: 'Sila isi teks soalan.',
      options: 'Sila isi pilihan A.',
      correctIndex: 'Sila tanda satu jawapan yang betul.',
    })
  })

  it('AC-GUR-44a-2: Teks Soalan empty is a 422 and the list count does not change', async () => {
    const before = (await call<Page>('GET', BASE)).body.meta.totalItems
    const a = await call('POST', BASE, { body: body({ text: '  ' }) })
    expect(a.status).toBe(422)
    expect(fieldsOf(a).text).toBe('Sila isi teks soalan.')
    expect((await call<Page>('GET', BASE)).body.meta.totalItems).toBe(before)
  })

  it('AC-GUR-44a-3 and 44a-8: javascript: and ftp: links are refused with the BM text', async () => {
    for (const bad of ['javascript:alert(1)', 'ftp://contoh', 'data:text/html,x']) {
      const a = await call('POST', BASE, { body: body({ referenceUrl: bad }) })
      expect(a.status, bad).toBe(422)
      expect(fieldsOf(a).referenceUrl, bad).toBe(
        'Pautan mesti bermula dengan http:// atau https://.',
      )
    }
    const long = await call('POST', BASE, {
      body: body({ referenceUrl: `https://a.my/${'x'.repeat(2048)}` }),
    })
    expect(fieldsOf(long).referenceUrl).toBe('Pautan tidak boleh melebihi 2048 aksara.')
  })

  it('AC-GUR-44a-5: only Tingkatan 1 to 5 (a Darjah is refused)', async () => {
    const a = await call('POST', BASE, { body: body({ educationLevelId: 1 }) })
    expect(fieldsOf(a).educationLevelId).toBe('Sila pilih tingkatan.')
  })

  it('limits: text 2000, option 500, correctIndex 0..3, difficulty 1..5', async () => {
    expect(
      fieldsOf(await call('POST', BASE, { body: body({ text: 'a'.repeat(2001) }) })).text,
    ).toBe('Teks soalan tidak boleh melebihi 2000 aksara.')
    const opts = [{ text: 'a' }, { text: 'b' }, { text: 'c'.repeat(501) }, { text: 'd' }]
    expect(fieldsOf(await call('POST', BASE, { body: body({ options: opts }) })).options).toBe(
      'Pilihan C tidak boleh melebihi 500 aksara.',
    )
    expect(
      fieldsOf(await call('POST', BASE, { body: body({ correctIndex: 4 }) })).correctIndex,
    ).toBe('Sila tanda satu jawapan yang betul.')
    expect(fieldsOf(await call('POST', BASE, { body: body({ difficulty: 6 }) })).difficulty).toBe(
      'Sila pilih kesukaran.',
    )
  })

  it('AC-GUR-44a-7: where the Subjek + Tingkatan has chapters and DSKP nodes, Bab, SP, TP and Aras are required', async () => {
    const a = await call('POST', BASE, { body: body({ subjectId: 3, educationLevelId: 10 }) })
    expect(a.status).toBe(422)
    expect(fieldsOf(a)).toMatchObject({
      chapterId: 'Sila pilih bab.',
      spIds: 'Sila pilih Standard Pembelajaran (SP).',
      tp: 'Sila pilih TP.',
      cognitiveLevel: 'Sila pilih aras pemikiran.',
    })
  })

  it('AC-GUR-44a-7: where none exist, the DSKP fields are not required', async () => {
    expect((await call('POST', BASE, { body: body() })).status).toBe(201)
  })

  it('a TP outside 1 to 6 gets the range text', async () => {
    expect(fieldsOf(await call('POST', BASE, { body: body({ tp: 9 }) })).tp).toBe(
      'Tahap Penguasaan (TP) mesti antara 1 dan 6.',
    )
  })
})

describe('409 delete guard (AC-GUR-44a-9)', () => {
  it('a question drawn into an active Misi (seed rule: index % 3 === 0) is refused and stays', async () => {
    const a = await call('DELETE', `${BASE}/7801`)
    expect(a.status).toBe(409)
    expect((a.body as ErrorBody).error.code).toBe('CONFLICT')
    expect(messageOf(a)).toBe('Soalan sedang digunakan dalam misi.')
    expect((await call('GET', `${BASE}/7801`)).status).toBe(200)
  })

  it('a question outside any active Misi deletes', async () => {
    expect((await call('DELETE', `${BASE}/7802`)).status).toBe(200)
    expect((await call('GET', `${BASE}/7802`)).status).toBe(404)
  })
})
