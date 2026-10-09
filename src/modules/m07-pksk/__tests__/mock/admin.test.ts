/**
 * M07-T1b admin endpoints (SRS M07 v1.7 §7 #7-#18): guards (401 / 403), happy paths, 422, 404,
 * the PKSK-only id guard (SEC-M07-12, BR-M07-21), persistence, "a 4xx writes nothing", and the
 * student endpoints reflecting the admin changes. One runtime is shared, so the read tests run
 * first and the mutations follow in order.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { MockRuntime } from '@/mock/index'
import { questions } from '@/modules/m04-question-bank/mock'

import { pkskAccess } from '../../mock'
import {
  ADMIN,
  bootPksk,
  call,
  type ErrorBody,
  GURU,
  IBUBAPA,
  MAJU,
  MemoryStorage,
  PELAJAR,
  PELAJAR2,
} from './helpers'

let runtime: MockRuntime

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = (await bootPksk()).runtime
}, 120_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

type Res<T> = { data: T; meta?: Meta; status?: string } & ErrorBody
interface Meta {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  from: number | null
  to: number | null
}
interface ListItem {
  id: number
  questionText: string
  bahagian: 'A' | 'B' | 'C'
  domain: { id: number; code: string; name: string; icon: string; color: string }
  targetLevel: 'T1' | 'T4'
  status: string
}
interface Detail {
  id: number
  bahagian: 'A' | 'B' | 'C'
  pkskDomainId: number
  pkskTargetLevel: 'T1' | 'T4'
  status: string
  questionText: string
  difficultyLevel: number
  explanation: string | null
  options: { text: string; isCorrect: boolean }[]
}
interface Stats {
  total: number
  approved: number
  pending: number
  t1: number
  t4: number
}
interface AccessItem {
  id: number
  user: { id: number; name: string; email: string }
  package: { id: number; name: string; level: string }
  grantedBy: { id: number; name: string } | null
  grantedAt: string
  expiresAt: string | null
  status: string
  displayStatus: string
}

const get = <T>(userId: number | null, url: string) => call<Res<T>>(runtime, 'GET', url, userId)
const send = <T>(
  method: 'POST' | 'PUT' | 'DELETE',
  userId: number | null,
  url: string,
  body?: unknown,
) => call<Res<T>>(runtime, method, url, userId, body)

const Q = '/api/admin/pksk-questions'
const A = '/api/admin/pksk-access'

const mcq = (n = 4, correct = [0]) =>
  Array.from({ length: n }, (_, i) => ({
    text: `Pilihan ${String(i + 1)}`,
    isCorrect: correct.includes(i),
  }))

const validCreate = {
  bahagian: 'B',
  pkskDomainId: 2,
  pkskTargetLevel: 'T1',
  questionText: '  Soalan ujian T1b?  ',
  difficultyLevel: 3,
  explanation: 'Sebab ujian.',
  options: mcq(),
}

/** An objective M04 row (not a PKSK question): the SEC-M07-12 target. */
const objectiveId = (): number => {
  const row = questions.adminList({ pageSize: 1 }).rows[0]
  if (!row) throw new Error('no objective question')
  expect(row.pkskDomainId).toBeNull()
  return row.id
}

describe('guards on every admin endpoint (FR-M07-59)', () => {
  const routes: [string, 'GET' | 'POST' | 'PUT' | 'DELETE', string][] = [
    ['#7', 'GET', Q],
    ['#8', 'GET', `${Q}/stats`],
    ['#9', 'GET', `${Q}/177698`],
    ['#10', 'POST', Q],
    ['#11', 'PUT', `${Q}/177698`],
    ['#12', 'DELETE', `${Q}/177698`],
    ['#13', 'POST', `${Q}/bulk`],
    ['#14', 'GET', A],
    ['#15', 'GET', `${A}/stats`],
    ['#16', 'POST', A],
    ['#17', 'POST', `${A}/1/revoke`],
    ['#18', 'GET', '/api/pksk-packages'],
  ]

  it.each(routes)('%s answers 401 for a guest', async (_n, method, url) => {
    const r = await call<ErrorBody>(runtime, method, url, null, method === 'GET' ? undefined : {})
    expect(r.status).toBe(401)
  })

  it.each(routes)('%s answers 403 for other roles', async (_n, method, url) => {
    for (const user of [PELAJAR, GURU, IBUBAPA]) {
      const r = await call<ErrorBody>(runtime, method, url, user, method === 'GET' ? undefined : {})
      expect(r.status).toBe(403)
    }
  })
})

describe('#7 GET /api/admin/pksk-questions', () => {
  it('lists 20 per page, createdAt desc then id asc, with the list-item shape', async () => {
    const r = await get<ListItem[]>(ADMIN, Q)
    expect(r.status).toBe(200)
    expect(r.body.meta).toMatchObject({ page: 1, pageSize: 20, totalItems: 763, totalPages: 39 })
    expect(r.body.data).toHaveLength(20)
    const first = r.body.data[0] as ListItem
    expect(Object.keys(first).sort()).toEqual(
      ['bahagian', 'domain', 'id', 'questionText', 'status', 'targetLevel'].sort(),
    )
    expect(Object.keys(first.domain).sort()).toEqual(['code', 'color', 'icon', 'id', 'name'])
    const times = r.body.data.map((x) => questions.pkskGet(x.id)?.createdAtMs ?? 0)
    expect([...times].sort((a, b) => b - a)).toEqual(times)
  })

  it('pages (page 39 holds 3 rows; an out-of-range page is empty)', async () => {
    const last = await get<ListItem[]>(ADMIN, `${Q}?page=39`)
    expect(last.body.data).toHaveLength(3)
    expect(last.body.meta).toMatchObject({ page: 39, from: 761, to: 763 })
    const beyond = await get<ListItem[]>(ADMIN, `${Q}?page=40`)
    expect(beyond.status).toBe(200)
    expect(beyond.body.data).toHaveLength(0)
  })

  it('filters by level case-insensitively (T1 383, T4 380)', async () => {
    expect((await get(ADMIN, `${Q}?level=T1`)).body.meta?.totalItems).toBe(383)
    expect((await get(ADMIN, `${Q}?level=t1`)).body.meta?.totalItems).toBe(383)
    expect((await get(ADMIN, `${Q}?level=T4`)).body.meta?.totalItems).toBe(380)
  })

  it('filters by Bahagian, status and combines with AND', async () => {
    const a = await get<ListItem[]>(ADMIN, `${Q}?bahagian=a&pageSize=1`)
    expect(a.body.meta?.totalItems).toBe(questions.countWhere({ pkskDomainId: 1 }))
    expect(a.body.data.every((x) => x.bahagian === 'A')).toBe(true)
    const bT1 = await get<ListItem[]>(ADMIN, `${Q}?bahagian=B&level=T1&status=APPROVED`)
    expect(bT1.body.meta?.totalItems).toBe(288)
    expect(bT1.body.data.every((x) => x.bahagian === 'B' && x.targetLevel === 'T1')).toBe(true)
    expect((await get(ADMIN, `${Q}?status=pending`)).body.meta?.totalItems).toBe(0)
  })

  it('searches the question text, trimmed and case-insensitive (inovasi -> 13)', async () => {
    for (const term of ['inovasi', 'INOVASI', '%20inovasi%20']) {
      const r = await get<ListItem[]>(ADMIN, `${Q}?search=${term}`)
      expect(r.body.meta?.totalItems).toBe(13)
    }
  })

  it('matches nothing for unknown filter values', async () => {
    for (const qs of ['status=zzz', 'bahagian=Z', 'level=T9']) {
      const r = await get<ListItem[]>(ADMIN, `${Q}?${qs}`)
      expect(r.status).toBe(200)
      expect(r.body.meta?.totalItems).toBe(0)
      expect(r.body.data).toEqual([])
    }
  })

  it('excludes non-PKSK rows (every item has a domain)', async () => {
    const r = await get<ListItem[]>(ADMIN, `${Q}?search=a`)
    expect(r.body.data.every((x) => x.domain.id >= 1 && x.domain.id <= 15)).toBe(true)
  })
})

describe('#8 GET /api/admin/pksk-questions/stats', () => {
  it('returns 763 / 763 / 0 / 383 / 380 and ignores filters', async () => {
    const expected: Stats = { total: 763, approved: 763, pending: 0, t1: 383, t4: 380 }
    expect((await get<Stats>(ADMIN, `${Q}/stats`)).body.data).toEqual(expected)
    expect((await get<Stats>(ADMIN, `${Q}/stats?level=T1&search=x&page=3`)).body.data).toEqual(
      expected,
    )
  })
})

describe('#9 GET /api/admin/pksk-questions/:id', () => {
  it('returns the detail of an observed anchor with its options', async () => {
    const r = await get<Detail>(ADMIN, `${Q}/177698`)
    expect(r.status).toBe(200)
    const d = r.body.data
    expect(d.id).toBe(177698)
    expect(Object.keys(d).sort()).toEqual(
      [
        'bahagian',
        'difficultyLevel',
        'explanation',
        'id',
        'options',
        'pkskDomainId',
        'pkskTargetLevel',
        'questionText',
        'status',
      ].sort(),
    )
    const q = questions.pkskGet(177698)
    expect(d.options).toEqual((q?.pkskOptions ?? []).map((o) => ({ ...o })))
  })

  it('answers 404 for an unknown id and for a non-PKSK id (SEC-M07-12)', async () => {
    expect((await get(ADMIN, `${Q}/99999999`)).status).toBe(404)
    expect((await get(ADMIN, `${Q}/${String(objectiveId())}`)).status).toBe(404)
    expect((await get(ADMIN, `${Q}/abc`)).status).toBe(404)
  })
})

describe('#14, #15, #18 access reads', () => {
  it('lists the 3 seeded Kombo rows, newest first, with the item shape', async () => {
    const r = await get<AccessItem[]>(ADMIN, A)
    expect(r.status).toBe(200)
    expect(r.body.meta).toMatchObject({ page: 1, pageSize: 20, totalItems: 3, totalPages: 1 })
    expect(r.body.data.map((x) => x.id)).toEqual([3, 2, 1])
    expect(r.body.data[0]).toMatchObject({
      id: 3,
      user: { id: MAJU, name: 'Pelajar Maju Demo' },
      package: { id: 3, name: 'PKSK Kombo (T1 + T4)', level: 'ALL' },
      grantedBy: null,
      expiresAt: null,
      status: 'active',
      displayStatus: 'active',
    })
    expect(typeof r.body.data[0]?.user.email).toBe('string')
  })

  it('searches the user name or e-mail, case-insensitively and trimmed', async () => {
    const byName = await get<AccessItem[]>(ADMIN, `${A}?search=%20ibu%20bapa%20`)
    expect(byName.body.data.map((x) => x.user.id)).toEqual([IBUBAPA])
    const email = (await get<AccessItem[]>(ADMIN, A)).body.data[2]?.user.email ?? ''
    const byEmail = await get<AccessItem[]>(ADMIN, `${A}?search=${email.toUpperCase()}`)
    expect(byEmail.body.data.map((x) => x.user.id)).toEqual([PELAJAR])
    const none = await get<AccessItem[]>(ADMIN, `${A}?search=zzzz`)
    expect(none.body.meta?.totalItems).toBe(0)
    expect(none.body.data).toEqual([])
  })

  it('counts 3 / 3 / 3 (a Kombo counts in T1 and T4, BR-M07-08)', async () => {
    const r = await get<{ activeTotal: number; t1: number; t4: number }>(ADMIN, `${A}/stats`)
    expect(r.body.data).toEqual({ activeTotal: 3, t1: 3, t4: 3 })
  })

  it('lists the 3 packages', async () => {
    const r = await get<{ id: number; name: string; level: string }[]>(ADMIN, '/api/pksk-packages')
    expect(r.body.data).toEqual([
      { id: 1, name: 'PKSK Tingkatan 1 (SBP/MRSM)', level: 'T1' },
      { id: 2, name: 'PKSK Tingkatan 4 (SBP/MRSM)', level: 'T4' },
      { id: 3, name: 'PKSK Kombo (T1 + T4)', level: 'ALL' },
    ])
  })
})

describe('#10 POST /api/admin/pksk-questions', () => {
  it('creates an approved question as #9000001 and the student pages see it', async () => {
    const before = (await get<Stats>(ADMIN, `${Q}/stats`)).body.data
    const sectionsBefore = await get<{ domains: { code: string; questionCount: number }[] }[]>(
      ADMIN,
      '/api/pksk/levels/T1/domains',
    )
    const mathBefore =
      sectionsBefore.body.data.flatMap((s) => s.domains).find((d) => d.code === 'PKSK_MATH')
        ?.questionCount ?? 0

    const r = await send<Detail>('POST', ADMIN, Q, validCreate)
    expect(r.status).toBe(201)
    expect(r.body.status).toBe('Soalan PKSK berjaya ditambah.')
    expect(r.body.data).toMatchObject({
      id: 9000001,
      bahagian: 'B',
      pkskDomainId: 2,
      pkskTargetLevel: 'T1',
      status: 'approved',
      questionText: 'Soalan ujian T1b?',
      difficultyLevel: 3,
      explanation: 'Sebab ujian.',
    })
    expect(r.body.data.options).toEqual(mcq())

    // persisted; stats and list move; first in the list (newest)
    expect((await get<Detail>(ADMIN, `${Q}/9000001`)).body.data.questionText).toBe(
      'Soalan ujian T1b?',
    )
    const after = (await get<Stats>(ADMIN, `${Q}/stats`)).body.data
    expect(after).toEqual({
      total: before.total + 1,
      approved: before.approved + 1,
      pending: 0,
      t1: before.t1 + 1,
      t4: before.t4,
    })
    expect((await get<ListItem[]>(ADMIN, Q)).body.data[0]?.id).toBe(9000001)

    // student endpoints reflect it (S3 count) and serve it without isCorrect
    const sections = await get<{ domains: { code: string; questionCount: number }[] }[]>(
      ADMIN,
      '/api/pksk/levels/T1/domains',
    )
    const math = sections.body.data.flatMap((s) => s.domains).find((d) => d.code === 'PKSK_MATH')
    expect(math?.questionCount).toBe(mathBefore + 1)
  })

  it('M04 keeps its own list and counts free of the PKSK row', () => {
    expect(questions.pkskGet(9000001)).not.toBeNull()
    expect(questions.adminList({ pageSize: 1000 }).rows.some((x) => x.id === 9000001)).toBe(false)
  })

  it('creates a Bahagian C question without options, ignoring any sent options', async () => {
    const r = await send<Detail>('POST', ADMIN, Q, {
      bahagian: 'C',
      pkskDomainId: 15,
      pkskTargetLevel: 'T4',
      questionText: 'Tulis esei.',
      difficultyLevel: 2,
      options: mcq(),
    })
    expect(r.status).toBe(201)
    expect(r.body.data.options).toEqual([])
    expect(r.body.data.explanation).toBeNull()
    expect(questions.pkskGet(r.body.data.id)?.questionType).toBe('essay')
  })

  it('creates a Bahagian A question with no correct option (flags stored as posted)', async () => {
    const r = await send<Detail>('POST', ADMIN, Q, {
      ...validCreate,
      bahagian: 'A',
      pkskDomainId: 1,
      options: mcq(3, []),
    })
    expect(r.status).toBe(201)
    expect(r.body.data.options.every((o) => !o.isCorrect)).toBe(true)
  })

  it('answers 422 with field errors and writes nothing', async () => {
    const totalBefore = (await get<Stats>(ADMIN, `${Q}/stats`)).body.data.total
    const cases: [Record<string, unknown>, string][] = [
      [{ ...validCreate, bahagian: undefined }, 'bahagian'],
      [{ ...validCreate, bahagian: 'Z' }, 'bahagian'],
      [{ ...validCreate, pkskDomainId: undefined }, 'pkskDomainId'],
      [{ ...validCreate, pkskDomainId: 99 }, 'pkskDomainId'],
      [{ ...validCreate, pkskDomainId: 1 }, 'pkskDomainId'], // domain 1 is Bahagian A, not B
      [{ ...validCreate, pkskTargetLevel: 'T9' }, 'pkskTargetLevel'],
      [{ ...validCreate, questionText: '   ' }, 'questionText'],
      [{ ...validCreate, difficultyLevel: undefined }, 'difficultyLevel'],
      [{ ...validCreate, difficultyLevel: 6 }, 'difficultyLevel'],
      [{ ...validCreate, options: mcq(1) }, 'options'],
      [{ ...validCreate, options: mcq(7) }, 'options'],
      [{ ...validCreate, options: undefined }, 'options'],
      [{ ...validCreate, options: [{ text: '  ', isCorrect: true }, ...mcq(2)] }, 'options'],
    ]
    for (const [body, field] of cases) {
      const r = await send('POST', ADMIN, Q, body)
      expect(r.status, field).toBe(422)
      expect(r.body.error.code).toBe('VALIDATION_ERROR')
      expect(Object.keys(r.body.error.fields ?? {}), field).toContain(field)
    }
    const bad = await send('POST', ADMIN, Q, { ...validCreate, bahagian: 'Z', questionText: '' })
    expect(bad.body.error.fields).toMatchObject({
      bahagian: 'Sila pilih bahagian.',
      questionText: 'Sila masukkan teks soalan.',
    })
    expect((await get<Stats>(ADMIN, `${Q}/stats`)).body.data.total).toBe(totalBefore)
  })
})

describe('#11 PUT /api/admin/pksk-questions/:id', () => {
  const put = (id: number, body: unknown, user = ADMIN) =>
    send<Detail>('PUT', user, `${Q}/${String(id)}`, body)
  const base = {
    pkskDomainId: 2,
    pkskTargetLevel: 'T1',
    status: 'approved',
    questionText: 'Teks baharu',
    difficultyLevel: 4,
    explanation: 'Penjelasan baharu',
    options: mcq(3, [1, 2]),
  }

  it('updates the fields, keeps the id and persists', async () => {
    const r = await put(9000001, { ...base, status: 'pending', pkskTargetLevel: 'T4' })
    expect(r.status).toBe(200)
    expect(r.body.status).toBe('Soalan PKSK berjaya dikemaskini.')
    expect(r.body.data).toMatchObject({
      id: 9000001,
      status: 'pending',
      pkskTargetLevel: 'T4',
      questionText: 'Teks baharu',
      difficultyLevel: 4,
      explanation: 'Penjelasan baharu',
    })
    expect(r.body.data.options).toEqual(mcq(3, [1, 2]))
    const again = await get<Detail>(ADMIN, `${Q}/9000001`)
    expect(again.body.data.status).toBe('pending')
    const stats = (await get<Stats>(ADMIN, `${Q}/stats`)).body.data
    expect(stats.pending).toBe(1)
  })

  it('keeps the stored options when none are sent and blank difficulty keeps the stored value', async () => {
    const r = await put(9000001, {
      pkskDomainId: 2,
      pkskTargetLevel: 'T1',
      status: 'approved',
      questionText: 'Teks baharu',
      difficultyLevel: '',
    })
    expect(r.status).toBe(200)
    expect(r.body.data.difficultyLevel).toBe(4)
    expect(r.body.data.options).toEqual(mcq(3, [1, 2]))
  })

  it('clears the options when the domain moves to Bahagian C', async () => {
    const r = await put(9000001, { ...base, pkskDomainId: 15 })
    expect(r.status).toBe(200)
    expect(r.body.data.bahagian).toBe('C')
    expect(r.body.data.options).toEqual([])
    expect(questions.pkskGet(9000001)?.questionType).toBe('essay')
    // back to B: options required again
    expect((await put(9000001, { ...base, pkskDomainId: 2, options: undefined })).status).toBe(422)
    expect((await put(9000001, { ...base, pkskDomainId: 2 })).status).toBe(200)
  })

  it('answers 422 and writes nothing', async () => {
    const before = (await get<Detail>(ADMIN, `${Q}/9000001`)).body.data
    const cases: [Record<string, unknown>, string][] = [
      [{ ...base, status: 'zzz' }, 'status'],
      [{ ...base, status: undefined }, 'status'],
      [{ ...base, pkskDomainId: 99 }, 'pkskDomainId'],
      [{ ...base, pkskTargetLevel: '' }, 'pkskTargetLevel'],
      [{ ...base, questionText: '' }, 'questionText'],
      [{ ...base, difficultyLevel: 9 }, 'difficultyLevel'],
      [{ ...base, options: mcq(1) }, 'options'],
    ]
    for (const [body, field] of cases) {
      const r = await put(9000001, body)
      expect(r.status, field).toBe(422)
      expect(Object.keys(r.body.error.fields ?? {}), field).toContain(field)
    }
    expect((await get<Detail>(ADMIN, `${Q}/9000001`)).body.data).toEqual(before)
  })

  it('answers 404 for an unknown id and refuses a non-PKSK id without touching it (SEC-M07-12)', async () => {
    expect((await put(99999999, base)).status).toBe(404)
    const id = objectiveId()
    const text = questions.get(id)?.questionText
    expect((await put(id, base)).status).toBe(404)
    expect(questions.get(id)?.questionText).toBe(text)
    expect(questions.get(id)?.pkskDomainId).toBeNull()
  })
})

describe('#12 DELETE /api/admin/pksk-questions/:id', () => {
  it('answers 204, removes the row for good and 404s afterwards', async () => {
    const created = await send<Detail>('POST', ADMIN, Q, validCreate)
    const id = created.body.data.id
    const total = (await get<Stats>(ADMIN, `${Q}/stats`)).body.data.total
    const r = await send('DELETE', ADMIN, `${Q}/${String(id)}`)
    expect(r.status).toBe(204)
    expect((await get<Stats>(ADMIN, `${Q}/stats`)).body.data.total).toBe(total - 1)
    expect((await get(ADMIN, `${Q}/${String(id)}`)).status).toBe(404)
    expect((await send('DELETE', ADMIN, `${Q}/${String(id)}`)).status).toBe(404)
  })

  it('never deletes a non-PKSK row (SEC-M07-12)', async () => {
    const id = objectiveId()
    expect((await send('DELETE', ADMIN, `${Q}/${String(id)}`)).status).toBe(404)
    expect(questions.exists(id)).toBe(true)
  })
})

describe('#13 POST /api/admin/pksk-questions/bulk', () => {
  const bulk = (body: unknown, user = ADMIN) =>
    send<{ affected: number }>('POST', user, `${Q}/bulk`, body)

  it('approves and rejects, with the affected count and flash', async () => {
    const rej = await bulk({ action: 'reject', ids: [177698, 177699, 177698] })
    expect(rej.status).toBe(200)
    expect(rej.body.data).toEqual({ affected: 2 })
    expect(rej.body.status).toBe('2 soalan telah ditolak.')
    expect((await get<Detail>(ADMIN, `${Q}/177698`)).body.data.status).toBe('rejected')
    const stats = (await get<Stats>(ADMIN, `${Q}/stats`)).body.data
    expect(stats.approved + stats.pending + 2).toBeLessThanOrEqual(stats.total)
    const app = await bulk({ action: 'approve', ids: [177698, 177699] })
    expect(app.body.status).toBe('2 soalan telah diluluskan.')
    expect((await get<Detail>(ADMIN, `${Q}/177699`)).body.data.status).toBe('approved')
  })

  it('deletes the selected rows', async () => {
    const a = await send<Detail>('POST', ADMIN, Q, validCreate)
    const b = await send<Detail>('POST', ADMIN, Q, validCreate)
    const r = await bulk({ action: 'delete', ids: [a.body.data.id, b.body.data.id] })
    expect(r.body.data.affected).toBe(2)
    expect(r.body.status).toBe('2 soalan telah dipadam.')
    expect((await get(ADMIN, `${Q}/${String(a.body.data.id)}`)).status).toBe(404)
  })

  it('answers 422 for an empty list, a bad action and any non-PKSK / unknown id, writing nothing', async () => {
    const total = (await get<Stats>(ADMIN, `${Q}/stats`)).body.data
    expect((await bulk({ action: 'approve', ids: [] })).status).toBe(422)
    expect((await bulk({ action: 'approve' })).status).toBe(422)
    expect((await bulk({ action: 'archive', ids: [177698] })).status).toBe(422)
    expect((await bulk({ ids: [177698] })).status).toBe(422)
    const id = objectiveId()
    const mixed = await bulk({ action: 'delete', ids: [177700, id] })
    expect(mixed.status).toBe(422)
    expect(mixed.body.error.fields).toHaveProperty('ids')
    expect((await bulk({ action: 'reject', ids: [177700, 99999999] })).status).toBe(422)
    expect(questions.exists(id)).toBe(true)
    expect(questions.pkskGet(177700)?.status).toBe('approved')
    expect((await get<Stats>(ADMIN, `${Q}/stats`)).body.data.total).toBe(total.total)
  })
})

describe('#16 POST /api/admin/pksk-access', () => {
  it('grants T1 to a user and the student endpoints see it at once', async () => {
    expect(
      (await get<{ T1: boolean; T4: boolean }>(PELAJAR2, '/api/pksk/me/access')).body.data,
    ).toEqual({
      T1: false,
      T4: false,
    })
    const r = await send<AccessItem>('POST', ADMIN, A, {
      userId: PELAJAR2,
      packageId: 1,
      expiresAt: null,
    })
    expect(r.status).toBe(201)
    expect(r.body.status).toBe('Akses PKSK berjaya diberi.')
    expect(r.body.data).toMatchObject({
      id: 4,
      user: { id: PELAJAR2, name: 'Pelajar Dua Demo' },
      package: { id: 1, level: 'T1' },
      grantedBy: { id: ADMIN, name: 'Admin Demo' },
      expiresAt: null,
      status: 'active',
      displayStatus: 'active',
    })
    expect(
      (await get<{ T1: boolean; T4: boolean }>(PELAJAR2, '/api/pksk/me/access')).body.data,
    ).toEqual({
      T1: true,
      T4: false,
    })
    expect((await get(PELAJAR2, '/api/pksk/levels/T1/domains')).status).toBe(200)
    expect((await get(PELAJAR2, '/api/pksk/levels/T4/domains')).status).toBe(403)
    // list: newest first; stats: Akses T1 +1, T4 unchanged
    expect((await get<AccessItem[]>(ADMIN, A)).body.data[0]?.id).toBe(4)
    expect((await get(ADMIN, `${A}/stats`)).body.data).toEqual({ activeTotal: 4, t1: 4, t4: 3 })
  })

  it('accepts a past expiry date (an already expired row, no access) and numeric strings', async () => {
    const r = await send<AccessItem>('POST', ADMIN, A, {
      userId: String(GURU),
      packageId: '2',
      expiresAt: '2026-01-01',
    })
    expect(r.status).toBe(201)
    expect(r.body.data).toMatchObject({
      expiresAt: '2026-01-01',
      status: 'active',
      displayStatus: 'expired',
    })
    expect(
      (await get<{ T1: boolean; T4: boolean }>(GURU, '/api/pksk/me/access')).body.data,
    ).toEqual({
      T1: false,
      T4: false,
    })
    // an expired row is not counted (BR-M07-08)
    expect((await get(ADMIN, `${A}/stats`)).body.data).toEqual({ activeTotal: 4, t1: 4, t4: 3 })
  })

  it('answers 422 and writes nothing', async () => {
    const count = pkskAccess.forUser(PELAJAR2).length + (await get(ADMIN, A)).body.meta!.totalItems
    const cases: [Record<string, unknown>, string, string?][] = [
      [{ packageId: 1 }, 'userId'],
      [{ userId: 99999, packageId: 1 }, 'userId', 'Pengguna tidak dijumpai.'],
      [{ userId: 1.5, packageId: 1 }, 'userId'],
      [{ userId: PELAJAR2, packageId: 9 }, 'packageId'],
      [{ userId: PELAJAR2 }, 'packageId'],
      [{ userId: PELAJAR2, packageId: 1, expiresAt: '2026-13-45' }, 'expiresAt'],
      [{ userId: PELAJAR2, packageId: 1, expiresAt: 'esok' }, 'expiresAt'],
    ]
    for (const [body, field, message] of cases) {
      const r = await send('POST', ADMIN, A, body)
      expect(r.status, field).toBe(422)
      expect(Object.keys(r.body.error.fields ?? {}), field).toContain(field)
      if (message) expect(r.body.error.fields?.[field]).toBe(message)
    }
    expect(pkskAccess.forUser(PELAJAR2).length + (await get(ADMIN, A)).body.meta!.totalItems).toBe(
      count,
    )
  })
})

describe('#17 POST /api/admin/pksk-access/:id/revoke', () => {
  it('revokes an active row: the row stays, access is lost, stats drop', async () => {
    const r = await send<AccessItem>('POST', ADMIN, `${A}/4/revoke`)
    expect(r.status).toBe(200)
    expect(r.body.status).toBe('Akses PKSK telah ditarik balik.')
    expect(r.body.data).toMatchObject({ id: 4, status: 'revoked', displayStatus: 'revoked' })
    expect(pkskAccess.get(4)?.revokedAt).not.toBeNull()
    expect((await get<{ T1: boolean }>(PELAJAR2, '/api/pksk/me/access')).body.data.T1).toBe(false)
    expect((await get(PELAJAR2, '/api/pksk/levels/T1/dashboard')).status).toBe(403)
    expect((await get<AccessItem[]>(ADMIN, A)).body.data.some((x) => x.id === 4)).toBe(true)
    expect((await get(ADMIN, `${A}/stats`)).body.data).toEqual({ activeTotal: 3, t1: 3, t4: 3 })
  })

  it('answers 409 for a revoked or expired row and 404 for an unknown id, writing nothing', async () => {
    const again = await send('POST', ADMIN, `${A}/4/revoke`)
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('CONFLICT')
    const expired = await send('POST', ADMIN, `${A}/5/revoke`)
    expect(expired.status).toBe(409)
    expect(pkskAccess.get(5)?.status).toBe('active')
    expect((await send('POST', ADMIN, `${A}/9999/revoke`)).status).toBe(404)
  })
})

describe('request bodies are visible to the test hook (lastRequest)', () => {
  it('records the posted body of a Bahagian C create without options', async () => {
    const body = {
      bahagian: 'C',
      pkskDomainId: 15,
      pkskTargetLevel: 'T1',
      questionText: 'Esei',
      difficultyLevel: 3,
    }
    const r = await send<Detail>('POST', ADMIN, Q, body)
    expect(r.status).toBe(201)
    const last = runtime.log.last(Q)
    expect(last?.method).toBe('POST')
    expect(last?.body).toEqual(body)
    expect(last?.body).not.toHaveProperty('options')
  })
})
