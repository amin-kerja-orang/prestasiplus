import {
  ErrorBodySchema,
  GAMES_MESSAGES as M,
  GamesLeagueDetailSchema,
  GamesLeagueListSchema,
  GamesSekolahBersaingBoardSchema,
} from '@pp/contract'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { gamesSeed } from '../../../prisma/seed/games'
import { rankSekolahBersaing } from '../../../src/modules/games/leagues/leagues.rules'
import { ACCOUNTS, bootGamesApp, expectCsrfInvalid, expectError, loginAs, parseData, type GamesTestApp } from '../helpers'

const VALID = {
  name: 'Liga Contoh',
  type: 'league',
  scope: 'national',
  mode: 'mixed',
  scoring: 'total_score',
  schoolLimit: 100,
  levelIds: [4, 5],
  start: '2026-11-01',
  end: '2026-11-30',
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
    t = await bootGamesApp({ seeds: [gamesSeed] })
    // The league fixtures use the demo schools as members; they are treated as secondary here (SK Demo * are primary by type).
    await t.db.query(`update schools set type = 'SMK' where code in ('DEMO002', 'DEMO003', 'DEMO004')`)
  }, 180_000)
  afterAll(async () => {
    await t.close()
  })

  const loginSchool = (code: string) => loginAs(t, `murid.${code.toLowerCase()}.01@example.test`)
  type Client = Awaited<ReturnType<typeof loginAs>>
  const schoolIdOf = async (code: string): Promise<string> => (await t.db.query<{ id: string }>(`select id::text as id from schools where code = $1`, [code]))[0]!.id
  /** Admin Pusat creates a league (the only role that may) and returns its id. */
  const createAs = async (admin: Client, extra: object = {}): Promise<string> => {
    const res = await admin.post('/api/leagues', { ...VALID, name: 'Liga Daftar', ...extra })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return parseData(res, GamesLeagueDetailSchema).id
  }
  const enrol = (c: Client, id: string, body: unknown) => c.post(`/api/leagues/${id}/schools`, Array.isArray(body) ? { schoolIds: body } : body)
  const codeOf = async (id: string): Promise<string> => (await t.db.query<{ invite_code: string }>(`select invite_code from leagues where id = $1`, [id]))[0]!.invite_code

  describe('guards', () => {
    it('answers 401 without a session on every route', async () => {
      for (const [m, url] of [
        ['get', '/api/leagues'],
        ['post', '/api/leagues'],
        ['post', '/api/leagues/join'],
        ['post', '/api/leagues/1/schools'],
        ['get', '/api/leagues/1'],
        ['get', '/api/sekolah-bersaing'],
      ] as const) {
        const res = await t.http()[m](url).send({})
        expectError(res, 'UNAUTHORIZED', 'Sesi anda telah tamat. Sila log masuk semula.')
        expect(res.status).toBe(401)
      }
    })

    it('answers CSRF_INVALID on a POST without the token', async () => {
      const s = await loginAs(t, ACCOUNTS.student)
      expectCsrfInvalid(await s.noCsrf.post('/api/leagues', VALID))
      expectCsrfInvalid(await s.noCsrf.post('/api/leagues/join', { invite_code: 'TEST2026' }))
      const a = await loginAs(t, ACCOUNTS.admin)
      expectCsrfInvalid(await a.noCsrf.post('/api/leagues', VALID))
      expectCsrfInvalid(await a.noCsrf.post('/api/leagues/1/schools', { schoolIds: ['1'] }))
    })
  })

  describe('list (M16-46) and detail (M16-49) of the seeded leagues', () => {
    it('mine = leagues with the caller school, open = every league not ended, with school counts', async () => {
      const s = await loginAs(t, ACCOUNTS.student) // DEMO001
      const res = await s.get('/api/leagues')
      expect(res.status).toBe(200)
      const list = parseData(res, GamesLeagueListSchema)
      expect(list.mine.map((l) => l.name)).toEqual(['Liga Sejarah 2026 5ST', 'Liga Matematik Sprint Test'])
      // The status is derived by date: at the test clock (19 October 2026) both seeded leagues are past their end date.
      expect(list.open.map((l) => l.name)).toEqual([])
      const sejarah = list.mine[0]!
      expect(sejarah).toMatchObject({ status: 'ended', statusLabel: 'Tamat', scopeLabel: 'Sekolah', typeLabel: 'Persahabatan', subjectName: expect.any(String), startDate: '2026-03-31', endDate: '2026-04-01', schools: 3 })
      expect(list.mine[1]).toMatchObject({ status: 'ended', statusLabel: 'Tamat', schools: 2 })
    })

    it('a school outside every league has an empty mine', async () => {
      const s = await loginSchool('demo002') // DEMO002 is in league 1
      const mine = parseData(await s.get('/api/leagues'), GamesLeagueListSchema).mine
      expect(mine.map((l) => l.name)).toEqual(['Liga Sejarah 2026 5ST'])
      const a = await loginAs(t, ACCOUNTS.admin) // no school
      expect(parseData(await a.get('/api/leagues'), GamesLeagueListSchema).mine).toEqual([])
    })

    it('detail: fields, no invite code, share link or canJoin, stored standings only for levels with rows, no-store', async () => {
      const s = await loginSchool('demo003') // not in league 2
      const list = parseData(await s.get('/api/leagues'), GamesLeagueListSchema)
      const ended = (await loginAs(t, ACCOUNTS.student)).get
      const mathId = parseData(await ended('/api/leagues'), GamesLeagueListSchema).mine[1]!.id
      const res = await s.get(`/api/leagues/${mathId}`)
      expect(res.status).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      const d = parseData(res, GamesLeagueDetailSchema)
      expect(d).toMatchObject({ name: 'Liga Matematik Sprint Test', classLevels: ['T4', 'T5'], scoringLabel: 'Jumlah Markah' })
      for (const key of ['inviteCode', 'shareUrl', 'canJoin']) expect(Object.keys((res.body as { data: object }).data)).not.toContain(key)
      expect(d.creatorName).not.toBe('')
      expect(d.schools).toHaveLength(2)
      expect(Object.keys(d.standings).sort()).toEqual(['T4', 'T5'])
      expect(d.standings.T4!.map((r) => [r.rank, r.peserta, r.skor, r.purata])).toEqual([
        [1, 8, 2935, 77.2],
        [2, 0, 0, 0],
      ])
      expect(d.standings.T4![0]!.ppdState).toContain('Selangor')
      // League 1 has no stored standing rows, as live.
      const sejarah = list.mine[0]! // demo003 is in league 1 only
      const d1 = parseData(await s.get(`/api/leagues/${sejarah.id}`), GamesLeagueDetailSchema)
      expect(d1.standings).toEqual({})
    })

    it('a non-numeric, huge or unknown id is 404 "Liga tidak dijumpai."', async () => {
      const s = await loginAs(t, ACCOUNTS.student)
      for (const id of ['abc', 'join-x', '1e3', '-1', '99999999999999999999999', '999999', '%20', '0x1']) {
        const res = await s.get(`/api/leagues/${id}`)
        expectError(res, 'NOT_FOUND', M.leagueNotFound)
      }
    })
  })

  describe('create (M16-47, API-ADM-25)', () => {
    it('FR-GM-15.1: pupil, teacher and school admin get 403 "Anda tidak dibenarkan melakukan tindakan ini." and nothing is stored', async () => {
      const [before] = await t.db.query<{ n: string }>(`select count(*)::text as n from leagues`)
      for (const email of [ACCOUNTS.student, ACCOUNTS.teacher, ACCOUNTS.schoolAdmin]) {
        const s = await loginAs(t, email)
        const res = await s.post('/api/leagues', VALID)
        expectError(res, 'FORBIDDEN', 'Anda tidak dibenarkan melakukan tindakan ini.')
        expect(res.status).toBe(403)
      }
      const [after] = await t.db.query<{ n: string }>(`select count(*)::text as n from leagues`)
      expect(after!.n).toBe(before!.n)
    })

    it('201 answers the league detail: upcoming, 8-character code kept internally, NO school joins, optional fields stored', async () => {
      const s = await loginAs(t, ACCOUNTS.admin)
      const res = await s.post('/api/leagues', { ...VALID, levelIds: [5, 1, 5], schoolLimit: 5 })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const created = parseData(res, GamesLeagueDetailSchema) // 201 answers the league detail, as GET /api/leagues/:id
      const { id } = created
      const d = parseData(await s.get(`/api/leagues/${id}`), GamesLeagueDetailSchema)
      expect(created).toEqual(d)
      for (const key of ['inviteCode', 'shareUrl', 'canJoin']) expect(Object.keys((res.body as { data: object }).data)).not.toContain(key)
      expect(d).toMatchObject({ name: 'Liga Contoh', status: 'upcoming', typeLabel: 'Liga', scopeLabel: 'Kebangsaan', subjectName: null, classLevels: ['T1', 'T5'] })
      expect(d.schools).toEqual([])
      expect(d.creatorName).not.toBe('')
      expect(await codeOf(id)).toMatch(INVITE)
      const [row] = await t.db.query<{ n: string }>(`select count(*)::text as n from league_schools where league_id = $1`, [id])
      expect(row!.n).toBe('0')
    })

    it('trims the name and accepts no subject and no cap', async () => {
      const a = await loginAs(t, ACCOUNTS.admin)
      const res = await a.post('/api/leagues', { ...VALID, name: '  Liga Tanpa Sekolah  ', subjectId: null })
      expect(res.status).toBe(201)
      const d = parseData(await a.get(`/api/leagues/${parseData(res, GamesLeagueDetailSchema).id}`), GamesLeagueDetailSchema)
      expect(d.name).toBe('Liga Tanpa Sekolah')
      expect(d.schools).toEqual([])
    })

    it('refuses type tournament (a tournament has its own route) with 422 under type', async () => {
      const a = await loginAs(t, ACCOUNTS.admin)
      expect422(await a.post('/api/leagues', { ...VALID, type: 'tournament' }), 'type', M.leagueFormat)
      for (const type of ['friendly', 'league']) expect((await a.post('/api/leagues', { ...VALID, type })).status).toBe(201)
    })

    it('stores a valid subject_id and rejects an unknown one', async () => {
      const s = await loginAs(t, ACCOUNTS.admin)
      const [subject] = await t.db.query<{ id: string; name: string }>(`select id::text, name from subjects where code = 'MATH'`)
      const ok = await s.post('/api/leagues', { ...VALID, subjectId: subject!.id })
      expect(ok.status).toBe(201)
      const d = parseData(await s.get(`/api/leagues/${parseData(ok, GamesLeagueDetailSchema).id}`), GamesLeagueDetailSchema)
      expect(d.subjectName).toBe(subject!.name)
      for (const bad of ['999999', 'abc', 12]) {
        expect422(await s.post('/api/leagues', { ...VALID, subjectId: bad }), 'subjectId', M.leagueSubject)
      }
    })

    it('invite codes are unique and random (CSPRNG, not a function of user and clock)', async () => {
      const s = await loginAs(t, ACCOUNTS.admin)
      const codes = new Set<string>()
      for (let i = 0; i < 6; i++) codes.add(await codeOf(await createAs(s, { name: `Liga ${String(i)}` })))
      expect(codes.size).toBe(6)
      for (const c of codes) expect(c).toMatch(INVITE)
    })

    it('required fields: "Sila lengkapkan semua medan wajib." with the field; out-of-range enums "Format tidak sah."', async () => {
      const s = await loginAs(t, ACCOUNTS.admin)
      for (const field of ['name', 'type', 'scope', 'mode', 'scoring', 'schoolLimit', 'levelIds', 'start', 'end']) {
        const { [field]: _omit, ...rest } = VALID as Record<string, unknown>
        void _omit
        expect422(await s.post('/api/leagues', rest), field, M.leagueRequired)
      }
      expect422(await s.post('/api/leagues', { ...VALID, name: '   ' }), 'name', M.leagueRequired)
      expect422(await s.post('/api/leagues', { ...VALID, name: 'x'.repeat(101) }), 'name', M.leagueRequired)
      expect((await s.post('/api/leagues', { ...VALID, name: 'x'.repeat(100) })).status).toBe(201)
      expect422(await s.post('/api/leagues', { ...VALID, levelIds: [] }), 'levelIds', M.leagueRequired)
      expect422(await s.post('/api/leagues', { ...VALID, start: '2026-02-30' }), 'start', M.leagueRequired)
      // Present but out of range: "Format tidak sah."
      for (const field of ['type', 'scope', 'mode', 'scoring']) expect422(await s.post('/api/leagues', { ...VALID, [field]: 'bogus' }), field, M.leagueFormat)
      expect422(await s.post('/api/leagues', { ...VALID, type: 'tournament' }), 'type', M.leagueFormat)
      expect422(await s.post('/api/leagues', {}), 'name', M.leagueRequired)
      expect422(await s.post('/api/leagues', [] as unknown as object), 'name', M.leagueRequired)
    })

    it('end before start, schoolLimit range and levelIds', async () => {
      const s = await loginAs(t, ACCOUNTS.admin)
      expect422(await s.post('/api/leagues', { ...VALID, start: '2026-12-01', end: '2026-11-30' }), 'end', M.leagueEndBeforeStart)
      expect((await s.post('/api/leagues', { ...VALID, start: '2026-11-30', end: '2026-11-30' })).status).toBe(201)
      for (const bad of [1, 501, 2.5, 'x', -3, null]) {
        expect422(await s.post('/api/leagues', { ...VALID, schoolLimit: bad }), 'schoolLimit', M.leagueMaxSchools)
      }
      for (const ok of [2, 500]) expect((await s.post('/api/leagues', { ...VALID, schoolLimit: ok })).status).toBe(201)
      for (const bad of [[0], [6], [1.5], ['T4'], [4, 9], 'T4', [1, 2, 3, 4, 5, 1]]) {
        expect422(await s.post('/api/leagues', { ...VALID, levelIds: bad }), 'levelIds', M.leagueClassLevels)
      }
    })

    it('validation order: the top-level message is the FIRST failing field in form order (name, type, scope, mode, scoring, schoolLimit, subjectId, levelIds, start, end)', async () => {
      const s = await loginAs(t, ACCOUNTS.admin)
      const res = await s.post('/api/leagues', { ...VALID, name: '', start: '2026-12-01', end: '2026-11-01', schoolLimit: 1, subjectId: '999999', levelIds: [9] })
      expect422(res, 'name', M.leagueRequired)
      const f = ErrorBodySchema.parse(res.body).error.fields!
      expect(f).toMatchObject({ name: M.leagueRequired, end: M.leagueEndBeforeStart, schoolLimit: M.leagueMaxSchools, levelIds: M.leagueClassLevels })
      // Without a name error the form order gives schoolLimit, then levelIds, then the dates.
      const r2 = await s.post('/api/leagues', { ...VALID, start: '2026-12-01', end: '2026-11-01', schoolLimit: 1, levelIds: [9] })
      expect422(r2, 'schoolLimit', M.leagueMaxSchools)
      const r3 = await s.post('/api/leagues', { ...VALID, start: '2026-12-01', end: '2026-11-01', levelIds: [9] })
      expect422(r3, 'levelIds', M.leagueClassLevels)
      const r4 = await s.post('/api/leagues', { ...VALID, start: '2026-12-01', end: '2026-11-01' })
      expect422(r4, 'end', M.leagueEndBeforeStart)
      // An unknown subject sits in the same set: subjectId comes before levelIds in the form order.
      const r5 = await s.post('/api/leagues', { ...VALID, subjectId: '999999', levelIds: [9] })
      expect422(r5, 'subjectId', M.leagueSubject)
      expect(ErrorBodySchema.parse(r5.body).error.fields).toMatchObject({ subjectId: M.leagueSubject, levelIds: M.leagueClassLevels })
    })
  })

  describe('join (M16-48): closed in R1 (AC-GM-15.2, API-GAME-05)', () => {
    it('AC-GM-15.2: POST /api/leagues/join answers 403 FORBIDDEN for pupil, teacher, school admin and admin, with every body', async () => {
      const [before] = await t.db.query<{ n: string }>(`select count(*)::text as n from league_schools`)
      for (const email of [ACCOUNTS.student, ACCOUNTS.teacher, ACCOUNTS.schoolAdmin, ACCOUNTS.admin]) {
        const s = await loginAs(t, email)
        for (const body of [{ invite_code: 'RMU4VCBS' }, { invite_code: 'NOPE0000' }, undefined]) {
          const res = await s.post('/api/leagues/join', body)
          expectError(res, 'FORBIDDEN', 'Anda tidak dibenarkan melakukan tindakan ini.')
          expect(res.status).toBe(403)
        }
      }
      const [after] = await t.db.query<{ n: string }>(`select count(*)::text as n from league_schools`)
      expect(after!.n).toBe(before!.n)
    })

    it('a missing CSRF token is still CSRF_INVALID', async () => {
      expectCsrfInvalid(await (await loginAs(t, ACCOUNTS.admin)).noCsrf.post('/api/leagues/join', { invite_code: 'RMU4VCBS' }))
    })
  })

  describe('enrol schools (API-ADM-25, FR-GM-15.1, AC-MUR-23-4)', () => {
    it('AC-MUR-23-4: pupil, teacher and school admin get 403 and nothing is enrolled', async () => {
      const admin = await loginAs(t, ACCOUNTS.admin)
      const id = await createAs(admin)
      const d2 = await schoolIdOf('DEMO002')
      for (const email of [ACCOUNTS.student, ACCOUNTS.teacher, ACCOUNTS.schoolAdmin]) {
        const res = await enrol(await loginAs(t, email), id, [d2])
        expectError(res, 'FORBIDDEN', 'Anda tidak dibenarkan melakukan tindakan ini.')
        expect(res.status).toBe(403)
      }
      expect(parseData(await admin.get(`/api/leagues/${id}`), GamesLeagueDetailSchema).schools).toEqual([])
    })

    it('FR-GM-15.1: the admin enrols schools in the given order and gets the league detail', async () => {
      const admin = await loginAs(t, ACCOUNTS.admin)
      const id = await createAs(admin)
      const [d3, d2] = [await schoolIdOf('DEMO003'), await schoolIdOf('DEMO002')]
      const res = await enrol(admin, id, [d3, d2])
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const d = parseData(res, GamesLeagueDetailSchema)
      expect(d.id).toBe(id)
      expect(d.schools.map((x) => x.id)).toEqual([d3, d2])
      expect(Object.keys((res.body as { data: object }).data)).not.toContain('inviteCode')
      // The pupil of an enrolled school sees the league under "mine"; there is no join control.
      expect(parseData(await (await loginSchool('demo002')).get('/api/leagues'), GamesLeagueListSchema).mine.map((l) => l.id)).toContain(id)
    })

    it('FR-GM-15.1: a school is enrolled once: "Sekolah ini sudah menyertai liga ini." under schoolIds, and nothing of the call is kept', async () => {
      const admin = await loginAs(t, ACCOUNTS.admin)
      const id = await createAs(admin)
      const [d2, d3] = [await schoolIdOf('DEMO002'), await schoolIdOf('DEMO003')]
      expect((await enrol(admin, id, [d2])).status).toBe(200)
      expect422(await enrol(admin, id, [d2]), 'schoolIds', M.leagueAlreadyIn)
      expect422(await enrol(admin, id, [d3, d2]), 'schoolIds', M.leagueAlreadyIn)
      expect(parseData(await admin.get(`/api/leagues/${id}`), GamesLeagueDetailSchema).schools.map((x) => x.id)).toEqual([d2])
    })

    it('"Liga ini sudah tamat." is judged by end_date against the clock, not the stored status', async () => {
      const admin = await loginAs(t, ACCOUNTS.admin)
      const d2 = await schoolIdOf('DEMO002')
      // Seeded league 1 ended on 2026-04-01 but its stored status is still `upcoming`; league 2 is stored `ended`.
      const [one] = await t.db.query<{ id: string; status: string }>(`select id::text as id, status from leagues where invite_code = 'RMU4VCBS'`)
      expect(one!.status).toBe('upcoming')
      expect422(await enrol(admin, one!.id, [d2]), 'schoolIds', M.leagueEnded)
      const [two] = await t.db.query<{ id: string }>(`select id::text as id from leagues where invite_code = 'TEST2026'`)
      expect422(await enrol(admin, two!.id, [d2]), 'schoolIds', M.leagueEnded)
      // A league whose stored status says `ended` but whose end date has not passed is still open.
      const open = await createAs(admin)
      await t.db.query(`update leagues set status = 'ended' where id = $1`, [open])
      expect((await enrol(admin, open, [d2])).status).toBe(200)
    })

    it('the end date counts through 23:59:59 Malaysia time', async () => {
      const admin = await loginAs(t, ACCOUNTS.admin)
      const d2 = await schoolIdOf('DEMO002')
      const today = await createAs(admin, { start: '2026-10-19', end: '2026-10-19' })
      expect((await enrol(admin, today, [d2])).status).toBe(200) // the clock is 19 Oct 09:00 MYT
      const yesterday = await createAs(admin, { start: '2026-10-18', end: '2026-10-18' })
      expect422(await enrol(admin, yesterday, [d2]), 'schoolIds', M.leagueEnded)
    })

    it('"Liga ini sudah penuh." when the cap is reached; the first failing school in order decides and the call is all or nothing', async () => {
      const admin = await loginAs(t, ACCOUNTS.admin)
      const id = await createAs(admin, { schoolLimit: 2 })
      const [d1, d2, d3, d4] = [await schoolIdOf('DEMO001'), await schoolIdOf('DEMO002'), await schoolIdOf('DEMO003'), await schoolIdOf('DEMO004')]
      expect422(await enrol(admin, id, [d1, d2, d3]), 'schoolIds', M.leagueFull)
      expect(parseData(await admin.get(`/api/leagues/${id}`), GamesLeagueDetailSchema).schools).toEqual([])
      expect((await enrol(admin, id, [d1, d2])).status).toBe(200)
      expect422(await enrol(admin, id, [d3]), 'schoolIds', M.leagueFull)
      // Order decides: an enrolled school before a school that would not fit reports "already in".
      expect422(await enrol(admin, id, [d1, d4]), 'schoolIds', M.leagueAlreadyIn)
      expect422(await enrol(admin, id, [d4, d1]), 'schoolIds', M.leagueFull)
    })

    it('a repeated school in one body is "already in"; an upcoming league can be enrolled; hidden primary rows count toward the limit', async () => {
      const admin = await loginAs(t, ACCOUNTS.admin)
      const id = await createAs(admin, { schoolLimit: 2 })
      const [d2, d3, d4] = [await schoolIdOf('DEMO002'), await schoolIdOf('DEMO003'), await schoolIdOf('DEMO004')]
      expect422(await enrol(admin, id, [d2, d2]), 'schoolIds', M.leagueAlreadyIn)
      expect(parseData(await admin.get(`/api/leagues/${id}`), GamesLeagueDetailSchema).schools).toEqual([]) // all or nothing
      // A primary school is accepted (no refusal), hidden from the detail, and still takes a seat.
      await t.db.query(`update schools set type = 'SK' where code = 'DEMO004'`)
      try {
        expect((await enrol(admin, id, [d4, d2])).status).toBe(200)
        expect(parseData(await admin.get(`/api/leagues/${id}`), GamesLeagueDetailSchema).schools.map((x) => x.id)).toEqual([d2])
        expect422(await enrol(admin, id, [d3]), 'schoolIds', M.leagueFull)
      } finally {
        await t.db.query(`update schools set type = 'SMK' where code = 'DEMO004'`)
      }
    })

    it('an empty or missing list is "Sila pilih sekolah."; a non-numeric or unknown school id is "Format sekolah tidak sah."; nothing is written', async () => {
      const admin = await loginAs(t, ACCOUNTS.admin)
      const id = await createAs(admin)
      const d2 = await schoolIdOf('DEMO002')
      for (const body of [{ schoolIds: [] }, {}, undefined]) expect422(await enrol(admin, id, body), 'schoolIds', 'Sila pilih sekolah.')
      for (const body of [{ schoolIds: ['99999999'] }, { schoolIds: [d2, '99999999'] }, { schoolIds: ['abc'] }, { schoolIds: 'x' }, { schoolIds: [d2, 5] }]) {
        expect422(await enrol(admin, id, body), 'schoolIds', 'Format sekolah tidak sah.')
      }
      expect(parseData(await admin.get(`/api/leagues/${id}`), GamesLeagueDetailSchema).schools).toEqual([])
    })

    it('order: 404, then body validation (empty, non-numeric, unknown id, over 500), then ended, then per school', async () => {
      const admin = await loginAs(t, ACCOUNTS.admin)
      const fmt = 'Format sekolah tidak sah.'
      const d2 = await schoolIdOf('DEMO002')
      const [two] = await t.db.query<{ id: string }>(`select id::text as id from leagues where invite_code = 'TEST2026'`)
      // An ended league: the body checks come first, "ended" only for a valid body.
      expect422(await enrol(admin, two!.id, { schoolIds: [] }), 'schoolIds', 'Sila pilih sekolah.')
      expect422(await enrol(admin, two!.id, [d2, '99999999']), 'schoolIds', fmt) // unknown id, not "tamat"
      expect422(await enrol(admin, two!.id, [d2]), 'schoolIds', M.leagueEnded)
      expectError(await enrol(admin, '999999', { schoolIds: [] }), 'NOT_FOUND', M.leagueNotFound)
      // An open league: [already enrolled, unknown] is a format error and nothing is written.
      const id = await createAs(admin)
      expect((await enrol(admin, id, [d2])).status).toBe(200)
      expect422(await enrol(admin, id, [d2, '99999999']), 'schoolIds', fmt)
      expect(parseData(await admin.get(`/api/leagues/${id}`), GamesLeagueDetailSchema).schools.map((x) => x.id)).toEqual([d2])
    })

    it('more than 500 school ids is "Format sekolah tidak sah." under schoolIds', async () => {
      const admin = await loginAs(t, ACCOUNTS.admin)
      const id = await createAs(admin)
      const ids = Array.from({ length: 501 }, (_, i) => String(900000 + i))
      expect422(await enrol(admin, id, ids), 'schoolIds', 'Format sekolah tidak sah.')
    })

    it('an unknown or non-numeric league id is 404 "Liga tidak dijumpai."', async () => {
      const admin = await loginAs(t, ACCOUNTS.admin)
      const d2 = await schoolIdOf('DEMO002')
      for (const id of ['999999', 'abc', '1e3', '-1', '99999999999999999999999']) {
        expectError(await enrol(admin, id, [d2]), 'NOT_FOUND', M.leagueNotFound)
      }
    })

    it('concurrent enrolments never exceed max_schools', async () => {
      const admin = await loginAs(t, ACCOUNTS.admin)
      const id = await createAs(admin, { schoolLimit: 3 })
      const ids = [await schoolIdOf('DEMO001'), await schoolIdOf('DEMO002'), await schoolIdOf('DEMO003'), await schoolIdOf('DEMO004')]
      // 8 requests (two per school) race for 3 seats.
      const results = await Promise.all(ids.flatMap((sid) => [enrol(admin, id, [sid]), enrol(admin, id, [sid])]))
      const statuses = results.map((r) => r.status)
      expect(statuses.filter((s) => s === 200)).toHaveLength(3)
      expect(statuses.filter((s) => s === 422)).toHaveLength(5)
      const [row] = await t.db.query<{ n: string }>(`select count(*)::text as n from league_schools where league_id = $1`, [id])
      expect(row!.n).toBe('3')
      for (const r of results.filter((x) => x.status === 422)) {
        expect([M.leagueFull, M.leagueAlreadyIn]).toContain(ErrorBodySchema.parse(r.body).error.message)
      }
    })
  })

  describe('Sekolah Bersaing (API-AS-14, S7-T02)', () => {
    const board = async (q = '') => {
      const s = await loginAs(t, ACCOUNTS.schoolAdmin)
      const res = await s.get(`/api/sekolah-bersaing${q}`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      return parseData(res, GamesSekolahBersaingBoardSchema)
    }
    const pupilsOf = async (code: string, n: number) => {
      const rows = await t.db.query<{ id: string }>(
        `select u.id::text as id from users u join schools s on s.id = u.school_id join user_roles r on r.user_id = u.id and r.role = 'student'
          where s.code = $1 order by u.id limit $2`,
        [code, n],
      )
      expect(rows, code).toHaveLength(n)
      await t.db.query(`update users set grade = 10, is_active = true where id = any($1::bigint[])`, [rows.map((r) => r.id)])
      return rows.map((r) => r.id)
    }
    const session = (userId: string, count: number, correct: number) =>
      t.db.query(
        `insert into practice_sessions (user_id, mode, question_count, correct_count, status, started_at, completed_at)
         values ($1, 'random', $2, $3, 'completed', '2026-10-01T00:00:00Z', '2026-10-01T00:10:00Z')`,
        [userId, count, correct],
      )
    const clear = () => t.db.query(`delete from practice_sessions`)

    afterEach(clear)

    it('AC-AS-45-2: no sessions: an empty array and 200, even with a stored weekly row present (DM-31)', async () => {
      // The seed no longer writes weekly rows (S7-T02); one legacy row is stored here to prove the board ignores it.
      await t.db.query(
        `insert into sekolah_bersaing_weeks (week_start, rank, school_id, aktif_pct, streak_avg, nota_per_10, is_anonymous)
         select '2026-09-21', 1, id, 0, 9.3, 0, false from schools where code = 'DEMO001'`,
      )
      try {
        const weekly = await t.db.query<{ n: string }>(`select count(*)::text as n from sekolah_bersaing_weeks`)
        expect(weekly[0]!.n).toBe('1')
        expect(await board()).toEqual([])
      } finally {
        await t.db.query(`delete from sekolah_bersaing_weeks`)
      }
    })

    it('AC-AS-45-1: the mean of session accuracy per school, in order, with the register name and state', async () => {
      for (const id of await pupilsOf('DEMO002', 3)) await session(id, 10, 6)
      const a = await pupilsOf('DEMO003', 5)
      for (const id of a) await session(id, 10, 8)
      const rows = await t.db.query<{ name: string; state: string }>(`select name, state from schools where code in ('DEMO003', 'DEMO002') order by code desc`)
      expect(await board()).toEqual([
        { rank: 1, school: rows[0]!.name, state: rows[0]!.state, accuracy: 80, pupils: 5 },
        { rank: 2, school: rows[1]!.name, state: rows[1]!.state, accuracy: 60, pupils: 3 },
      ])
    })

    it('FR-AS-45-1: a mean of sessions, not pooled answers; a school with no session is absent; a primary school is left out', async () => {
      const [id] = await pupilsOf('DEMO002', 1)
      await session(id!, 2, 1) // 50
      await session(id!, 10, 9) // 90, pooled would be 83.3
      expect((await board()).map((r) => [r.accuracy, r.pupils])).toEqual([[70, 1]])
      await t.db.query(`update schools set type = 'SK' where code = 'DEMO002'`)
      expect(await board()).toEqual([])
      await t.db.query(`update schools set type = 'SMK' where code = 'DEMO002'`)
    })

    it('FR-AS-45-3: an unknown query parameter is ignored', async () => {
      const [id] = await pupilsOf('DEMO002', 1)
      await session(id!, 10, 5)
      const expected = await board()
      expect(expected).toHaveLength(1)
      for (const q of ['?week=abc', '?week=2026-09-21', '?foo=1']) expect(await board(q), q).toEqual(expected)
    })

    it('OQ-API-09: school admin and admin read the same board; pupil and teacher get 403', async () => {
      const [id] = await pupilsOf('DEMO002', 1)
      await session(id!, 10, 5)
      const a = parseData(await (await loginAs(t, ACCOUNTS.admin)).get('/api/sekolah-bersaing'), GamesSekolahBersaingBoardSchema)
      expect(a).toEqual(await board())
      for (const who of [ACCOUNTS.student, ACCOUNTS.teacher]) {
        const res = await (await loginAs(t, who)).get('/api/sekolah-bersaing')
        expect(res.status, who).toBe(403)
        expectError(res, 'FORBIDDEN')
      }
    })
  })

  describe('rankSekolahBersaing (FR-AS-45-6, FR-GM-16.4)', () => {
    const OPTIONS = { minPupils: 1, topN: 30 }
    const fact = (schoolId: string, accuracy: number, pupils = 1, sessions = 1) => ({ schoolId, accuracy, pupils, sessions })
    const school = (id: string, name = `Sekolah ${id}`) => ({ id, name, state: 'Johor' })

    it('AC-AS-45-6: equal accuracy: more pupils first, then more sessions, then school name', () => {
      const schools = [school('1', 'SMK Zapin'), school('2', 'SMK Bakti'), school('3', 'SMK Cempaka'), school('4', 'SMK Delima')]
      const out = rankSekolahBersaing([fact('1', 70, 40, 9), fact('2', 70, 40, 9), fact('3', 70, 40, 12), fact('4', 70, 50, 1)], schools, OPTIONS)
      expect(out.map((r) => r.school)).toEqual(['SMK Delima', 'SMK Cempaka', 'SMK Bakti', 'SMK Zapin'])
      expect(out.map((r) => r.rank)).toEqual([1, 2, 3, 4])
    })

    it('the order uses the unrounded accuracy; the wire carries one decimal', () => {
      const out = rankSekolahBersaing([fact('1', 66.66, 1), fact('2', 66.68, 1)], [school('1'), school('2')], OPTIONS)
      expect(out.map((r) => [r.school, r.accuracy])).toEqual([['Sekolah 2', 66.7], ['Sekolah 1', 66.7]])
    })

    it('AC-AS-45-3: 40 schools give exactly 30 rows', () => {
      const ids = Array.from({ length: 40 }, (_, i) => String(i + 1))
      const out = rankSekolahBersaing(ids.map((id, i) => fact(id, i)), ids.map((id) => school(id)), OPTIONS)
      expect(out).toHaveLength(30)
      expect(out[0]).toMatchObject({ rank: 1, accuracy: 39 })
      expect(out[29]).toMatchObject({ rank: 30, accuracy: 10 })
    })

    it('AC-GM-16.5: one pupil is listed with minimum 1 and absent with minimum 5', () => {
      expect(rankSekolahBersaing([fact('1', 80, 1)], [school('1')], OPTIONS)).toHaveLength(1)
      expect(rankSekolahBersaing([fact('1', 80, 1)], [school('1')], { ...OPTIONS, minPupils: 5 })).toEqual([])
    })

    it('a school outside the given list is left out', () => {
      expect(rankSekolahBersaing([fact('9', 80)], [school('1')], OPTIONS)).toEqual([])
    })
  })

  describe('Mod Pelajar (is_test)', () => {
    it('Mod Pelajar acts as a pupil: an admin in Mod Pelajar gets 403 on create and enrol, so no test league is made through the API', async () => {
      const mod = await loginAs(t, ACCOUNTS.admin, { mod: true })
      expectError(await mod.post('/api/leagues', VALID), 'FORBIDDEN', 'Anda tidak dibenarkan melakukan tindakan ini.')
      const admin = await loginAs(t, ACCOUNTS.admin)
      const id = await createAs(admin)
      expectError(await enrol(mod, id, [await schoolIdOf('DEMO002')]), 'FORBIDDEN', 'Anda tidak dibenarkan melakukan tindakan ini.')
    })

    it('a test league (is_test) is hidden from normal callers, so Admin Pusat cannot enrol into it (404); its test rows still count toward capacity of a real league', async () => {
      const [row] = await t.db.query<{ id: string }>(
        `insert into leagues (name, type, scope, game_mode, scoring_method, start_date, end_date, invite_code, status, is_test, created_at)
         values ('Liga Ujian Mod', 'league', 'national', 'mixed', 'total_score', '2026-11-01', '2026-11-30', 'UJIMOD01', 'upcoming', true, now()) returning id::text as id`,
      )
      const admin = await loginAs(t, ACCOUNTS.admin)
      expectError(await enrol(admin, row!.id, [await schoolIdOf('DEMO002')]), 'NOT_FOUND', M.leagueNotFound)
      // A test membership of a real league is hidden from the school counts but still takes a seat.
      const id = await createAs(admin, { name: 'Liga Kapasiti', schoolLimit: 2 })
      expect((await enrol(admin, id, [await schoolIdOf('DEMO001')])).status).toBe(200)
      await t.db.query(`insert into league_schools (league_id, school_id, is_test, joined_at) values ($1, $2::bigint, true, now())`, [id, await schoolIdOf('DEMO002')])
      expect(parseData(await admin.get(`/api/leagues/${id}`), GamesLeagueDetailSchema).schools).toHaveLength(1)
      expect422(await enrol(admin, id, [await schoolIdOf('DEMO003')]), 'schoolIds', M.leagueFull)
    })
  })

  describe('rate limit (D57)', () => {
    it('429 RATE_LIMITED with Retry-After on the write routes, a refused CSRF is not counted', async () => {
      const limited = await bootGamesApp({ env: { THROTTLE_GAMES_WRITE_PER_MINUTE: '2' }, seeds: [gamesSeed] })
      try {
        const s = await loginAs(limited, ACCOUNTS.admin)
        expectCsrfInvalid(await s.noCsrf.post('/api/leagues', VALID))
        expect((await s.post('/api/leagues', VALID)).status).toBe(201)
        expect((await s.post('/api/leagues/1/schools', {})).status).toBe(422)
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
