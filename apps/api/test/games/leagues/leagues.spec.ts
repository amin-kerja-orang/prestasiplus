import {
  ErrorBodySchema,
  GAMES_MESSAGES as M,
  GamesLeagueDetailSchema,
  GamesLeagueIdResultSchema,
  GamesLeagueListSchema,
  GamesSekolahBersaingSchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { gamesSeed } from '../../../prisma/seed/games'
import { weekStartOf } from '../../../src/modules/games/leagues/leagues.service'
import { ACCOUNTS, bootGamesApp, expectCsrfInvalid, expectError, loginAs, parseData, type GamesTestApp } from '../helpers'

const VALID = {
  name: 'Liga Contoh',
  type: 'league',
  scope: 'national',
  game_mode: 'mixed',
  scoring_method: 'total_score',
  start_date: '2026-11-01',
  end_date: '2026-11-30',
}
const INVITE = /^[A-Z0-9]{8}$/

/** Expects a 422 whose top-level message is the first field message and `fields[field]` is that message. */
function expect422(res: { status: number; body: unknown }, field: string, message: string) {
  expect(res.status, JSON.stringify(res.body)).toBe(422)
  const body = ErrorBodySchema.parse(res.body)
  expect(body.error.code).toBe('VALIDATION_ERROR')
  expect(body.error.message).toBe(message)
  expect(body.error.fields?.[field]).toBe(message)
}

describe('leagues and Sekolah Bersaing (BE-45, M16-46 to M16-50)', () => {
  let t: GamesTestApp
  beforeAll(async () => {
    t = await bootGamesApp({ seeds: [gamesSeed], env: { PUBLIC_BASE_URL: 'https://app.example.test/' } })
    // The league fixtures use the demo schools as members; they are treated as secondary here (SK Demo * are primary by type).
    await t.db.query(`update schools set type = 'SMK' where code in ('DEMO002', 'DEMO003', 'DEMO004')`)
  }, 180_000)
  afterAll(async () => {
    await t.close()
  })

  const loginSchool = (code: string) => loginAs(t, `murid.${code.toLowerCase()}.01@example.test`)

  describe('guards', () => {
    it('answers 401 without a session on every route', async () => {
      for (const [m, url] of [
        ['get', '/api/leagues'],
        ['post', '/api/leagues'],
        ['post', '/api/leagues/join'],
        ['get', '/api/leagues/1'],
        ['get', '/api/sekolah-bersaing'],
      ] as const) {
        const res = await t.http()[m](url).send({})
        expectError(res, 'UNAUTHORIZED', 'Unauthenticated.')
        expect(res.status).toBe(401)
      }
    })

    it('answers CSRF_INVALID on a POST without the token', async () => {
      const s = await loginAs(t, ACCOUNTS.student)
      expectCsrfInvalid(await s.noCsrf.post('/api/leagues', VALID))
      expectCsrfInvalid(await s.noCsrf.post('/api/leagues/join', { invite_code: 'TEST2026' }))
    })
  })

  describe('list (M16-46) and detail (M16-49) of the seeded leagues', () => {
    it('mine = leagues with the caller school, open = every league not ended, with school counts', async () => {
      const s = await loginAs(t, ACCOUNTS.student) // DEMO001
      const res = await s.get('/api/leagues')
      expect(res.status).toBe(200)
      const list = parseData(res, GamesLeagueListSchema)
      expect(list.mine.map((l) => l.name)).toEqual(['Liga Sejarah 2026 5ST', 'Liga Matematik Sprint Test'])
      expect(list.open.map((l) => l.name)).toEqual(['Liga Sejarah 2026 5ST'])
      const sejarah = list.mine[0]!
      expect(sejarah).toMatchObject({ status: 'upcoming', statusLabel: 'Akan Datang', scopeLabel: 'Sekolah', typeLabel: 'Persahabatan', subjectName: expect.any(String), startDate: '2026-03-31', endDate: '2026-04-01', schools: 3 })
      expect(list.mine[1]).toMatchObject({ status: 'ended', statusLabel: 'Tamat', schools: 2 })
    })

    it('a school outside every league has an empty mine', async () => {
      const s = await loginSchool('demo002') // DEMO002 is in league 1
      const mine = parseData(await s.get('/api/leagues'), GamesLeagueListSchema).mine
      expect(mine.map((l) => l.name)).toEqual(['Liga Sejarah 2026 5ST'])
      const a = await loginAs(t, ACCOUNTS.admin) // no school
      expect(parseData(await a.get('/api/leagues'), GamesLeagueListSchema).mine).toEqual([])
    })

    it('detail: fields, invite code visible to non-members, stored standings only for levels with rows, no-store', async () => {
      const s = await loginSchool('demo003') // not in league 2
      const list = parseData(await s.get('/api/leagues'), GamesLeagueListSchema)
      const ended = (await loginAs(t, ACCOUNTS.student)).get
      const mathId = parseData(await ended('/api/leagues'), GamesLeagueListSchema).mine[1]!.id
      const res = await s.get(`/api/leagues/${mathId}`)
      expect(res.status).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      const d = parseData(res, GamesLeagueDetailSchema)
      expect(d).toMatchObject({ name: 'Liga Matematik Sprint Test', inviteCode: 'TEST2026', classLevels: ['T4', 'T5'], scoringLabel: 'Jumlah Markah', canJoin: false })
      expect(d.shareUrl).toContain('https://wa.me/?text=')
      expect(d.shareUrl).toContain('TEST2026')
      // SW10-06: the closing pointer is the league page of THIS deployment (PUBLIC_BASE_URL, scheme and trailing slash dropped), never the old system.
      const text = decodeURIComponent(d.shareUrl.slice('https://wa.me/?text='.length).replace(/\+/g, ' '))
      expect(text).toBe('Jom sertai Liga Pertandingan "Liga Matematik Sprint Test" di PrestasiPlus! Kod Jemputan: TEST2026 — app.example.test/liga 🏆')
      expect(d.shareUrl).not.toContain('prestasiplus.my')
      expect(d.creatorName).not.toBe('')
      expect(d.schools).toHaveLength(2)
      expect(Object.keys(d.standings).sort()).toEqual(['T4', 'T5'])
      expect(d.standings.T4!.map((r) => [r.rank, r.peserta, r.skor, r.purata])).toEqual([
        [1, 8, 2935, 77.2],
        [2, 0, 0, 0],
      ])
      expect(d.standings.T4![0]!.ppdState).toContain('Selangor')
      // League 1 has no stored standing rows, as live.
      const sejarah = list.open[0]!
      const d1 = parseData(await s.get(`/api/leagues/${sejarah.id}`), GamesLeagueDetailSchema)
      expect(d1.standings).toEqual({})
      expect(d1.canJoin).toBe(false) // DEMO003 is already in league 1
      expect(d1.inviteCode).toBe('RMU4VCBS')
    })

    it('a non-numeric, huge or unknown id is 404 "Liga tidak dijumpai."', async () => {
      const s = await loginAs(t, ACCOUNTS.student)
      for (const id of ['abc', 'join-x', '1e3', '-1', '99999999999999999999999', '999999', '%20', '0x1']) {
        const res = await s.get(`/api/leagues/${id}`)
        expectError(res, 'NOT_FOUND', M.leagueNotFound)
      }
    })
  })

  describe('create (M16-47)', () => {
    it('201 {id}: upcoming, 8-character code, creator school joins, optional fields stored', async () => {
      const s = await loginAs(t, ACCOUNTS.teacher)
      const res = await s.post('/api/leagues', { ...VALID, class_levels: ['T5', 'T1', 'T5'], max_schools: 5 })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const { id } = parseData(res, GamesLeagueIdResultSchema)
      const d = parseData(await s.get(`/api/leagues/${id}`), GamesLeagueDetailSchema)
      expect(d).toMatchObject({ name: 'Liga Contoh', status: 'upcoming', typeLabel: 'Liga', scopeLabel: 'Kebangsaan', subjectName: null, classLevels: ['T1', 'T5'], canJoin: false })
      expect(d.inviteCode).toMatch(INVITE)
      expect(d.schools).toHaveLength(1)
      expect(d.creatorName).not.toBe('')
    })

    it('a creator without a school creates a league with no participant (any signed-in role)', async () => {
      const a = await loginAs(t, ACCOUNTS.admin)
      const res = await a.post('/api/leagues', { ...VALID, name: '  Liga Tanpa Sekolah  ', subject_id: null, max_schools: null })
      expect(res.status).toBe(201)
      const d = parseData(await a.get(`/api/leagues/${parseData(res, GamesLeagueIdResultSchema).id}`), GamesLeagueDetailSchema)
      expect(d.name).toBe('Liga Tanpa Sekolah')
      expect(d.schools).toEqual([])
      expect(d.canJoin).toBe(true)
    })

    it('stores a valid subject_id and rejects an unknown one', async () => {
      const s = await loginAs(t, ACCOUNTS.student)
      const [subject] = await t.db.query<{ id: string; name: string }>(`select id::text, name from subjects where code = 'MATH'`)
      const ok = await s.post('/api/leagues', { ...VALID, subject_id: subject!.id })
      expect(ok.status).toBe(201)
      const d = parseData(await s.get(`/api/leagues/${parseData(ok, GamesLeagueIdResultSchema).id}`), GamesLeagueDetailSchema)
      expect(d.subjectName).toBe(subject!.name)
      for (const bad of ['999999', 'abc', 12]) {
        expect422(await s.post('/api/leagues', { ...VALID, subject_id: bad }), 'subject_id', M.leagueSubject)
      }
    })

    it('invite codes are unique across many creates', async () => {
      const s = await loginAs(t, ACCOUNTS.student2)
      const codes = new Set<string>()
      for (let i = 0; i < 6; i++) {
        const id = parseData(await s.post('/api/leagues', { ...VALID, name: `Liga ${String(i)}` }), GamesLeagueIdResultSchema).id
        codes.add(parseData(await s.get(`/api/leagues/${id}`), GamesLeagueDetailSchema).inviteCode)
      }
      expect(codes.size).toBe(6)
    })

    it('invite codes are random (not a function of user and clock)', async () => {
      const s = await loginAs(t, ACCOUNTS.student2)
      const a = parseData(await s.post('/api/leagues', { ...VALID, name: 'Satu' }), GamesLeagueIdResultSchema).id
      const b = parseData(await s.post('/api/leagues', { ...VALID, name: 'Dua' }), GamesLeagueIdResultSchema).id
      const [ca, cb] = await Promise.all([a, b].map(async (id) => parseData(await s.get(`/api/leagues/${id}`), GamesLeagueDetailSchema).inviteCode))
      expect(ca).toMatch(INVITE)
      expect(ca).not.toBe(cb)
    })

    it('required fields: "Sila lengkapkan semua medan wajib." with the field, in the mock order', async () => {
      const s = await loginAs(t, ACCOUNTS.student)
      for (const field of ['name', 'type', 'scope', 'game_mode', 'scoring_method', 'start_date', 'end_date']) {
        const { [field]: _omit, ...rest } = VALID as Record<string, unknown>
        void _omit
        expect422(await s.post('/api/leagues', rest), field, M.leagueRequired)
      }
      expect422(await s.post('/api/leagues', { ...VALID, name: '   ' }), 'name', M.leagueRequired)
      expect422(await s.post('/api/leagues', { ...VALID, name: 'x'.repeat(256) }), 'name', M.leagueRequired)
      expect422(await s.post('/api/leagues', { ...VALID, type: 'bogus' }), 'type', M.leagueRequired)
      expect422(await s.post('/api/leagues', { ...VALID, start_date: '2026-02-30' }), 'start_date', M.leagueRequired)
      expect422(await s.post('/api/leagues', {}), 'name', M.leagueRequired)
      expect422(await s.post('/api/leagues', [] as unknown as object), 'name', M.leagueRequired)
    })

    it('end_date before start_date, max_schools range and class_levels', async () => {
      const s = await loginAs(t, ACCOUNTS.student)
      expect422(await s.post('/api/leagues', { ...VALID, start_date: '2026-12-01', end_date: '2026-11-30' }), 'end_date', M.leagueEndBeforeStart)
      expect((await s.post('/api/leagues', { ...VALID, start_date: '2026-11-30', end_date: '2026-11-30' })).status).toBe(201)
      for (const bad of [1, 501, 2.5, 'x', -3]) {
        expect422(await s.post('/api/leagues', { ...VALID, max_schools: bad }), 'max_schools', M.leagueMaxSchools)
      }
      for (const ok of [2, 500]) expect((await s.post('/api/leagues', { ...VALID, max_schools: ok })).status).toBe(201)
      expect422(await s.post('/api/leagues', { ...VALID, class_levels: ['D1', 'T4'] }), 'class_levels', M.leagueClassLevels) // secondary-only
      expect422(await s.post('/api/leagues', { ...VALID, class_levels: ['T9'] }), 'class_levels', M.leagueClassLevels)
      expect422(await s.post('/api/leagues', { ...VALID, class_levels: 'T4' }), 'class_levels', M.leagueClassLevels)
    })

    it('validation order: the top-level message is the FIRST field message (name, ..., end_date, max_schools, subject, class_levels)', async () => {
      const s = await loginAs(t, ACCOUNTS.student)
      const res = await s.post('/api/leagues', { ...VALID, name: '', start_date: '2026-12-01', end_date: '2026-11-01', max_schools: 1, subject_id: '999999', class_levels: ['X'] })
      expect422(res, 'name', M.leagueRequired)
      const f = ErrorBodySchema.parse(res.body).error.fields!
      expect(f).toMatchObject({ name: M.leagueRequired, end_date: M.leagueEndBeforeStart, max_schools: M.leagueMaxSchools, class_levels: M.leagueClassLevels })
      // Without a required-field error the date rule comes first, then max_schools, then the class levels.
      const r2 = await s.post('/api/leagues', { ...VALID, start_date: '2026-12-01', end_date: '2026-11-01', max_schools: 1, class_levels: ['X'] })
      expect422(r2, 'end_date', M.leagueEndBeforeStart)
      const r3 = await s.post('/api/leagues', { ...VALID, max_schools: 1, class_levels: ['X'] })
      expect422(r3, 'max_schools', M.leagueMaxSchools)
    })
  })

  describe('join (M16-48)', () => {
    const create = async (as: Awaited<ReturnType<typeof loginAs>>, extra: object = {}) => {
      const id = parseData(await as.post('/api/leagues', { ...VALID, name: 'Liga Sertai', ...extra }), GamesLeagueIdResultSchema).id
      return { id, code: parseData(await as.get(`/api/leagues/${id}`), GamesLeagueDetailSchema).inviteCode }
    }

    it('refusals in the mock order, each with fields.invite_code', async () => {
      const owner = await loginAs(t, ACCOUNTS.student) // DEMO001
      const { code } = await create(owner)
      const d2 = await loginSchool('demo002')
      for (const bad of [undefined, '', '   ', 'NOPE0000', 12, null, ['a']]) {
        expect422(await d2.post('/api/leagues/join', { invite_code: bad }), 'invite_code', M.leagueInviteInvalid)
      }
      expect422(await d2.post('/api/leagues/join', undefined), 'invite_code', M.leagueInviteInvalid)
      expect422(await d2.post('/api/leagues/join', { invite_code: 'TEST2026' }), 'invite_code', M.leagueEnded)
      const admin = await loginAs(t, ACCOUNTS.admin)
      expect422(await admin.post('/api/leagues/join', { invite_code: code }), 'invite_code', M.leagueNeedsSchool)
      expect422(await owner.post('/api/leagues/join', { invite_code: code }), 'invite_code', M.leagueAlreadyIn)
      // An ended league is reported before the missing school.
      expect422(await admin.post('/api/leagues/join', { invite_code: 'TEST2026' }), 'invite_code', M.leagueEnded)
    })

    it('trims and upper-cases the code and returns {id}', async () => {
      const owner = await loginAs(t, ACCOUNTS.student)
      const { id, code } = await create(owner)
      const d2 = await loginSchool('demo002')
      const res = await d2.post('/api/leagues/join', { invite_code: `  ${code.toLowerCase()}  ` })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(parseData(res, GamesLeagueIdResultSchema).id).toBe(id)
      const detail = parseData(await d2.get(`/api/leagues/${id}`), GamesLeagueDetailSchema)
      expect(detail.schools).toHaveLength(2)
      expect(detail.canJoin).toBe(false)
      expect(parseData(await d2.get('/api/leagues'), GamesLeagueListSchema).mine.map((l) => l.id)).toContain(id)
    })

    it('a full league refuses with "Liga ini sudah penuh."', async () => {
      const owner = await loginAs(t, ACCOUNTS.student)
      const { code } = await create(owner, { max_schools: 2 })
      expect((await (await loginSchool('demo002')).post('/api/leagues/join', { invite_code: code })).status).toBe(200)
      expect422(await (await loginSchool('demo003')).post('/api/leagues/join', { invite_code: code }), 'invite_code', M.leagueFull)
    })

    it('concurrent joins never exceed max_schools', async () => {
      const owner = await loginAs(t, ACCOUNTS.student) // DEMO001 takes seat 1 of 3
      const { id, code } = await create(owner, { max_schools: 3 })
      const clients = await Promise.all(['demo002', 'demo003', 'demo004'].flatMap((c) => [loginSchool(c), loginSchool(c)]))
      // 6 requests from 3 schools (two per school) race for the 2 remaining seats.
      const results = await Promise.all(clients.map((c) => c.post('/api/leagues/join', { invite_code: code })))
      const statuses = results.map((r) => r.status)
      expect(statuses.filter((s) => s === 200)).toHaveLength(2)
      expect(statuses.filter((s) => s === 422)).toHaveLength(4)
      const [row] = await t.db.query<{ n: string }>(`select count(*)::text as n from league_schools where league_id = $1`, [id])
      expect(row!.n).toBe('3')
      for (const r of results.filter((x) => x.status === 422)) {
        expect([M.leagueFull, M.leagueAlreadyIn]).toContain(ErrorBodySchema.parse(r.body).error.message)
      }
    })
  })

  describe('Sekolah Bersaing (M16-50)', () => {
    const board = async (q = '') => {
      const s = await loginAs(t, ACCOUNTS.student)
      const res = await s.get(`/api/sekolah-bersaing${q}`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      return parseData(res, GamesSekolahBersaingSchema)
    }

    it('no week = the current week (frozen Monday 2026-10-19: empty), anything else never errors', async () => {
      const b = await board()
      expect(b).toEqual({ weekStart: '2026-10-19', count: 0, rows: [] })
      for (const q of ['?week=', '?week=abc', '?week=2026-13-45', '?week=2026-02-30', '?week=0000-01-01', '?week=99999-01-01', '?week=%00', '?week[]=x', '?week=2026-09-21&week=2026-09-14', `?week=${'9'.repeat(5000)}`, '?week=%E0%A4%A']) {
        const res = await (await loginAs(t, ACCOUNTS.student)).get(`/api/sekolah-bersaing${q}`)
        expect(res.status, q).toBe(200)
        expect(GamesSekolahBersaingSchema.safeParse(res.body.data).success, q).toBe(true)
      }
    })

    it('a valid date selects the Monday of its week; stored rank order; school name and state from the register', async () => {
      for (const day of ['2026-09-21', '2026-09-23', '2026-09-27']) {
        const b = await board(`?week=${day}`)
        expect(b.weekStart).toBe('2026-09-21')
        expect(b.count).toBe(4)
        expect(b.rows.map((r) => r.rank)).toEqual([1, 2, 3, 4])
        expect(b.rows.map((r) => r.state)).toEqual(['Johor', 'Selangor', 'Selangor', 'Johor'])
        expect(b.rows.map((r) => r.streakAvg)).toEqual([9.3, 8.2, 8.1, 7.9])
        expect(b.rows.every((r) => !r.anonymous && r.schoolName !== '')).toBe(true)
      }
      expect((await board('?week=2026-08-31')).weekStart).toBe('2026-08-31')
      expect((await board('?week=2026-01-01')).rows).toEqual([]) // a week with no snapshot
    })

    it('an anonymous row shows "Sekolah anonim" (name hidden, flag set)', async () => {
      await t.db.query(`update sekolah_bersaing_weeks set is_anonymous = true where week_start = '2026-09-14' and rank = 2`)
      const b = await board('?week=2026-09-14')
      expect(b.rows[1]).toMatchObject({ rank: 2, schoolName: 'Sekolah anonim', anonymous: true })
      expect(b.rows[0]!.schoolName).not.toBe('Sekolah anonim')
      await t.db.query(`update sekolah_bersaing_weeks set is_anonymous = false where week_start = '2026-09-14'`)
    })

    it('is a national board: every role and school sees the same rows', async () => {
      const a = parseData(await (await loginAs(t, ACCOUNTS.student)).get('/api/sekolah-bersaing?week=2026-09-21'), GamesSekolahBersaingSchema)
      const b = parseData(await (await loginAs(t, ACCOUNTS.schoolAdmin)).get('/api/sekolah-bersaing?week=2026-09-21'), GamesSekolahBersaingSchema)
      const c = parseData(await (await loginAs(t, ACCOUNTS.admin)).get('/api/sekolah-bersaing?week=2026-09-21'), GamesSekolahBersaingSchema)
      expect(b).toEqual(a)
      expect(c).toEqual(a)
    })
  })

  describe('Mod Pelajar (is_test)', () => {
    it('stamps the league and the school link, hides them from normal callers and lets the test caller see them', async () => {
      const mod = await loginAs(t, ACCOUNTS.schoolAdmin, { mod: true })
      const res = await mod.post('/api/leagues', { ...VALID, name: 'Liga Ujian Mod' })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const id = parseData(res, GamesLeagueIdResultSchema).id
      const rows = await t.db.query<{ is_test: boolean }>(`select is_test from leagues where id = $1`, [id])
      expect(rows[0]!.is_test).toBe(true)
      const links = await t.db.query<{ is_test: boolean }>(`select is_test from league_schools where league_id = $1`, [id])
      expect(links.map((r) => r.is_test)).toEqual([true])
      const code = parseData(await mod.get(`/api/leagues/${id}`), GamesLeagueDetailSchema).inviteCode
      expect(parseData(await mod.get('/api/leagues'), GamesLeagueListSchema).open.map((l) => l.id)).toContain(id)
      // A normal caller never sees it, not even by code.
      const normal = await loginAs(t, ACCOUNTS.student)
      expect(parseData(await normal.get('/api/leagues'), GamesLeagueListSchema).open.map((l) => l.id)).not.toContain(id)
      expectError(await normal.get(`/api/leagues/${id}`), 'NOT_FOUND', M.leagueNotFound)
      expect422(await normal.post('/api/leagues/join', { invite_code: code }), 'invite_code', M.leagueInviteInvalid)
    })

    it('a Mod Pelajar join into a real league is hidden from the normal school counts but still counts toward capacity', async () => {
      const owner = await loginAs(t, ACCOUNTS.teacher) // DEMO001 creator
      const id = parseData(await owner.post('/api/leagues', { ...VALID, name: 'Liga Kapasiti', max_schools: 2 }), GamesLeagueIdResultSchema).id
      const code = parseData(await owner.get(`/api/leagues/${id}`), GamesLeagueDetailSchema).inviteCode
      const [d2] = await t.db.query<{ email: string }>(`select u.email from users u join schools s on s.id = u.school_id where s.code = 'DEMO002' and u.email like 'adminsekolah.%'`)
      const mod = await loginAs(t, d2!.email, { mod: true })
      expect((await mod.post('/api/leagues/join', { invite_code: code })).status).toBe(200)
      const normal = await loginAs(t, ACCOUNTS.student)
      expect(parseData(await normal.get(`/api/leagues/${id}`), GamesLeagueDetailSchema).schools).toHaveLength(1)
      expect422(await (await loginSchool('demo003')).post('/api/leagues/join', { invite_code: code }), 'invite_code', M.leagueFull)
    })
  })

  describe('rate limit (D57)', () => {
    it('429 RATE_LIMITED with Retry-After on the write routes, a refused CSRF is not counted', async () => {
      const limited = await bootGamesApp({ env: { THROTTLE_GAMES_WRITE_PER_MINUTE: '2' }, seeds: [gamesSeed] })
      try {
        const s = await loginAs(limited, ACCOUNTS.student)
        expectCsrfInvalid(await s.noCsrf.post('/api/leagues', VALID))
        expect((await s.post('/api/leagues', VALID)).status).toBe(201)
        expect((await s.post('/api/leagues/join', { invite_code: 'NOPE0000' })).status).toBe(422)
        const res = await s.post('/api/leagues', VALID)
        expect(res.status).toBe(429)
        const body = ErrorBodySchema.parse(res.body)
        expect(body.error.code).toBe('RATE_LIMITED')
        expect(body.error.retryAfter).toBeGreaterThan(0)
        expect(res.headers['retry-after']).toBeDefined()
        limited.clock.advance(61_000)
        expect((await s.post('/api/leagues', VALID)).status).toBe(201)
      } finally {
        await limited.close()
      }
    })
  })
  it('secondary-only: a primary school (type SK) is left out of the members and the standings', async () => {
    await t.db.query(`update schools set type = 'SK' where code = 'DEMO002'`)
    try {
      const s = await loginSchool('demo003')
      const list = parseData(await s.get('/api/leagues'), GamesLeagueListSchema)
      const id = list.open[0]?.id ?? list.mine[0]?.id
      const d = parseData(await s.get(`/api/leagues/${id}`), GamesLeagueDetailSchema)
      expect(d.schools.map((x) => x.name)).not.toContain('SK Demo Dua')
      for (const rows of Object.values(d.standings)) expect((rows ?? []).map((r) => r.name)).not.toContain('SK Demo Dua')
    } finally {
      await t.db.query(`update schools set type = 'SMK' where code = 'DEMO002'`)
    }
  })
})

describe('weekStartOf', () => {
  const now = new Date('2026-10-21T09:00:00+08:00') // Wednesday
  it('maps a valid date to its Monday and anything else to the current week', () => {
    expect(weekStartOf('2026-09-21', now)).toBe('2026-09-21')
    expect(weekStartOf('2026-09-27', now)).toBe('2026-09-21')
    expect(weekStartOf('2026-09-28', now)).toBe('2026-09-28')
    expect(weekStartOf('2024-02-29', now)).toBe('2024-02-26')
    for (const bad of [undefined, null, 5, ['2026-09-21'], {}, '', '2026-9-21', '2026-02-30', '2026-13-01', '0001-01-01', ' 2026-09-21', '2026-09-21\n']) {
      expect(weekStartOf(bad, now)).toBe('2026-10-19')
    }
  })
})
