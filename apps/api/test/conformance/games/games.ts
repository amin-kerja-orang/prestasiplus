import type { HttpResponse, Scenario, ScenarioContext } from '@pp/contract-tests'

import { API_ONLY, dataOf, errorOf, expectError } from '../helpers'

/**
 * Games (BE-45, M16 part 2): every one of the 29 routes at least once, against the seeded demo accounts. The
 * conformance seed has only 2 published MCQ per subject and level, so the routes that need a full question pool
 * (room start, Jutawan start, a full solo payload) are asserted on their documented outcome either way: success,
 * or the contract's refusal ("Soalan tidak mencukupi." 409/422). The shared smoke scenarios already prove each
 * route against its contract schema; these add the cross-route agreement. API target only.
 */

const raw = (res: HttpResponse): Record<string, unknown> =>
  res.body !== null && typeof res.body === 'object' && !Array.isArray(res.body) ? (res.body as Record<string, unknown>) : {}

/** Records a violation unless the status is one of the documented outcomes. */
function oneOf(ctx: ScenarioContext, res: HttpResponse, statuses: readonly number[], what: string): void {
  ctx.check(statuses.includes(res.status), `${what}: expected ${statuses.join(' or ')}, got ${String(res.status)} ${JSON.stringify(res.body).slice(0, 200)}`)
}

const ROOM_GAMES = ['papan-bijak', 'perang-fakta', 'benteng-ilmu', 'perlumbaan-matematik', 'kuiz-relay', 'teka-silang-kata'] as const
const SOLO_GAMES = ['betul-salah', 'cabaran-kilat', 'tembak-jawapan', 'susun-jawapan', 'kad-memori'] as const
const MISSING_UUID = '00000000-0000-4000-8000-000000000000'

export const gamesScenarios: Scenario[] = [
  {
    id: 'games-api/hub and the six lobbies; an unknown game is 404',
    domain: 'games',
    targets: API_ONLY,
    async run(ctx) {
      const s = await ctx.as('student')
      const hub = await s.request('GET', '/games/hub')
      ctx.expectStatus(hub, 200)
      ctx.check(hub.headers['cache-control'] === 'no-store', 'the hub lists room codes: Cache-Control must be no-store')
      ctx.check(Array.isArray(dataOf(hub).openRooms), 'hub.openRooms must be an array')
      for (const game of ROOM_GAMES) {
        const lobby = await s.request('GET', `/games/${game}/lobby`)
        ctx.expectStatus(lobby, 200)
        ctx.check(dataOf(lobby).autoGrade === 'TINGKATAN_4', `${game}: the demo student is Tingkatan 4`)
      }
      expectError(ctx, await s.request('GET', '/games/tiada-game/lobby'), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'games-api/room lifecycle: create, view, join (already a player), start, action',
    domain: 'games',
    targets: API_ONLY,
    async run(ctx) {
      const s = await ctx.as('student')
      const created = await s.request('POST', '/games/papan-bijak/rooms', {
        body: { subject: 'MATEMATIK', grade_level: 'TINGKATAN_4', match_mode: 'same_grade', max_players: 4 },
      })
      ctx.expectStatus(created, 201)
      ctx.check(created.headers['cache-control'] === 'no-store', 'the room code is a join code: Cache-Control must be no-store')
      const code = String(dataOf(created).code)
      ctx.check(/^[A-Z0-9]{6}$/.test(code), 'room code must be 6 characters of A-Z0-9')

      const view = await s.request('GET', `/games/papan-bijak/rooms/${code}`)
      ctx.expectStatus(view, 200)
      ctx.check(dataOf(view).status === 'waiting', 'a new room is waiting')
      const players = dataOf(view).players as unknown[]
      ctx.check(Array.isArray(players) && players.length >= 1, 'the host is the first player')

      const join = await s.request('POST', '/games/papan-bijak/rooms/join', { body: { room_code: ` ${code.toLowerCase()} ` } })
      ctx.expectStatus(join, 200)
      ctx.check(dataOf(join).code === code, 'joining a room you are already in answers the same code')
      expectError(ctx, await s.request('POST', '/games/papan-bijak/rooms/join', { body: { room_code: 'ZZZZZZ' } }), 404, 'NOT_FOUND')
      expectError(ctx, await s.request('POST', '/games/papan-bijak/rooms', { body: { subject: 'SEJARAH', grade_level: 'TINGKATAN_4', match_mode: 'same_grade', max_players: 4 } }), 422, 'VALIDATION_ERROR')

      // The host may start with a bot added by polling; the seeded bank is small, so "Soalan tidak mencukupi." is the documented refusal.
      await s.request('GET', `/games/papan-bijak/rooms/${code}`)
      const start = await s.request('POST', `/games/papan-bijak/rooms/${code}/start`)
      oneOf(ctx, start, [200, 409], 'start')
      if (start.status === 409) ctx.check(errorOf(start).message !== undefined, 'a 409 start carries a message')
      const action = await s.request('POST', `/games/papan-bijak/rooms/${code}/action`, { body: { type: 'roll' } })
      oneOf(ctx, action, start.status === 200 ? [200, 409, 422] : [409], 'action')
    },
  },
  {
    id: 'games-api/Papan Bijak quick match: start, three polls (the third matches), cancel (raw bodies)',
    domain: 'games',
    targets: API_ONLY,
    async run(ctx) {
      const s = await ctx.as('student')
      const bad = await s.request('POST', '/papan-bijak/quick-match', { body: { subject: 'SEJARAH', match_mode: 'same_grade' } })
      ctx.expectStatus(bad, 422)
      ctx.check(typeof raw(bad).error === 'string', 'the quick-match 422 is a raw { error: string }')
      const start = await s.request('POST', '/papan-bijak/quick-match', { body: { subject: 'MATEMATIK', match_mode: 'same_level' } })
      ctx.expectStatus(start, 200)
      ctx.check(raw(start).status === 'searching', 'start answers { status: searching }')
      const polls: string[] = []
      for (let i = 0; i < 3; i++) {
        const poll = await s.request('GET', '/papan-bijak/quick-match/poll')
        ctx.expectStatus(poll, 200)
        polls.push(String(raw(poll).status))
        if (i === 2) ctx.check(raw(poll).status === 'matched' && typeof raw(poll).room_code === 'string', 'the third poll matches and returns a room_code')
      }
      ctx.check(polls[0] === 'searching' && polls[1] === 'searching', 'the first two polls are searching')
      const cancel = await s.request('POST', '/papan-bijak/quick-match/cancel')
      ctx.expectStatus(cancel, 200)
      ctx.check(raw(cancel).status === 'cancelled', 'cancel always answers { status: cancelled }')
    },
  },
  {
    id: 'games-api/solo games: GET, check, reveal and submit for all five games (keyless payloads)',
    domain: 'games',
    targets: API_ONLY,
    async run(ctx) {
      const s = await ctx.as('student')
      expectError(ctx, await s.request('GET', '/games/solo/tiada-game'), 404, 'NOT_FOUND')
      expectError(ctx, await s.request('GET', '/games/solo/betul-salah?darjah=99'), 422, 'VALIDATION_ERROR')
      for (const game of SOLO_GAMES) {
        const get = await s.request('GET', `/games/solo/${game}?darjah=10`)
        ctx.expectStatus(get, 200)
        const body = JSON.stringify(get.body)
        ctx.check(!/"(is_true|correct|answer|pair_id|correctAnswer|is_correct)"/.test(body), `${game}: the payload must carry no answer key`)
        const d = dataOf(get)
        const sessionId = String(d.sessionId)
        const items = (d.statements ?? d.questions ?? d.puzzles ?? d.cards ?? []) as { id?: string }[]
        const first = items[0]?.id
        if (game === 'kad-memori') {
          const second = items[1]?.id
          if (first && second) {
            const reveal = await s.request('POST', '/games/solo/kad-memori/reveal', { body: { session_id: sessionId, card_id: first } })
            ctx.expectStatus(reveal, 200)
            const check = await s.request('POST', '/games/solo/kad-memori/check', { body: { session_id: sessionId, card_id: first, other_card_id: second } })
            ctx.expectStatus(check, 200)
          }
        } else if (first) {
          const body =
            game === 'betul-salah'
              ? { session_id: sessionId, item_id: first, answer: true }
              : game === 'cabaran-kilat'
                ? { session_id: sessionId, item_id: first, option_id: 0 }
                : game === 'tembak-jawapan'
                  ? { session_id: sessionId, item_id: first, option_index: 0 }
                  : { session_id: sessionId, item_id: first, answer: 'jawapan' }
          const check = await s.request('POST', `/games/solo/${game}/check`, { body })
          ctx.expectStatus(check, 200)
          const again = await s.request('POST', `/games/solo/${game}/check`, { body })
          ctx.expectStatus(again, 409)
        }
        // Kad Memori needs 6 matched pairs; the others need at least one stored check.
        const submit = await s.request('POST', `/games/solo/${game}/submit`, { body: { session_id: sessionId } })
        oneOf(ctx, submit, [200, 422], `${game} submit`)
        if (submit.status === 200) {
          const again = await s.request('POST', `/games/solo/${game}/submit`, { body: { session_id: sessionId } })
          ctx.expectStatus(again, 409)
          ctx.check(typeof raw(again).message === 'string' && raw(again).error === undefined, `${game}: the 409 is a raw { message }`)
        }
      }
      const unknown = await s.request('POST', '/games/solo/betul-salah/submit', { body: { session_id: MISSING_UUID } })
      ctx.expectStatus(unknown, 422)
      ctx.check(typeof raw(unknown).message === 'string', 'an unknown session is a raw { message } 422')
      expectError(ctx, await s.request('POST', '/games/solo/betul-salah/check', { body: { session_id: MISSING_UUID, item_id: '1', answer: true } }), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'games-api/Roda Nasib: page, one spin a day (raw), a second spin is refused',
    domain: 'games',
    targets: API_ONLY,
    async run(ctx) {
      const s = await ctx.as('student')
      const page = await s.request('GET', '/games/roda-nasib')
      ctx.expectStatus(page, 200)
      ctx.check(Array.isArray(dataOf(page).segments) && (dataOf(page).segments as unknown[]).length === 8, 'the wheel has 8 segments')
      const spin = await s.request('POST', '/games/roda-nasib/spin')
      oneOf(ctx, spin, [200, 409], 'spin')
      const again = await s.request('POST', '/games/roda-nasib/spin')
      ctx.expectStatus(again, 409)
      ctx.check(raw(again).success === false && raw(again).message === 'Anda sudah spin hari ini.', 'the refusal is raw { success: false, message }')
    },
  },
  {
    id: 'games-api/Jutawan Ilmu: page with subject tiles, start, answer and lifeline',
    domain: 'games',
    targets: API_ONLY,
    async run(ctx) {
      const s = await ctx.as('student')
      const page = await s.request('GET', '/games/jutawan?darjah=10')
      ctx.expectStatus(page, 200)
      ctx.check(dataOf(page).heading === 'TINGKATAN 4', 'the heading of grade 10 is TINGKATAN 4')
      expectError(ctx, await s.request('GET', '/games/jutawan?darjah=0'), 422, 'VALIDATION_ERROR')
      const subjects = (dataOf(page).subjects ?? []) as { id: string }[]
      ctx.check(subjects.length > 0, 'the page lists subject tiles for the level')
      const start = await s.request('POST', '/games/jutawan/start', { body: { darjah: 10, subject: subjects[0]?.id ?? '1' } })
      oneOf(ctx, start, [200, 422], 'start')
      if (start.status === 200) {
        const d = dataOf(start)
        const sessionId = String(d.sessionId)
        const q = d.question as { id: string }
        const lifeline = await s.request('POST', `/games/jutawan/${sessionId}/lifeline`, { body: { type: '50:50' } })
        ctx.expectStatus(lifeline, 200)
        const answer = await s.request('POST', `/games/jutawan/${sessionId}/answer`, { body: { questionId: q.id, optionId: 0 } })
        ctx.expectStatus(answer, 200)
      } else {
        ctx.check(errorOf(start).message === 'Soalan tidak mencukupi.', 'a thin bank is refused with "Soalan tidak mencukupi."')
      }
      expectError(ctx, await s.request('POST', `/games/jutawan/${MISSING_UUID}/answer`, { body: { questionId: '1', optionId: 0 } }), 404, 'NOT_FOUND')
      expectError(ctx, await s.request('POST', `/games/jutawan/${MISSING_UUID}/lifeline`, { body: { type: '50:50' } }), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'games-api/weekly competition board and Uji Minda (constant)',
    domain: 'games',
    targets: API_ONLY,
    async run(ctx) {
      const s = await ctx.as('student')
      const board = await s.request('GET', '/games/pertandingan')
      ctx.expectStatus(board, 200)
      ctx.check(JSON.stringify(dataOf(board).prizes) === '[100,50,25]', 'prizes are 100, 50, 25')
      const uji = await s.request('GET', '/games/uji-minda')
      ctx.expectStatus(uji, 200)
      ctx.check(JSON.stringify(uji.body) === JSON.stringify({ data: { challenge: null } }), 'Uji Minda is the constant { data: { challenge: null } }')
    },
  },
  {
    id: 'games-api/leagues: create, list, detail (no-store, invite code), join, and the board of Sekolah Bersaing',
    domain: 'games',
    targets: API_ONLY,
    async run(ctx) {
      const s = await ctx.as('student')
      const body = { name: 'Liga Konformans', type: 'friendly', scope: 'school', game_mode: 'mixed', scoring_method: 'total_score', start_date: '2026-11-01', end_date: '2026-11-30', class_levels: ['T4'] }
      const created = await s.request('POST', '/leagues', { body })
      ctx.expectStatus(created, 201)
      const id = String(dataOf(created).id)
      const list = await s.request('GET', '/leagues')
      ctx.expectStatus(list, 200)
      const mine = (dataOf(list).mine ?? []) as { id: string }[]
      ctx.check(mine.some((l) => l.id === id), 'the created league is in mine (the creator school joined)')
      const detail = await s.request('GET', `/leagues/${id}`)
      ctx.expectStatus(detail, 200)
      ctx.check(detail.headers['cache-control'] === 'no-store', 'the detail carries the invite code: Cache-Control must be no-store')
      const code = String(dataOf(detail).inviteCode)
      ctx.check(/^[A-Z0-9]{8}$/.test(code), 'invite code is 8 characters of A-Z0-9')
      // The creator school is already in: refused with fields.invite_code.
      const again = await s.request('POST', '/leagues/join', { body: { invite_code: code } })
      ctx.expectStatus(again, 422)
      ctx.check(errorOf(again).message === 'Sekolah anda sudah menyertai liga ini.', 'joining twice says "Sekolah anda sudah menyertai liga ini."')
      expectError(ctx, await s.request('GET', '/leagues/abc'), 404, 'NOT_FOUND')
      expectError(ctx, await s.request('POST', '/leagues', { body: { ...body, end_date: '2026-10-01' } }), 422, 'VALIDATION_ERROR')
      // The admin account has no school: refused with the school message.
      const admin = await ctx.as('admin')
      const noSchool = await admin.request('POST', '/leagues/join', { body: { invite_code: code } })
      ctx.expectStatus(noSchool, 422)

      const sb = await s.request('GET', '/sekolah-bersaing?week=bukan-tarikh')
      ctx.expectStatus(sb, 200)
      ctx.check(dataOf(sb).count === (dataOf(sb).rows as unknown[]).length, 'count equals the number of rows')
      ctx.expectStatus(await s.request('GET', '/sekolah-bersaing?week=2026-09-23'), 200)
    },
  },
  {
    id: 'games-api/admin settings: GET and PUT are admin only, the tile count is 0..38',
    domain: 'games',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const overview = await admin.request('GET', '/admin/games')
      ctx.expectStatus(overview, 200)
      const put = await admin.request('PUT', '/admin/games/settings', { body: { boardgame_quiz_tiles: 30 } })
      ctx.expectStatus(put, 200)
      ctx.check(dataOf(put).boardgameQuizTiles === 30, 'PUT answers the saved count')
      const after = await admin.request('GET', '/admin/games')
      ctx.check((dataOf(after).settings as { boardgameQuizTiles?: number } | undefined)?.boardgameQuizTiles === 30, 'GET reads back the saved count')
      expectError(ctx, await admin.request('PUT', '/admin/games/settings', { body: { boardgame_quiz_tiles: 39 } }), 422, 'VALIDATION_ERROR')
      await admin.request('PUT', '/admin/games/settings', { body: { boardgame_quiz_tiles: 35 } })

      const student = await ctx.as('student')
      expectError(ctx, await student.request('GET', '/admin/games'), 403, 'FORBIDDEN')
      expectError(ctx, await student.request('PUT', '/admin/games/settings', { body: { boardgame_quiz_tiles: 10 } }), 403, 'FORBIDDEN')
    },
  },
]
