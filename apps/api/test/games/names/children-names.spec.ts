import {
  GamesHubSchema,
  GamesLeagueDetailSchema,
  GamesLeagueIdResultSchema,
  GamesLobbySchema,
  GamesWeeklyCompetitionSchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { classesSeed } from '../../../prisma/seed/poc/classes'
import type { WeeklyPracticeSource } from '../../../src/modules/games'
import { displayName } from '../../../src/modules/games/core/name-privacy'
import { ACCOUNTS, bootGamesApp, loginAs, parseData, type Client, type GamesTestApp } from '../helpers'
import { P, createRoom, parseRoom, userId } from '../rooms/support'

/**
 * Children's names rule (LEAD 2026-10-21, issue #76) over every ranking-like read of the games module:
 * a pupil's full name and real id only for the pupil, an admin, the school admin of the pupil's school and the
 * teacher of the pupil's class; first name + initial and a null id for everyone else.
 *
 * Pupils: A = pelajar (DEMO001, class DEMO4S of the demo teacher), B = pelajarmaju (DEMO001, in no class),
 * C = murid.demo002.01 (DEMO002), D = pelajar2 (DEMO001, class DEMO4S).
 */
type Key = 'A' | 'B' | 'C' | 'D'
const EMAILS: Record<Key, string> = {
  A: ACCOUNTS.student,
  B: ACCOUNTS.studentMaju,
  C: 'murid.demo002.01@example.test',
  D: ACCOUNTS.student2,
}
const KEYS = Object.keys(EMAILS) as Key[]

/** Viewer -> the pupils whose full name and id that viewer may see. */
const VIEWERS: { who: string; email: string; sees: Key[] }[] = [
  { who: 'the pupil A themself', email: EMAILS.A, sees: ['A'] },
  { who: 'another student (D)', email: EMAILS.D, sees: ['D'] },
  { who: 'the teacher of class DEMO4S', email: ACCOUNTS.teacher, sees: ['A', 'D'] },
  { who: 'the school admin of DEMO001', email: ACCOUNTS.schoolAdmin, sees: ['A', 'B', 'D'] },
  { who: 'the school admin of DEMO002', email: 'adminsekolah.demo002@example.test', sees: ['C'] },
  { who: 'an admin', email: ACCOUNTS.admin, sees: ['A', 'B', 'C', 'D'] },
  { who: 'a parent', email: 'ibubapa@demo.test', sees: [] },
  { who: 'a PPD officer', email: 'ppd@demo.test', sees: [] },
]

describe("children's names rule in the games rankings (issue #76)", () => {
  let t: GamesTestApp
  const id = {} as Record<Key, string>
  const full = {} as Record<Key, string>
  const clients = new Map<string, Client>()

  /** What a viewer must see of pupil `k`. */
  const expectedName = (v: (typeof VIEWERS)[number], k: Key): string => (v.sees.includes(k) ? full[k] : displayName(full[k]))
  const expectedId = (v: (typeof VIEWERS)[number], k: Key): string | null => (v.sees.includes(k) ? id[k] : null)

  const weekly: WeeklyPracticeSource = {
    async week() {
      return { me: null, rows: KEYS.map((k, i) => ({ rank: i + 1, userId: id[k], name: full[k], sesi: 3, betul: 20 - i, tepat: 80 })) }
    },
  }

  beforeAll(async () => {
    t = await bootGamesApp({ seeds: [classesSeed], ports: { weeklyPractice: weekly } })
    for (const k of KEYS) {
      id[k] = await userId(t.db, EMAILS[k])
      full[k] = (await t.db.query<{ name: string }>('select name from users where id = $1', [id[k]]))[0]?.name as string
    }
    for (const v of VIEWERS) clients.set(v.email, await loginAs(t, v.email))
  }, 180_000)
  afterAll(async () => {
    await t.close()
  })

  const as = (v: (typeof VIEWERS)[number]): Client => clients.get(v.email) as Client

  it('the fixtures are what the matrix assumes (distinct, multi-word names)', () => {
    expect(new Set(KEYS.map((k) => full[k])).size).toBe(4)
    for (const k of KEYS) expect(displayName(full[k]), k).not.toBe(full[k])
  })

  describe('lobby: Papan Bijak top10 and the other games\' leaders', () => {
    beforeAll(async () => {
      await t.db.query('delete from game_standings')
      for (const [i, k] of KEYS.entries()) {
        await t.db.query(
          `insert into game_standings (game, user_id, wins, jumlah, skor, betul) values ('papan-bijak', $1, $2, 10, 100, 10), ('kuiz-relay', $1, $2, 0, 0, 0)`,
          [id[k], 9 - i],
        )
      }
    })

    for (const v of VIEWERS) {
      it(`top10 for ${v.who}: ${v.sees.length === 0 ? 'every row redacted' : `full only for ${v.sees.join(', ')}`}; initials follow the shown name`, async () => {
        const lobby = parseData(await as(v).get('/api/games/papan-bijak/lobby'), GamesLobbySchema)
        if (!('top10' in lobby)) throw new Error('expected top10')
        expect(lobby.top10).toHaveLength(4)
        for (const [i, k] of KEYS.entries()) {
          const row = lobby.top10[i]
          const shown = expectedName(v, k)
          expect(row, k).toMatchObject({ userId: expectedId(v, k), name: shown.length > 15 ? `${shown.slice(0, 15)}...` : shown })
          expect(row?.initials, k).toBe(
            shown
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => (w[0] ?? '').toUpperCase())
              .join(''),
          )
        }
        const body = JSON.stringify(lobby)
        for (const k of KEYS) if (!v.sees.includes(k)) expect(body, k).not.toContain(`"${full[k]}"`)
      })

      it(`leaders for ${v.who}`, async () => {
        const lobby = parseData(await as(v).get('/api/games/kuiz-relay/lobby'), GamesLobbySchema)
        if (!('leaders' in lobby)) throw new Error('expected leaders')
        expect(lobby.leaders.map((l) => [l.userId, l.name])).toEqual(KEYS.map((k) => [expectedId(v, k), expectedName(v, k)]))
      })
    }
  })

  describe('weekly competition board', () => {
    for (const v of VIEWERS) {
      it(`rows for ${v.who}`, async () => {
        const board = parseData(await as(v).get('/api/games/pertandingan'), GamesWeeklyCompetitionSchema)
        expect(board.rows.map((r) => [r.userId, r.name])).toEqual(KEYS.map((k) => [expectedId(v, k), expectedName(v, k)]))
        expect(board.rows.map((r) => r.betul)).toEqual([20, 19, 18, 17]) // figures untouched
      })
    }
  })

  describe('room: hub host, players, host, winner and scores', () => {
    let code = ''
    beforeAll(async () => {
      await t.db.query('delete from game_rooms')
      code = await createRoom(as(VIEWERS[0] as (typeof VIEWERS)[number]), 'kuiz-relay')
    })

    it('hub host name follows the rule for every viewer (an open room only)', async () => {
      for (const v of VIEWERS) {
        const hub = parseData(await as(v).get('/api/games/hub'), GamesHubSchema)
        expect(hub.openRooms[0]?.host, v.who).toBe(expectedName(v, 'A'))
      }
    })

    it('everyone joins', async () => {
      for (const v of VIEWERS.slice(1)) {
        const res = await as(v).post(P('kuiz-relay', undefined, '/join'), { room_code: code })
        expect(res.status, `${v.who}: ${JSON.stringify(res.body)}`).toBe(200)
      }
    })

    for (const v of VIEWERS) {
      it(`waiting room players and host for ${v.who}`, async () => {
        const view = parseRoom(await as(v).get(P('kuiz-relay', code)))
        expect(view.host.name).toBe(expectedName(v, 'A'))
        expect(view.players.find((p) => p.id === id.A)?.name).toBe(expectedName(v, 'A'))
        expect(view.players.find((p) => p.id === id.D)?.name).toBe(expectedName(v, 'D'))
        // the adult players (teacher, admins, parent, officer) are not children: their names are not redacted
        const adults = view.players.filter((p) => p.id !== id.A && p.id !== id.D)
        expect(adults.length).toBe(VIEWERS.length - 2)
        for (const p of adults) expect(p.name).toBe((await t.db.query<{ name: string }>('select name from users where id = $1', [p.id]))[0]?.name)
      })
    }

    it('finished room: winnerName and scores follow the same rule for every viewer', async () => {
      await t.db.query(
        `update game_rooms set status = 'finished', finished_at = now(),
           state = coalesce(state, '{}'::jsonb) || jsonb_build_object('awaiting', null, 'round', 1, 'total', 1, 'humanId', $2::text, 'log', '[]'::jsonb, 'winnerId', $2::text, 'mvpId', null)
         where code = $1`,
        [code, id.A],
      )
      for (const v of VIEWERS) {
        const view = parseRoom(await as(v).get(P('kuiz-relay', code)))
        expect(view.status, v.who).toBe('finished')
        expect(view.result?.winnerName, v.who).toBe(expectedName(v, 'A'))
        const score = (k: Key) => view.result?.scores.find((s) => s.userId === id[k])
        expect(score('A')?.name, v.who).toBe(expectedName(v, 'A'))
        expect(score('D')?.name, v.who).toBe(expectedName(v, 'D'))
        const body = JSON.stringify(view)
        for (const k of KEYS) if (!v.sees.includes(k)) expect(body, `${v.who} ${k}`).not.toContain(`"${full[k]}"`)
      }
    })
  })

  describe('league creator', () => {
    it('a pupil who creates a league is shown by first name + initial to those who may not see the name', async () => {
      const created = await as(VIEWERS[0] as (typeof VIEWERS)[number]).post('/api/leagues', {
        name: 'Liga Nama',
        type: 'league',
        scope: 'national',
        game_mode: 'mixed',
        scoring_method: 'total_score',
        start_date: '2026-11-01',
        end_date: '2026-11-30',
      })
      expect(created.status, JSON.stringify(created.body)).toBe(201)
      const leagueId = parseData(created, GamesLeagueIdResultSchema).id
      for (const v of VIEWERS) {
        const detail = parseData(await as(v).get(`/api/leagues/${leagueId}`), GamesLeagueDetailSchema)
        expect(detail.creatorName, v.who).toBe(expectedName(v, 'A'))
        expect(Object.keys(detail.standings), v.who).toEqual([]) // standings are school rows, never pupils
      }
    })
  })

  it('bots are real pupils of the host school: a bot player is redacted like any other pupil', async () => {
    const code = (await t.db.query<{ code: string }>('select code from game_rooms limit 1'))[0]?.code as string
    await t.db.query(`delete from game_room_players where room_code = $1 and user_id = $2::bigint`, [code, id.B])
    await t.db.query(`insert into game_room_players (room_code, user_id, is_bot, is_test, joined_at) values ($1, $2::bigint, true, false, now())`, [code, id.B])
    const stud = VIEWERS[1] as (typeof VIEWERS)[number]
    const view = parseRoom(await as(stud).get(P('kuiz-relay', code)))
    const b = view.players.find((p) => p.id === id.B)
    expect(b).toMatchObject({ isBot: true, name: displayName(full.B) })
  })
})
