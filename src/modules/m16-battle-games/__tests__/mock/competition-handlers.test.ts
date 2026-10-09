/**
 * M16-T1: the ranking, tournament, league and Sekolah Bersaing endpoints (SRS M16 v1.6 §7 #1, #18-#20,
 * #42-#50) against the §6.10 / §6.11 values. Booted with the real core and M01-M05, M14 and M16 at the
 * project clock (2026-09-25 15:40 MYT). Tests share one runtime and run in order: the writes of an
 * earlier test are accounted for in the later expectations.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { api } from '@/api'

import {
  fetchActiveTournaments,
  fetchLeague,
  fetchSchoolDetail,
  fetchSchoolStandings,
  fetchSekolahBersaing,
  joinLeague,
  pollMatch,
  startBattle,
} from '../../api'
import { m16Hooks } from '../../mock/hooks'
import { bootM16, MemoryStorage, setUser, type Answer, type Booted } from './helpers'

const ADMIN = 1
const T4_STUDENT = 2 // school 900003 (SMK Demo)
const D5_STUDENT = 3 // no school
const D1_STUDENT = 4 // school 900004
const ANCHOR_8106 = 4301 // logged-in anchor of school 8106

let booted: Booted

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  booted = await bootM16()
}, 180_000)

afterAll(async () => {
  await booted.runtime.reset()
  vi.unstubAllGlobals()
})

async function call<T = unknown>(
  method: 'GET' | 'POST',
  url: string,
  as: number | null,
  body?: unknown,
): Promise<Answer<T>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (as !== null) headers.authorization = `Bearer ${setUser(as).token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  const res = await booted.runtime.transport.request({
    method,
    url,
    headers,
    ...(body !== undefined ? { body } : {}),
  })
  return { status: res.status, body: res.body as T }
}

async function data<T>(url: string, as: number | null): Promise<T> {
  const r = await call<{ data: T }>('GET', url, as)
  expect(r.status, url).toBe(200)
  return r.body.data
}

const post = <T>(url: string, as: number | null, body?: unknown) => call<T>('POST', url, as, body)

interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> }
}

describe('access', () => {
  it.each([
    ['GET', '/api/tournament/active'],
    ['GET', '/api/battle/standings/students'],
    ['GET', '/api/battle/standings/schools'],
    ['GET', '/api/battle/schools/8106'],
    ['GET', '/api/tournaments'],
    ['GET', '/api/tournaments/form-options'],
    ['POST', '/api/tournaments'],
    ['GET', '/api/tournaments/abc'],
    ['GET', '/api/leagues'],
    ['POST', '/api/leagues'],
    ['POST', '/api/leagues/join'],
    ['GET', '/api/leagues/1'],
    ['GET', '/api/sekolah-bersaing'],
  ] as const)('%s %s answers 401 without a session', async (method, url) => {
    expect((await call(method, url, null)).status).toBe(401)
  })
})

describe('#18 student standings', () => {
  it('weekly (and no period) is empty at the clock', async () => {
    expect(await data('/api/battle/standings/students?period=weekly', ADMIN)).toEqual([])
    expect(await data('/api/battle/standings/students', ADMIN)).toEqual([])
    expect(await data('/api/battle/standings/students?period=zzz', ADMIN)).toEqual([])
  })

  it('monthly lists 4316 and 4317 with 2 / 0 / 2 each (battles 30-33)', async () => {
    const rows = await data<Record<string, unknown>[]>(
      '/api/battle/standings/students?period=monthly',
      ADMIN,
    )
    expect(rows).toHaveLength(2)
    expect(Object.keys(rows[0] as object).sort()).toEqual(
      [
        'kalah',
        'ketepatan',
        'menang',
        'name',
        'rank',
        'school',
        'seri',
        'skor',
        'streak',
        'userId',
      ].sort(),
    )
    expect(rows.map((r) => [r.rank, r.menang, r.seri, r.kalah])).toEqual([
      [1, 2, 0, 2],
      [2, 2, 0, 2],
    ])
    expect(rows.map((r) => r.userId).sort()).toEqual([4316, 4317])
    // No school (M02 v1.23): the school column is empty.
    expect(rows.every((r) => r.school === '')).toBe(true)
  })
})

describe('#19 school standings (S3)', () => {
  type S3 = {
    activePeriod: string | null
    rows: {
      rank: number
      schoolId: number
      name: string
      state: string
      type: string
      battles: number
      menang: number
      seri: number
      kalah: number
      ketepatan: number
      pelajar: number
      skor: number
    }[]
    podium: { column: number; schoolId: number; name: string; state: string; skor: number }[]
  }

  it('weekly (default) is empty with no podium', async () => {
    expect(await data<S3>('/api/battle/standings/schools', ADMIN)).toEqual({
      activePeriod: 'weekly',
      rows: [],
      podium: [],
    })
  })

  it('monthly has 8082 only; the podium is table row 1', async () => {
    const s3 = await data<S3>('/api/battle/standings/schools?period=monthly', ADMIN)
    expect(s3.activePeriod).toBe('monthly')
    expect(s3.rows.map((r) => [r.schoolId, r.type, r.battles, r.skor])).toEqual([
      [8082, 'SMK', 8, 591],
    ])
    expect(s3.podium).toEqual([
      { column: 1, schoolId: 8082, name: s3.rows[0]?.name, state: 'Selangor', skor: 591 },
    ])
  })

  it('all time: 7 schools, the podium shows rows 1-3 (DV-M16-09) and the school cell fields', async () => {
    const s3 = await data<S3>('/api/battle/standings/schools?period=all_time', ADMIN)
    expect(s3.rows.map((r) => r.schoolId)).toEqual([8106, 8090, 8078, 8082, 8880, 8080, 2710])
    expect(s3.rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(s3.rows[0]).toMatchObject({
      state: 'Selangor',
      type: 'SMK',
      battles: 19,
      menang: 12,
      seri: 1,
      kalah: 6,
      ketepatan: 69,
      pelajar: 7,
      skor: 738,
    })
    expect(s3.rows[4]).toMatchObject({ state: 'Johor', type: 'SMK' })
    expect(s3.rows[6]).toMatchObject({ state: 'Johor', type: 'SK' })
    expect(s3.rows.every((r) => r.name !== '')).toBe(true)
    expect(s3.podium.map((p) => [p.column, p.schoolId, p.skor])).toEqual([
      [1, 8106, 738],
      [2, 8090, 519],
      [3, 8078, 367],
    ])
  })

  it('an unknown period is all time with no active pill; ?state= keeps the national rank', async () => {
    const unknown = await data<S3>('/api/battle/standings/schools?period=nope', ADMIN)
    expect(unknown.activePeriod).toBeNull()
    expect(unknown.rows).toHaveLength(7)
    const johor = await data<S3>('/api/battle/standings/schools?period=all_time&state=Johor', ADMIN)
    expect(johor.rows.map((r) => [r.schoolId, r.rank])).toEqual([
      [8880, 5],
      [2710, 7],
    ])
    expect(johor.podium).toHaveLength(3)
    expect(
      (await data<S3>('/api/battle/standings/schools?period=all_time&state=Perlis', ADMIN)).rows,
    ).toEqual([])
  })
})

describe('#20 school detail (S4)', () => {
  type S4 = {
    school: { id: number; name: string; ppd: string | null; state: string; type: string }
    allTime: { battles: number; menang: number; ketepatan: number; pelajar: number }
    week: unknown
    month: {
      rank: number
      battles: number
      menang: number
      seri: number
      kalah: number
      skor: number
    } | null
    fighters: unknown[]
    recent: {
      uuid: string
      playerA: { id: number; name: string; homeHere: boolean }
      scoreA: number
      scoreB: number
      playerB: { id: number; name: string }
      winner: string | null
      createdAt: string
    }[]
  }

  it('8106: cards 19 / 12 / 69% / 7, no week or month, the 10 newest finished battles', async () => {
    const s4 = await data<S4>('/api/battle/schools/8106', ADMIN)
    expect(s4.school).toMatchObject({
      id: 8106,
      state: 'Selangor',
      type: 'SMK',
      ppd: 'PPD HULU LANGAT',
    })
    expect(s4.allTime).toEqual({ battles: 19, menang: 12, ketepatan: 69, pelajar: 7 })
    expect(s4.week).toBeNull()
    expect(s4.month).toBeNull()
    expect(s4.fighters).toEqual([])
    expect(s4.recent).toHaveLength(10)
    expect(s4.recent[0]).toMatchObject({
      uuid: '00000000-0000-4000-8000-000000000001',
      scoreA: 9445,
      scoreB: 9763,
      winner: 'B',
      createdAt: '2026-07-20T21:58:00+08:00',
      playerA: { id: 4301, name: 'Murid Demo 4301', homeHere: true },
      playerB: { id: 4302, name: 'Murid Demo 4302' },
    })
    // Battles 9 and 10: player A is 4302, whose current school is not 8106 (M02 v1.23): blue.
    expect(s4.recent[8]?.playerA).toMatchObject({ id: 4302, homeHere: false })
    // Newest first.
    expect((s4.recent[0]?.createdAt ?? '') >= (s4.recent[9]?.createdAt ?? '')).toBe(true)
  })

  it('8082: the month box is the S3 row (#1, 8 battles 4/0/4, 591)', async () => {
    const s4 = await data<S4>('/api/battle/schools/8082', ADMIN)
    expect(s4.month).toEqual({ rank: 1, battles: 8, menang: 4, seri: 0, kalah: 4, skor: 591 })
    expect(s4.recent).toHaveLength(5)
    expect(s4.recent[0]?.createdAt).toBe('2026-09-16T21:58:00+08:00')
  })

  it.each([
    [8090, 9],
    [8078, 10],
    [8880, 3],
    [2710, 3],
    [8080, 10],
    [900, 0],
  ])('school %i lists %i recent battles', async (id, count) => {
    expect((await data<S4>(`/api/battle/schools/${String(id)}`, ADMIN)).recent).toHaveLength(count)
  })

  it('8880 and 900 cards; a school without battles shows zeros', async () => {
    expect((await data<S4>('/api/battle/schools/8880', ADMIN)).allTime).toEqual({
      battles: 3,
      menang: 2,
      ketepatan: 33,
      pelajar: 1,
    })
    const empty = await data<S4>('/api/battle/schools/900', ADMIN)
    expect(empty.allTime).toEqual({ battles: 0, menang: 0, ketepatan: 0, pelajar: 0 })
    expect(empty.school.name).not.toBe('')
  })

  it('answers 404 for an id that is not a school', async () => {
    expect((await call('GET', '/api/battle/schools/99999999', ADMIN)).status).toBe(404)
    expect((await call('GET', '/api/battle/schools/abc', ADMIN)).status).toBe(404)
  })
})

describe('#1, #42-#45 tournaments', () => {
  it('has no active tournament in the seed: a bare empty array, an empty list', async () => {
    expect(await call('GET', '/api/tournament/active', D5_STUDENT)).toEqual({
      status: 200,
      body: [],
    })
    expect(await data('/api/tournaments', D5_STUDENT)).toEqual([])
  })

  it('#43 form options are for admins only', async () => {
    expect((await call('GET', '/api/tournaments/form-options', D5_STUDENT)).status).toBe(403)
    const o = await data<{
      educationLevels: { id: string }[]
      subjects: { id: number; name: string; code: string }[]
      examPapers: unknown[]
      spmCounts: Record<string, number>
    }>('/api/tournaments/form-options', ADMIN)
    expect(o.educationLevels.map((l) => l.id)).toEqual(['tingkatan4', 'tingkatan5', 'spm'])
    expect(o.subjects).toHaveLength(31)
    const names = o.subjects.map((s) => s.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ms')))
    expect(o.examPapers).toEqual([])
    expect(o.spmCounts).toMatchObject({ BM: 25, BI: 40, MATH: 40, ADDMATH: 20 })
    expect(Object.keys(o.spmCounts)).toHaveLength(15)
  })

  const valid = {
    title: 'Kejohanan Sains',
    description: 'Ujian',
    education_level_id: 'spm',
    format: 'hybrid',
    groups_count: 2,
    question_mode: 'subject',
    subject_id: 4,
    total_questions: 40,
    time_window_minutes: 60,
    top_n_scoring: 20,
    min_participants: 10,
    action: 'open_registration',
  }

  it('#44 is admin only (403) and validates every field (V-M16-07…12)', async () => {
    expect((await post('/api/tournaments', D5_STUDENT, valid)).status).toBe(403)
    const empty = await post<ErrorBody>('/api/tournaments', ADMIN, {})
    expect(empty.status).toBe(422)
    expect(empty.body.error.code).toBe('VALIDATION_ERROR')
    expect(Object.keys(empty.body.error.fields ?? {})).toEqual(
      expect.arrayContaining([
        'title',
        'education_level_id',
        'format',
        'question_mode',
        'total_questions',
        'time_window_minutes',
        'top_n_scoring',
        'min_participants',
        'action',
      ]),
    )
    expect(empty.body.error.fields?.title).toBe('Tajuk tournament diperlukan.')
    expect(empty.body.error.fields?.education_level_id).toBe('Sila pilih tahap pendidikan.')
    const cases: [Record<string, unknown>, string, string][] = [
      [{ groups_count: 9 }, 'groups_count', 'Bilangan kumpulan mesti antara 2 dan 8.'],
      [{ total_questions: 4 }, 'total_questions', 'Nilai di luar julat.'],
      [{ time_window_minutes: 181 }, 'time_window_minutes', 'Nilai di luar julat.'],
      [{ top_n_scoring: 0 }, 'top_n_scoring', 'Nilai di luar julat.'],
      [{ min_participants: 101 }, 'min_participants', 'Nilai di luar julat.'],
      [
        { question_mode: 'exam_paper', exam_paper_id: 1 },
        'exam_paper_id',
        'Sila pilih sumber soalan.',
      ],
      [
        { question_mode: 'random_mix', mixed_subject_ids: [] },
        'mixed_subject_ids',
        'Sila pilih sumber soalan.',
      ],
      [{ subject_id: 999 }, 'subject_id', 'Sila pilih sumber soalan.'],
      // only the 31 subjects #43 offers are accepted
      [{ subject_id: 32 }, 'subject_id', 'Sila pilih sumber soalan.'],
      [{ subject_id: 0 }, 'subject_id', 'Sila pilih sumber soalan.'],
      [
        { registration_opens_at: '2026-10-02T10:00', registration_closes_at: '2026-10-01T10:00' },
        'registration_closes_at',
        'Tarikh tutup mesti selepas tarikh buka.',
      ],
      [{ title: 'x'.repeat(256) }, 'title', 'Tajuk tournament diperlukan.'],
    ]
    for (const [patch, field, message] of cases) {
      const r = await post<ErrorBody>('/api/tournaments', ADMIN, { ...valid, ...patch })
      expect(r.status, field).toBe(422)
      expect(r.body.error.fields?.[field], field).toBe(message)
    }
  })

  it('#44 draft stays hidden; open_registration shows in the banner (#1) and the list (#42)', async () => {
    const draft = await post<{ data: { uuid: string; status: string } }>(
      '/api/tournaments',
      ADMIN,
      {
        ...valid,
        title: 'Draf Sains',
        action: 'draft',
        groups_count: undefined,
        format: 'knockout',
      },
    )
    expect(draft.status).toBe(201)
    expect(draft.body.data.status).toBe('draft')
    const open = await post<{ data: { uuid: string; status: string } }>(
      '/api/tournaments',
      ADMIN,
      valid,
    )
    expect(open.status).toBe(201)
    expect(open.body.data.status).toBe('registration')

    const active = (
      await call<{ uuid: string; title: string; status: string; live_match: unknown }[]>(
        'GET',
        '/api/tournament/active',
        D5_STUDENT,
      )
    ).body
    expect(active).toEqual([
      {
        uuid: open.body.data.uuid,
        title: 'Kejohanan Sains',
        status: 'registration',
        live_match: null,
      },
    ])
    expect(await data('/api/tournaments', D5_STUDENT)).toEqual([
      { uuid: open.body.data.uuid, title: 'Kejohanan Sains', status: 'registration' },
    ])

    // #45: a draft is for admins only; an unknown uuid is 404.
    expect((await call('GET', `/api/tournaments/${draft.body.data.uuid}`, D5_STUDENT)).status).toBe(
      404,
    )
    expect((await call('GET', `/api/tournaments/${draft.body.data.uuid}`, ADMIN)).status).toBe(200)
    expect(
      (await call('GET', '/api/tournaments/00000000-0000-4000-8000-000000000000', ADMIN)).status,
    ).toBe(404)
    const detail = await data<Record<string, unknown>>(
      `/api/tournaments/${open.body.data.uuid}`,
      D5_STUDENT,
    )
    expect(detail).toMatchObject({
      title: 'Kejohanan Sains',
      status: 'registration',
      format: 'hybrid',
      groupsCount: 2,
      subjectId: 4,
      totalQuestions: 40,
      timeWindowMinutes: 60,
      topNScoring: 20,
      minParticipants: 10,
    })
  })

  it('a registration tournament past its close date is ongoing (derived)', async () => {
    const past = await post<{ data: { uuid: string } }>('/api/tournaments', ADMIN, {
      ...valid,
      title: 'Sudah Tutup',
      registration_closes_at: '2026-09-01T10:00',
    })
    const list = await data<{ uuid: string; status: string }[]>('/api/tournaments', D5_STUDENT)
    expect(list.find((t) => t.uuid === past.body.data.uuid)?.status).toBe('ongoing')
    // Ordered by registration_opens_at, then creation.
    expect(list.map((t) => t.status)).toEqual(['registration', 'ongoing'])
  })

  it('the tournaments fixture adds the banner states, including a live match', async () => {
    m16Hooks.m16Fixture('tournaments')
    const active = (
      await call<
        {
          title: string
          status: string
          live_match: { school_a: string; school_b: string } | null
        }[]
      >('GET', '/api/tournament/active', D5_STUDENT)
    ).body
    const titles = active.map((t) => t.title)
    expect(titles).toEqual(
      expect.arrayContaining([
        'Contoh Tournament Pendaftaran',
        'Contoh Tournament Berlangsung',
        'Contoh Tournament LIVE',
      ]),
    )
    const live = active.find((t) => t.title === 'Contoh Tournament LIVE')
    expect(live?.status).toBe('ongoing')
    expect(live?.live_match?.school_a).not.toBe('')
    expect(live?.live_match?.school_b).not.toBe('')
    expect(active.find((t) => t.title === 'Contoh Tournament Pendaftaran')?.live_match).toBeNull()
  })
})

describe('#46-#49 leagues', () => {
  const liga1 = {
    id: 1,
    name: 'Liga Sejarah 2026 5ST',
    status: 'upcoming',
    statusLabel: 'Akan Datang',
    scopeLabel: 'Sekolah',
    typeLabel: 'Persahabatan',
    subjectName: 'Sejarah',
    startDate: '2026-03-31',
    endDate: '2026-04-01',
    schools: 3,
  }

  it('#46 admin: Liga Saya 0, Liga Terbuka 1; a pupil of 8106 is in liga 1', async () => {
    expect(await data('/api/leagues', ADMIN)).toEqual({ mine: [], open: [liga1] })
    expect(await data('/api/leagues', ANCHOR_8106)).toEqual({ mine: [liga1], open: [liga1] })
  })

  it('#49 liga 1: header, invite code, share link, join button, no standings', async () => {
    const l = await data<Record<string, unknown>>('/api/leagues/1', ADMIN)
    expect(l).toMatchObject({
      id: 1,
      status: 'upcoming',
      statusLabel: 'Akan Datang',
      scoringLabel: 'Jumlah Markah',
      creatorName: 'Cikgu Demo 4401',
      classLevels: ['T5'],
      inviteCode: 'RMU4VCBS',
      canJoin: true,
      standings: {},
      shareUrl:
        'https://wa.me/?text=Jom+sertai+Liga+Pertandingan+%22Liga+Sejarah+2026+5ST%22+di+PrestasiPlus%21+Kod+Jemputan%3A+RMU4VCBS+%E2%80%94+prestasiplus.my%2Fliga+%F0%9F%8F%86',
    })
    expect((l.schools as { id: number }[]).map((s) => s.id).sort()).toEqual([8080, 8082, 8106])
    // A member cannot join again.
    expect((await data<{ canJoin: boolean }>('/api/leagues/1', ANCHOR_8106)).canJoin).toBe(false)
  })

  it('#49 liga 2 (Tamat): the stored standings per level; nobody can join', async () => {
    const l = await data<{
      canJoin: boolean
      statusLabel: string
      inviteCode: string
      standings: Record<
        string,
        {
          rank: number
          schoolId: number
          name: string
          ppdState: string
          peserta: number
          skor: number
          purata: number
        }[]
      >
    }>('/api/leagues/2', ADMIN)
    expect(l).toMatchObject({ canJoin: false, statusLabel: 'Tamat', inviteCode: 'TEST2026' })
    expect(Object.keys(l.standings)).toEqual(['T4', 'T5'])
    expect(l.standings.T4?.map((r) => [r.rank, r.schoolId, r.peserta, r.skor, r.purata])).toEqual([
      [1, 8090, 8, 2935, 77.2],
      [2, 8078, 0, 0, 0],
    ])
    expect(l.standings.T5?.map((r) => [r.rank, r.schoolId, r.peserta, r.skor, r.purata])).toEqual([
      [1, 8090, 0, 0, 0],
      [2, 8078, 0, 0, 0],
    ])
    expect(l.standings.T4?.[0]?.ppdState).toMatch(/, Selangor$/)
  })

  it.each([0, 3, 4, 999])('#49 an id that is not a league (%i) is 404', async (id) => {
    expect((await call('GET', `/api/leagues/${String(id)}`, ADMIN)).status).toBe(
      id === 3 || id === 4 ? 404 : 404,
    )
  })

  const form = {
    name: 'Liga Sains Daerah Kluang 2026',
    type: 'league',
    scope: 'district',
    subject_id: 4,
    game_mode: 'mixed',
    class_levels: ['T4', 'T5'],
    scoring_method: 'total_score',
    start_date: '2026-10-01',
    end_date: '2026-10-31',
    max_schools: 2,
  }

  it('#47 validates the required fields, the dates and the school limit (V-M16-14/15)', async () => {
    const empty = await post<ErrorBody>('/api/leagues', D1_STUDENT, {})
    expect(empty.status).toBe(422)
    expect(Object.keys(empty.body.error.fields ?? {}).sort()).toEqual([
      'end_date',
      'game_mode',
      'name',
      'scope',
      'scoring_method',
      'start_date',
      'type',
    ])
    expect(empty.body.error.fields?.name).toBe('Sila lengkapkan semua medan wajib.')
    const bad = await post<ErrorBody>('/api/leagues', D1_STUDENT, {
      ...form,
      end_date: '2026-09-30',
      max_schools: 1,
    })
    expect(bad.body.error.fields).toMatchObject({
      end_date: 'Tarikh tamat mesti selepas tarikh mula.',
      max_schools: 'Had sekolah mesti antara 2 dan 500.',
    })
    expect(
      (await post<ErrorBody>('/api/leagues', D1_STUDENT, { ...form, max_schools: 501 })).status,
    ).toBe(422)
  })

  it("#47 creates an upcoming league with an 8-character code; the creator's school joins first", async () => {
    const r = await post<{ data: { id: number } }>('/api/leagues', D1_STUDENT, form)
    expect(r.status).toBe(201)
    expect(r.body.data.id).toBe(3)
    const l = await data<{
      id: number
      status: string
      inviteCode: string
      creatorName: string
      classLevels: string[]
      schools: { id: number }[]
      typeLabel: string
      scopeLabel: string
      subjectName: string
      canJoin: boolean
    }>('/api/leagues/3', D1_STUDENT)
    expect(l).toMatchObject({
      status: 'upcoming',
      creatorName: 'Pelajar Maju Demo',
      classLevels: ['T4', 'T5'],
      typeLabel: 'Liga',
      scopeLabel: 'Daerah',
      canJoin: false,
    })
    expect(l.inviteCode).toMatch(/^[A-Z0-9]{8}$/)
    expect(l.schools.map((s) => s.id)).toEqual([900004])
    expect(
      (
        await data<{ mine: { id: number }[]; open: { id: number }[] }>('/api/leagues', D1_STUDENT)
      ).mine.map((c) => c.id),
    ).toEqual([3])
    // A creator without a school creates a league with no participant; the codes differ.
    const second = await post<{ data: { id: number } }>('/api/leagues', D5_STUDENT, {
      ...form,
      max_schools: undefined,
    })
    const l2 = await data<{ schools: unknown[]; inviteCode: string }>(
      `/api/leagues/${String(second.body.data.id)}`,
      D5_STUDENT,
    )
    expect(l2.schools).toEqual([])
    expect(l2.inviteCode).not.toBe(l.inviteCode)
  })

  it('#48 joins by code (any case) and refuses the other cases with their messages (V-M16-13)', async () => {
    const msg = async (code: unknown, as: number) => {
      const r = await post<ErrorBody>('/api/leagues/join', as, { invite_code: code })
      expect(r.status).toBe(422)
      expect(r.body.error.fields?.invite_code).toBe(r.body.error.message)
      return r.body.error.message
    }
    expect(await msg('ZZZZZZZZ', D1_STUDENT)).toBe('Kod jemputan tidak sah.')
    expect(await msg(undefined, D1_STUDENT)).toBe('Kod jemputan tidak sah.')
    expect(await msg('TEST2026', D1_STUDENT)).toBe('Liga ini sudah tamat.')
    expect(await msg('RMU4VCBS', D5_STUDENT)).toBe(
      'Anda perlu mempunyai sekolah untuk menyertai liga ini.',
    )

    const ok = await post<{ data: { id: number } }>('/api/leagues/join', D1_STUDENT, {
      invite_code: ' rmu4vcbs ',
    })
    expect([ok.status, ok.body.data.id]).toEqual([200, 1])
    expect(
      await data<{ schools: unknown[]; canJoin: boolean }>('/api/leagues/1', D1_STUDENT),
    ).toMatchObject({ canJoin: false })
    expect(await msg('RMU4VCBS', D1_STUDENT)).toBe('Sekolah anda sudah menyertai liga ini.')
    // Liga Terbuka for another school lists it; the count is now 4.
    expect(
      (await data<{ open: { id: number; schools: number }[] }>('/api/leagues', ADMIN)).open.find(
        (c) => c.id === 1,
      )?.schools,
    ).toBe(4)
  })

  it('#48 refuses a full league (max_schools reached)', async () => {
    const created = await post<{ data: { id: number } }>('/api/leagues', D1_STUDENT, {
      ...form,
      name: 'Liga Penuh',
      max_schools: 2,
    })
    const code = (
      await data<{ inviteCode: string }>(`/api/leagues/${String(created.body.data.id)}`, D1_STUDENT)
    ).inviteCode
    expect((await post('/api/leagues/join', ADMIN, { invite_code: code })).status).toBe(200)
    const full = await post<ErrorBody>('/api/leagues/join', T4_STUDENT, { invite_code: code })
    expect(full.status).toBe(422)
    expect(full.body.error.message).toBe('Liga ini sudah penuh.')
    // the detail agrees with join: a full league cannot be joined
    const detail = await data<{ canJoin: boolean }>(
      `/api/leagues/${String(created.body.data.id)}`,
      T4_STUDENT,
    )
    expect(detail.canJoin).toBe(false)
  })
})

describe('API client (api/)', () => {
  let token: string | null = null

  beforeAll(() => {
    api.configure({ transport: booted.runtime.transport, getToken: () => token })
  })

  afterAll(() => {
    api.configure({ transport: null, getToken: () => null })
  })

  it('the live-bodied battle calls resolve to {status, body} for any status', async () => {
    token = setUser(D5_STUDENT).token
    const bad = await startBattle('quick-match', { question_type: 'biasa', open_to_all: false })
    expect([bad.status, bad.body]).toEqual([422, {}])
    const started = await startBattle('quick-match', {
      question_type: 'biasa',
      open_to_all: false,
      subject_id: 3,
    })
    expect(started.status).toBe(200)
    const queueId = started.body.queue_id as number
    expect((await pollMatch(queueId)).body).toEqual({ status: 'waiting' })
    expect((await pollMatch(0)).body).toEqual({ status: 'not_found' })
  })

  it('the envelope calls unwrap {data} and reject with ApiError (404, 422 with fields)', async () => {
    expect((await fetchLeague(1)).inviteCode).toBe('RMU4VCBS')
    await expect(fetchLeague(999)).rejects.toMatchObject({ status: 404 })
    await expect(joinLeague('NOPE')).rejects.toMatchObject({
      status: 422,
      fields: { invite_code: 'Kod jemputan tidak sah.' },
    })
    expect((await fetchSchoolStandings({ period: 'all_time' })).rows).toHaveLength(7)
    expect((await fetchSekolahBersaing('2026-09-14')).count).toBe(48)
    expect((await fetchSchoolDetail(8106)).allTime.battles).toBe(19)
  })

  it('the banner list is empty on any failure (no session) and a bare array otherwise', async () => {
    token = null
    expect(await fetchActiveTournaments()).toEqual([])
    token = setUser(D5_STUDENT).token
    expect((await fetchActiveTournaments()).length).toBeGreaterThan(0)
  })
})

describe('#50 Sekolah Bersaing (S28)', () => {
  type SB = {
    weekStart: string
    count: number
    rows: {
      rank: number
      schoolName: string
      state: string
      aktifPct: number
      streakAvg: number
      notaPer10: number
      anonymous: boolean
    }[]
  }

  it('defaults to the current week: Monday 21 Sep 2026, 49 observed rows', async () => {
    const sb = await data<SB>('/api/sekolah-bersaing', D5_STUDENT)
    expect(sb.weekStart).toBe('2026-09-21')
    expect(sb.count).toBe(49)
    expect(sb.rows).toHaveLength(49)
    expect(sb.rows.map((r) => r.rank)).toEqual(Array.from({ length: 49 }, (_, i) => i + 1))
    expect(sb.rows.slice(0, 5).map((r) => [r.state, r.aktifPct, r.streakAvg, r.notaPer10])).toEqual(
      [
        ['Kelantan', 0, 15, 0],
        ['Johor', 0, 9.3, 0],
        ['Sabah', 0, 8.6, 0],
        ['Sabah', 0, 8.4, 0],
        ['Selangor', 0, 8.2, 0],
      ],
    )
    expect(sb.rows[16]).toMatchObject({
      rank: 17,
      state: 'Selangor',
      aktifPct: 0.5,
      streakAvg: 1.6,
    })
    expect(sb.rows[18]).toMatchObject({ rank: 19, aktifPct: 0.4, streakAvg: 1.1 })
    expect(sb.rows[45]).toMatchObject({ rank: 46, state: 'Kuala Lumpur' })
    expect(sb.rows[48]).toMatchObject({ rank: 49, state: 'Selangor', streakAvg: 0 })
    // Per state: Selangor 22, Johor 5, Sabah 4, Kuala Lumpur 4, Kedah 3, Pahang 3, others 2.
    const perState = new Map<string, number>()
    for (const r of sb.rows) perState.set(r.state, (perState.get(r.state) ?? 0) + 1)
    expect(Object.fromEntries(perState)).toEqual({
      Selangor: 22,
      Johor: 5,
      Sabah: 4,
      'Kuala Lumpur': 4,
      Kedah: 3,
      Pahang: 3,
      Kelantan: 2,
      Perak: 2,
      Melaka: 2,
      Terengganu: 2,
    })
    // 49 different register schools, none of the battle anchors or fixture schools.
    expect(new Set(sb.rows.map((r) => r.schoolName)).size).toBeGreaterThan(40)
    expect(sb.rows.every((r) => r.schoolName !== '' && !r.anonymous)).toBe(true)
  })

  it('?week= takes any date of the week; the earlier weeks hold 48 rows (the 21 Sep list without row 46)', async () => {
    const w14 = await data<SB>('/api/sekolah-bersaing?week=2026-09-17', D5_STUDENT)
    expect([w14.weekStart, w14.count]).toEqual(['2026-09-14', 48])
    expect(w14.rows[17]).toMatchObject({ rank: 18, state: 'Kelantan', streakAvg: 2.4 })
    expect(w14.rows[19]).toMatchObject({ rank: 20, state: 'Kuala Lumpur', streakAvg: 1.5 })
    const w07 = await data<SB>('/api/sekolah-bersaing?week=2026-09-07', D5_STUDENT)
    expect([w07.weekStart, w07.count]).toEqual(['2026-09-07', 48])
    expect(w07.rows[17]).toMatchObject({ aktifPct: 0.4, streakAvg: 1.8 })
    const w31 = await data<SB>('/api/sekolah-bersaing?week=2026-08-31', D5_STUDENT)
    expect([w31.weekStart, w31.count]).toEqual(['2026-08-31', 48])
    expect(w31.rows[19]).toMatchObject({ aktifPct: 0, streakAvg: 1.6 })
  })

  it('a week without a snapshot is the empty state; an invalid week shows the current week (DV-M16-30)', async () => {
    expect(await data('/api/sekolah-bersaing?week=2025-01-06', D5_STUDENT)).toEqual({
      weekStart: '2025-01-06',
      count: 0,
      rows: [],
    })
    for (const week of ['abc', '2026-02-30', '', '2026-13-01', '21-09-2026']) {
      const sb = await data<SB>(`/api/sekolah-bersaing?week=${week}`, D5_STUDENT)
      expect([week, sb.weekStart, sb.count]).toEqual([week, '2026-09-21', 49])
    }
  })

  it('a school opted out of the board shows as "Sekolah anonim" (fixture)', async () => {
    m16Hooks.m16Fixture('anonymousSchool', { rank: 3 })
    const sb = await data<SB>('/api/sekolah-bersaing', D5_STUDENT)
    expect(sb.rows[2]).toMatchObject({ rank: 3, schoolName: 'Sekolah anonim', anonymous: true })
    expect(sb.rows[1]?.anonymous).toBe(false)
  })

  it('the repository windows follow the clock: next week is empty', async () => {
    booted.clock.advance(7 * 24 * 3_600_000)
    expect(await data('/api/sekolah-bersaing', D5_STUDENT)).toEqual({
      weekStart: '2026-09-28',
      count: 0,
      rows: [],
    })
    // The school standings follow too: the monthly period is now October (empty).
    const s3 = await data<{ rows: unknown[] }>(
      '/api/battle/standings/schools?period=monthly',
      ADMIN,
    )
    expect(s3.rows).toHaveLength(0)
  })
})
