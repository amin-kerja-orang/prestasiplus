import {
  ErrorBodySchema,
  GAMES_MESSAGES as M,
  GamesLeagueDetailSchema,
  GamesLeagueListSchema,
  GamesLeagueMeSchema,
  GamesLeagueStandingsSchema,
} from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { gamesSeed } from '../../../prisma/seed/games'
import { LeagueStandingsJob } from '../../../src/modules/battle/standings/league-standings.job'
import { LeaguesService } from '../../../src/modules/games/leagues/leagues.service'
import { ACCOUNTS, bootGamesApp, expectError, loginAs, parseData, type GamesTestApp } from '../helpers'

/** S7-T06 part 3: the hourly standings job (AC-GM-15.1, AC-GM-15.3, AC-GM-15.4) and API-GAME-13 (`standings`, `me`). */
describe('league standings job and API-GAME-13 (S7-T06 part 3)', () => {
  let t: GamesTestApp
  let svc: LeaguesService
  let mathId = ''
  let sejarahId = ''
  let otherId = ''

  beforeAll(async () => {
    t = await bootGamesApp({ seeds: [gamesSeed] })
    svc = t.app.get(LeaguesService, { strict: false })
    // The demo schools are primary by type; the board is secondary-only, so these four count as secondary.
    await t.db.query(`update schools set type = 'SMK' where code in ('DEMO001', 'DEMO002', 'DEMO003', 'DEMO004')`)
    await t.db.query(`update users set grade = 10 where email like 'murid.demo00%.01@example.test'`)
    mathId = (await t.db.query<{ id: string }>(`select id::text id from subjects where code = 'MATH'`))[0]!.id
    otherId = (await t.db.query<{ id: string }>(`select id::text id from subjects where code not in ('MATH', 'SEJ') order by id limit 1`))[0]!.id
    sejarahId = (await t.db.query<{ id: string }>(`select id::text id from subjects where code = 'SEJ'`))[0]!.id
  }, 180_000)
  afterAll(async () => {
    await t.close()
  })
  // Every test counts only the facts it inserts itself.
  beforeEach(async () => {
    await t.db.query(`delete from practice_answers`)
    await t.db.query(`delete from battle_participants`)
    await t.db.query(`delete from battles`)
    t.clock.set(NOW)
  })

  type Client = Awaited<ReturnType<typeof loginAs>>
  const NOW = '2026-10-19T09:00:00+08:00'
  const INSIDE = '2026-10-10T10:00:00+08:00'
  const schoolId = async (code: string): Promise<string> => (await t.db.query<{ id: string }>(`select id::text id from schools where code = $1`, [code]))[0]!.id
  const userOf = async (email: string): Promise<string> => (await t.db.query<{ id: string }>(`select id::text id from users where email = $1`, [email]))[0]!.id
  const demoPupil = (code: string) => `murid.${code.toLowerCase()}.01@example.test`

  let seq = 0
  /** A fresh pupil (role student) in a school at a grade (10 = T4, 11 = T5). */
  const addPupil = async (code: string, grade = 10): Promise<string> => {
    seq++
    const [u] = await t.db.query<{ id: string }>(
      `insert into users (name, school_id, grade) values ($1, (select id from schools where code = $2), $3) returning id::text id`,
      [`Murid Ujian ${String(seq)}`, code, grade],
    )
    await t.db.query(`insert into user_roles (user_id, role) values ($1::bigint, 'student')`, [u!.id])
    return u!.id
  }

  /** `correct` right and `wrong` wrong answers in one mode, at `at`. */
  const answers = async (userId: string, o: { correct: number; wrong?: number; mode?: string; at?: string; isTest?: boolean; subjectId?: string }) => {
    const total = o.correct + (o.wrong ?? 0)
    await t.db.query(
      `insert into practice_answers (user_id, subject_id, is_correct, answered_at, is_test, mode)
       select $1::bigint, $2::bigint, g <= $3, $4::timestamptz, $5, $6 from generate_series(1, $7) g`,
      [userId, o.subjectId ?? otherId, o.correct, o.at ?? INSIDE, o.isTest ?? false, o.mode ?? 'latih_tubi', total],
    )
  }

  /** One finished Battle between two pupils (side A wins unless `winner` says otherwise). */
  const battle = async (a: { user: string; score: number }, b: { user: string | null; score: number; bot?: boolean }, o: { at?: string; winner?: string | null; ranking?: boolean; isTest?: boolean } = {}) => {
    const [row] = await t.db.query<{ id: string }>(
      `insert into battles (mode, question_type, status, winner, finished_at, counts_for_ranking, is_test)
       values ('quick_match', 'biasa', 'finished', $1, $2::timestamptz, $3, $4) returning id::text id`,
      [o.winner === undefined ? 'A' : o.winner, o.at ?? INSIDE, o.ranking ?? true, o.isTest ?? false],
    )
    await t.db.query(`insert into battle_participants (battle_id, side, user_id, school_id, is_bot, score) values ($1::uuid, 'A', $2::bigint, (select school_id from users where id = $2::bigint), false, $3)`, [row!.id, a.user, a.score])
    await t.db.query(`insert into battle_participants (battle_id, side, user_id, school_id, is_bot, score) values ($1::uuid, 'B', $2::bigint, null, $3, $4)`, [row!.id, b.user, b.bot ?? false, b.score])
  }

  interface Opts {
    mode?: string
    scoring?: string
    levelIds?: number[]
    subjectId?: string | null
    start?: string
    end?: string
    schools?: string[]
  }
  /** Admin creates a league and enrols the schools; the dates are then moved by SQL (enrolling a past league is refused). */
  const makeLeague = async (o: Opts = {}): Promise<string> => {
    const admin = await loginAs(t, ACCOUNTS.admin)
    const res = await admin.post('/api/leagues', {
      name: `Liga Ujian ${String(++seq)}`,
      type: 'league',
      scope: 'national',
      mode: o.mode ?? 'quiz',
      scoring: o.scoring ?? 'total_score',
      schoolLimit: 50,
      levelIds: o.levelIds ?? [4, 5],
      start: '2026-10-01',
      end: '2026-10-31',
      ...(o.subjectId ? { subjectId: o.subjectId } : {}),
    })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = parseData(res, GamesLeagueDetailSchema).id
    const ids = await Promise.all((o.schools ?? ['DEMO001', 'DEMO002', 'DEMO003']).map(schoolId))
    const enrol = await admin.post(`/api/leagues/${id}/schools`, { schoolIds: ids })
    expect(enrol.status, JSON.stringify(enrol.body)).toBe(200)
    if (o.start || o.end) await t.db.query(`update leagues set start_date = $2::date, end_date = $3::date where id = $1::bigint`, [id, o.start ?? '2026-10-01', o.end ?? '2026-10-31'])
    return id
  }

  const run = (at: string = NOW) => svc.recomputeStandings(new Date(at))
  const standings = async (c: Client, id: string, level?: string) => {
    const res = await c.get(`/api/leagues/${id}/standings${level === undefined ? '' : `?level=${level}`}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return parseData(res, GamesLeagueStandingsSchema)
  }
  const me = async (c: Client, id: string) => {
    const res = await c.get(`/api/leagues/${id}/me`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return parseData(res, GamesLeagueMeSchema)
  }
  const pupilClient = (email: string) => loginAs(t, email)
  const expect422 = (res: { status: number; body: unknown }, field: string, message: string) => {
    expect(res.status, JSON.stringify(res.body)).toBe(422)
    const body = ErrorBodySchema.parse(res.body)
    expect(body.error.message).toBe(message)
    expect(body.error.fields?.[field]).toBe(message)
  }

  describe('AC-GM-15.1: points and contributors', () => {
    it('a pupil with 7 correct Latih Tubi answers is a contributor with 7 and the school score includes them', async () => {
      const id = await makeLeague()
      const pupil = await userOf(demoPupil('demo002'))
      await answers(pupil, { correct: 7, wrong: 3 })
      await run()
      const c = await pupilClient(demoPupil('demo002'))
      const m = await me(c, id)
      expect(m.mine).toEqual({ points: 7 })
      expect(m.contributors).toHaveLength(1)
      expect(m.contributors[0]).toMatchObject({ points: 7 })
      expect(m.contributors[0]!.name).not.toBe('')
      expect(m.school).toEqual({ rank: 1, score: 7, participants: 1 })
      const board = await standings(c, id)
      expect(board.rows[0]).toMatchObject({ rank: 1, score: 7, participants: 1, avgAccuracy: 70 })
      expect(board.frozen).toBe(false)
      expect(board.recomputedAt).toBe(new Date(NOW).toISOString())
    })

    it('quiz counts latih_tubi, chapter, databank and game; not other modes, is_test rows, other windows or other Tingkatan', async () => {
      const id = await makeLeague({ levelIds: [4] })
      const pupil = await addPupil('DEMO003')
      for (const mode of ['latih_tubi', 'chapter', 'databank', 'game']) await answers(pupil, { correct: 1, mode })
      for (const mode of ['kuiz', 'battle', 'simulasi']) await answers(pupil, { correct: 5, mode })
      await answers(pupil, { correct: 5, isTest: true })
      await answers(pupil, { correct: 5, at: '2026-09-30T23:59:59+08:00' })
      await answers(pupil, { correct: 5, at: '2026-11-01T00:00:00+08:00' })
      const wrongLevel = await addPupil('DEMO003', 11) // T5 is not a league level
      await answers(wrongLevel, { correct: 9 })
      await run()
      const rows = (await t.db.query<{ user_id: string; points: number }>(`select user_id::text, points from league_contributions where league_id = $1::bigint`, [id]))
      expect(rows).toEqual([{ user_id: pupil, points: 4 }])
    })

    it('the first and last second of the window count (start 00:00 MYT, end 23:59:59 MYT)', async () => {
      const id = await makeLeague()
      const pupil = await addPupil('DEMO003')
      await answers(pupil, { correct: 1, at: '2026-10-01T00:00:00+08:00' })
      await answers(pupil, { correct: 2, at: '2026-10-31T23:59:59+08:00' })
      await run()
      const [row] = await t.db.query<{ points: number }>(`select points from league_contributions where league_id = $1::bigint and user_id = $2::bigint`, [id, pupil])
      expect(row?.points).toBe(3)
    })

    it('the subject filter counts only answers of the league subject', async () => {
      const id = await makeLeague({ subjectId: mathId })
      const pupil = await addPupil('DEMO002')
      await answers(pupil, { correct: 4, subjectId: mathId })
      await answers(pupil, { correct: 6, subjectId: sejarahId })
      await answers(pupil, { correct: 8 }) // the default subject is neither
      await run()
      const [row] = await t.db.query<{ points: number }>(`select points from league_contributions where league_id = $1::bigint and user_id = $2::bigint`, [id, pupil])
      expect(row?.points).toBe(4)
    })

    it('multiplayer: round(score / 100) per real Battle; robot Battles, bot opponents and is_test Battles do not count', async () => {
      const id = await makeLeague({ mode: 'multiplayer' })
      const a = await addPupil('DEMO002')
      const b = await addPupil('DEMO003')
      await answers(a, { correct: 50 }) // quiz answers do not count in a multiplayer league
      await battle({ user: a, score: 340 }, { user: b, score: 120 }) // 3 points for a, 1 for b
      await battle({ user: a, score: 250 }, { user: b, score: 80 }) // 3 (2.5 rounds up) for a, 1 for b
      await battle({ user: a, score: 900 }, { user: null, score: 100, bot: true }, { ranking: false }) // robot Battle
      await battle({ user: a, score: 900 }, { user: null, score: 100, bot: true }) // a bot opponent, still counted for ranking = false in real data; excluded here too
      await battle({ user: a, score: 900 }, { user: b, score: 100 }, { isTest: true })
      await battle({ user: a, score: 900 }, { user: b, score: 100 }, { at: '2026-09-01T10:00:00+08:00' })
      await run()
      const rows = await t.db.query<{ user_id: string; points: number }>(`select user_id::text, points from league_contributions where league_id = $1::bigint order by points desc`, [id])
      expect(rows).toEqual([
        { user_id: a, points: 6 },
        { user_id: b, points: 2 },
      ])
    })

    it('mixed adds quiz and Battle points; wins scoring counts won real Battles', async () => {
      const mixed = await makeLeague({ mode: 'mixed' })
      const wins = await makeLeague({ mode: 'multiplayer', scoring: 'wins' })
      const a = await addPupil('DEMO002')
      const b = await addPupil('DEMO003')
      await answers(a, { correct: 7 })
      await battle({ user: a, score: 340 }, { user: b, score: 120 }) // a wins
      await battle({ user: a, score: 100 }, { user: b, score: 400 }, { winner: 'B' }) // b wins
      await battle({ user: a, score: 100 }, { user: b, score: 100 }, { winner: null }) // draw
      await run()
      const [mixedA] = await t.db.query<{ points: number }>(`select points from league_contributions where league_id = $1::bigint and user_id = $2::bigint`, [mixed, a])
      expect(mixedA?.points).toBe(7 + 3 + 1 + 1)
      const c = await pupilClient(ACCOUNTS.student)
      const board = await t.db.query<{ name: string; skor: string }>(
        `select s.name, ls.skor::text from league_standings ls join schools s on s.id = ls.school_id where ls.league_id = $1::bigint and ls.level = 'T4' order by ls.sort_order`,
        [wins],
      )
      expect(board.map((r) => [r.name, Number(r.skor)])).toEqual([
        [(await t.db.query<{ name: string }>(`select name from schools where code = 'DEMO002'`))[0]!.name, 1],
        [(await t.db.query<{ name: string }>(`select name from schools where code = 'DEMO003'`))[0]!.name, 1],
        [(await t.db.query<{ name: string }>(`select name from schools where code = 'DEMO001'`))[0]!.name, 0],
      ].sort((x, y) => (y[1] as number) - (x[1] as number) || String(x[0]).localeCompare(String(y[0]), 'ms')))
      void c
    })
  })

  describe('row order', () => {
    it('score desc, then participants desc, then school name asc; rank is assigned in that order', async () => {
      const id = await makeLeague({ schools: ['DEMO001', 'DEMO002', 'DEMO003', 'DEMO004'] })
      // DEMO004: 5 points from two pupils; DEMO002 and DEMO003: 5 from one pupil each; DEMO001: 9.
      await answers(await addPupil('DEMO004'), { correct: 3 })
      await answers(await addPupil('DEMO004'), { correct: 2 })
      await answers(await addPupil('DEMO002'), { correct: 5 })
      await answers(await addPupil('DEMO003'), { correct: 5 })
      await answers(await addPupil('DEMO001'), { correct: 9 })
      await run()
      const c = await pupilClient(demoPupil('demo002'))
      const rows = (await standings(c, id, '4')).rows
      const names = Object.fromEntries((await t.db.query<{ code: string; name: string }>(`select code, name from schools where code like 'DEMO00%'`)).map((r) => [r.code, r.name]))
      const tail = ['DEMO002', 'DEMO003'].map((code) => names[code]!).sort((a, b) => a.localeCompare(b, 'ms'))
      expect(rows.map((r) => [r.rank, r.schoolName, r.score, r.participants])).toEqual([
        [1, names.DEMO001, 9, 1],
        [2, names.DEMO004, 5, 2],
        [3, tail[0], 5, 1],
        [4, tail[1], 5, 1],
      ])
    })
  })

  describe('AC-GM-15.3: avg_accuracy needs 30 answers per school', () => {
    it('29 answers: the school is absent and me.school is null; 30 answers: ranked', async () => {
      const id = await makeLeague({ scoring: 'avg_accuracy' })
      const pupil = await userOf(demoPupil('demo002'))
      await answers(pupil, { correct: 20, wrong: 9 }) // 29 answers
      await run('2026-10-19T09:10:00+08:00')
      const c = await pupilClient(demoPupil('demo002'))
      expect((await standings(c, id, '4')).rows).toEqual([])
      const before = await me(c, id)
      expect(before.school).toBeNull()
      expect(before.mine).toEqual({ points: 20 })
      await answers(pupil, { correct: 1 }) // the 30th
      await run('2026-10-19T10:10:00+08:00')
      const after = await standings(c, id, '4')
      expect(after.rows).toHaveLength(1)
      expect(after.rows[0]).toMatchObject({ rank: 1, score: 70, avgAccuracy: 70, participants: 1 }) // 21 / 30
      expect((await me(c, id)).school).toEqual({ rank: 1, score: 70, participants: 1 })
    })

    it('the minimum is per school: answers of several pupils of one school add up', async () => {
      const id = await makeLeague({ scoring: 'avg_accuracy' })
      await answers(await addPupil('DEMO003'), { correct: 10, wrong: 5 })
      await answers(await addPupil('DEMO003'), { correct: 10, wrong: 5 })
      await run()
      const rows = (await standings(await pupilClient(demoPupil('demo003')), id, '4')).rows
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ score: 66.7, avgAccuracy: 66.7 })
    })
  })

  describe('AC-GM-15.4: derived status, final recompute and freeze', () => {
    it('status is derived at the boundary instants (start 00:00 and end 23:59:59 MYT)', async () => {
      const id = await makeLeague({ start: '2026-10-20', end: '2026-10-21' })
      const status = async () => {
        const c = await pupilClient(ACCOUNTS.student)
        const d = parseData(await c.get(`/api/leagues/${id}`), GamesLeagueDetailSchema)
        const card = parseData(await c.get('/api/leagues'), GamesLeagueListSchema).open.find((l) => l.id === id)
        return { detail: [d.status, d.statusLabel], open: card !== undefined }
      }
      t.clock.set('2026-10-19T23:59:59+08:00')
      expect(await status()).toEqual({ detail: ['upcoming', 'Akan Datang'], open: true })
      t.clock.set('2026-10-20T00:00:00+08:00')
      expect(await status()).toEqual({ detail: ['active', 'Aktif'], open: true })
      t.clock.set('2026-10-21T23:59:59+08:00')
      expect(await status()).toEqual({ detail: ['active', 'Aktif'], open: true })
      t.clock.set('2026-10-22T00:00:00+08:00')
      expect(await status()).toEqual({ detail: ['ended', 'Tamat'], open: false })
      t.clock.set(NOW)
    })

    it('an upcoming league is not computed', async () => {
      const id = await makeLeague({ start: '2026-11-01', end: '2026-11-30' })
      await run()
      const [row] = await t.db.query<{ n: string }>(`select count(*)::text n from league_standings where league_id = $1::bigint`, [id])
      expect(row?.n).toBe('0')
    })

    it('after the end date one final recompute sets frozen_at; a later run changes nothing', async () => {
      const id = await makeLeague({ end: '2026-10-14' })
      const pupil = await userOf(demoPupil('demo002'))
      await answers(pupil, { correct: 4 }) // INSIDE = 10 October
      // Before the end: the league is active and not frozen.
      const first = await svc.recomputeStandings(new Date('2026-10-14T23:00:00+08:00'))
      expect(first.frozen).toBe(0)
      t.clock.set('2026-10-14T23:30:00+08:00')
      const c = await pupilClient(demoPupil('demo002'))
      expect((await standings(c, id, '4')).frozen).toBe(false)
      // An answer inside the last hour is picked up by the final recompute.
      await answers(pupil, { correct: 2, at: '2026-10-14T23:45:00+08:00' })
      t.clock.set('2026-10-15T00:00:00+08:00')
      const board0 = await standings(c, id, '4')
      expect(board0.frozen).toBe(true) // derived ended, even before the job ran
      const final = await svc.recomputeStandings(new Date('2026-10-15T00:05:00+08:00'))
      expect(final.frozen).toBeGreaterThanOrEqual(1)
      const [l] = await t.db.query<{ frozen_at: Date | null }>(`select frozen_at from leagues where id = $1::bigint`, [id])
      expect(l?.frozen_at?.toISOString()).toBe(new Date('2026-10-15T00:05:00+08:00').toISOString())
      const frozenBoard = await standings(c, id, '4')
      expect(frozenBoard.rows[0]).toMatchObject({ score: 6, participants: 1 })
      expect(frozenBoard.recomputedAt).toBe(new Date('2026-10-15T00:05:00+08:00').toISOString())
      // Later: more answers and a new run (a later hour) change nothing.
      await answers(pupil, { correct: 10, at: '2026-10-14T12:00:00+08:00' })
      const again = await svc.recomputeStandings(new Date('2026-10-15T03:00:00+08:00'))
      expect(again).toEqual({ recomputed: 0, frozen: 0 })
      expect(await standings(c, id, '4')).toEqual(frozenBoard)
      expect((await me(c, id)).mine).toEqual({ points: 6 })
      t.clock.set(NOW)
    })

    it('the seeded ended league has frozen_at, so the job leaves the observed standings alone', async () => {
      const [seeded] = await t.db.query<{ id: string; frozen_at: Date | null }>(`select id::text id, frozen_at from leagues where invite_code = 'TEST2026'`)
      expect(seeded?.frozen_at).not.toBeNull()
      await run()
      const c = await pupilClient(ACCOUNTS.student)
      const d = parseData(await c.get(`/api/leagues/${seeded!.id}`), GamesLeagueDetailSchema)
      expect(d.standings.T4!.map((r) => [r.peserta, r.skor, r.purata])).toEqual([
        [8, 2935, 77.2],
        [0, 0, 0],
      ])
      const board = await standings(c, seeded!.id, '4')
      expect(board).toMatchObject({ recomputedAt: null, frozen: true })
      expect(board.rows[0]).toMatchObject({ score: 2935, participants: 8, avgAccuracy: 77.2 })
    })
  })

  describe('hourly idempotency', () => {
    it('two runs in one clock hour write once; the next hour writes again', async () => {
      const id = await makeLeague()
      const pupil = await userOf(demoPupil('demo002'))
      await answers(pupil, { correct: 2 })
      const stamp = async () =>
        (await t.db.query<{ at: Date; ids: string }>(`select max(recomputed_at) at, string_agg(id::text, ',' order by id) ids from league_standings where league_id = $1::bigint`, [id]))[0]!
      await run('2026-10-19T14:05:00+08:00')
      const first = await stamp()
      await answers(pupil, { correct: 5 })
      // Leagues with no stored row (nothing ranked yet) carry no hour marker and are rewritten, which changes nothing; this league is not.
      await svc.recomputeStandings(new Date('2026-10-19T14:50:00+08:00'))
      expect(await stamp()).toEqual(first)
      await run('2026-10-19T15:00:00+08:00')
      const third = await stamp()
      expect(third.at.toISOString()).toBe(new Date('2026-10-19T15:00:00+08:00').toISOString())
      const [row] = await t.db.query<{ points: number }>(`select points from league_contributions where league_id = $1::bigint and user_id = $2::bigint`, [id, pupil])
      expect(row?.points).toBe(7)
    })

    it('two job instances racing in one hour write once', async () => {
      const id = await makeLeague()
      await answers(await userOf(demoPupil('demo003')), { correct: 3 })
      const results = await Promise.all([run('2026-10-19T16:01:00+08:00'), run('2026-10-19T16:01:00+08:00')])
      const counts = await t.db.query<{ n: string }>(`select count(*)::text n from league_contributions where league_id = $1::bigint`, [id])
      expect(counts[0]?.n).toBe('1')
      expect(results[0]!.recomputed + results[1]!.recomputed).toBeGreaterThanOrEqual(1)
    })
  })

  describe('GET /leagues/:id/standings (API-GAME-13)', () => {
    it('is role M only: 401 without a session, 403 for teacher and admin, 404 for an unknown or malformed league', async () => {
      const id = await makeLeague()
      expectError(await t.http().get(`/api/leagues/${id}/standings`), 'UNAUTHORIZED', 'Sesi anda telah tamat. Sila log masuk semula.')
      expectError(await t.http().get(`/api/leagues/${id}/me`), 'UNAUTHORIZED', 'Sesi anda telah tamat. Sila log masuk semula.')
      for (const account of [ACCOUNTS.teacher, ACCOUNTS.admin, ACCOUNTS.schoolAdmin]) {
        const c = await loginAs(t, account)
        expect((await c.get(`/api/leagues/${id}/standings`)).status).toBe(403)
        expect((await c.get(`/api/leagues/${id}/me`)).status).toBe(403)
      }
      const s = await pupilClient(ACCOUNTS.student)
      for (const bad of ['999999', 'abc', '1e3']) {
        expectError(await s.get(`/api/leagues/${bad}/standings`), 'NOT_FOUND', M.leagueNotFound)
        expectError(await s.get(`/api/leagues/${bad}/me`), 'NOT_FOUND', M.leagueNotFound)
      }
    })

    it('level is numeric 1..5; default the lowest level of the league; no-store; a bad or foreign level is 422', async () => {
      const id = await makeLeague({ levelIds: [4, 5] })
      await answers(await userOf(demoPupil('demo002')), { correct: 3 }) // grade 10 = T4
      await answers(await addPupil('DEMO002', 11), { correct: 8 }) // T5
      await run()
      const s = await pupilClient(ACCOUNTS.student)
      const res = await s.get(`/api/leagues/${id}/standings`)
      expect(res.headers['cache-control']).toBe('no-store')
      const byDefault = parseData(res, GamesLeagueStandingsSchema)
      expect(byDefault.rows.find((r) => r.score > 0)?.score).toBe(3) // T4, the lowest level
      expect((await standings(s, id, '4')).rows.find((r) => r.score > 0)?.score).toBe(3)
      expect((await standings(s, id, '5')).rows.find((r) => r.score > 0)?.score).toBe(8)
      for (const bad of ['0', '6', 'T4', 'abc', '4.5', '-1']) expect422(await s.get(`/api/leagues/${id}/standings?level=${bad}`), 'level', M.leagueClassLevels)
      expect422(await s.get(`/api/leagues/${id}/standings?level=1`), 'level', M.leagueClassLevels) // valid number, not a level of this league
    })

    it('before the first run: no rows, recomputedAt null, not frozen', async () => {
      const id = await makeLeague()
      const board = await standings(await pupilClient(ACCOUNTS.student), id)
      expect(board).toEqual({ rows: [], recomputedAt: null, frozen: false })
    })

    it('primary schools are left out', async () => {
      const id = await makeLeague()
      await t.db.query(`update schools set type = 'SK' where code = 'DEMO003'`)
      try {
        await answers(await addPupil('DEMO003'), { correct: 5 })
        await answers(await addPupil('DEMO002'), { correct: 2 })
        await run()
        const rows = (await standings(await pupilClient(ACCOUNTS.student), id, '4')).rows
        const [n3] = await t.db.query<{ name: string }>(`select name from schools where code = 'DEMO003'`)
        expect(rows.map((r) => r.schoolName)).not.toContain(n3!.name)
        expect(rows.find((r) => r.score === 2)?.rank).toBe(1) // ranks are given among the visible rows
      } finally {
        await t.db.query(`update schools set type = 'SMK' where code = 'DEMO003'`)
      }
    })
  })

  describe('GET /leagues/:id/me (API-GAME-13)', () => {
    it('a pupil whose school is not enrolled gets school null, no contributors, and the public standings stay readable', async () => {
      const id = await makeLeague({ schools: ['DEMO002', 'DEMO003'] })
      await answers(await userOf(demoPupil('demo002')), { correct: 3 })
      await run()
      const outsider = await pupilClient(ACCOUNTS.student) // DEMO001
      expect(await me(outsider, id)).toEqual({ school: null, mine: { points: 0 }, contributors: [] })
      expect((await standings(outsider, id, '4')).rows.length).toBeGreaterThan(0)
    })

    it('contributors: top 10 by points desc then name asc, as {name, points}', async () => {
      const id = await makeLeague({ schools: ['DEMO002'] })
      const added: string[] = []
      for (let n = 1; n <= 12; n++) {
        const u = await addPupil('DEMO002')
        added.push(u)
        await answers(u, { correct: n <= 2 ? 5 : n })
      }
      await run()
      const c = await pupilClient(demoPupil('demo002'))
      const m = await me(c, id)
      expect(m.contributors).toHaveLength(10)
      for (const x of m.contributors) expect(Object.keys(x).sort()).toEqual(['name', 'points'])
      const pts = m.contributors.map((x) => x.points)
      expect(pts).toEqual([...pts].sort((a, b) => b - a))
      expect(pts[0]).toBe(12)
      expect(pts).not.toContain(1) // the lowest two of 12 are cut
      expect(m.school).toMatchObject({ rank: 1 })
      expect(m.mine).toEqual({ points: 0 }) // the demo pupil itself answered nothing in this league
    })
  })

  describe('the job class', () => {
    const config = (env: Record<string, string | undefined>) => ({ get: (k: string) => env[k] }) as never

    it('is off under NODE_ENV=test unless LEAGUE_STANDINGS_INTERVAL_MS is set, and run() calls the service', async () => {
      const off = new LeagueStandingsJob(svc, config({ NODE_ENV: 'test' }))
      off.onModuleInit()
      expect(off.active).toBe(false)
      const on = new LeagueStandingsJob(svc, config({ NODE_ENV: 'test', LEAGUE_STANDINGS_INTERVAL_MS: '3600000' }))
      on.onModuleInit()
      expect(on.active).toBe(true)
      on.onModuleDestroy()
      expect(on.active).toBe(false)
      const prod = new LeagueStandingsJob(svc, config({ NODE_ENV: 'production' }))
      prod.onModuleInit()
      expect(prod.active).toBe(true)
      prod.onModuleDestroy()
      const res = await off.run(new Date(NOW))
      expect(res).toEqual({ recomputed: expect.any(Number), frozen: expect.any(Number) })
    })

    it('never throws: a failing pass is logged and returns zeros', async () => {
      const job = new LeagueStandingsJob({ recomputeStandings: () => Promise.reject(new Error('boom')) } as never, config({}))
      expect(await job.run()).toEqual({ recomputed: 0, frozen: 0 })
    })
  })
})
