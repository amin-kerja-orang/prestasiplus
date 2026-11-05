import {
  GAMES_ADMIN_GAMES,
  GAMES_ADMIN_QUIZ_TILES,
  GAMES_ADMIN_SETTINGS,
  GAMES_ADMIN_SETTING_KEYS,
  GAMES_MESSAGES,
  GamesAdminGameSchema,
  GamesAdminOverviewSchema,
  GamesAdminSettingsResultSchema,
  GamesAdminSpinSegmentsSchema,
  gamesSettingRangeMessage,
} from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { GAME_SETTINGS, GameSettingsService, type GameSettingKey } from '../../../src/modules/games'
import {
  ACCOUNTS,
  bootGamesApp,
  expectCsrfInvalid,
  expectError,
  loginAs,
  parseData,
  type Client,
  type GamesTestApp,
} from '../helpers'

const M = GAMES_MESSAGES
const SETTINGS_URL = '/api/admin/games/settings'
const SEGMENTS_URL = '/api/admin/games/spin-segments'
const SESSION_ENDED = 'Sesi anda telah tamat. Sila log masuk semula.'
const NOT_ALLOWED = 'Anda tidak dibenarkan melakukan tindakan ini.'
const SETTINGS_ACTION = 'games.settings.updated'
const SEGMENTS_ACTION = 'games.spin_segments.updated'
const GAME_ACTION = 'games.game_active.updated'
const NO_RECORD = 'Rekod tidak dijumpai. Ia mungkin telah dipadam.'
const gameUrl = (key: string) => `/api/admin/games/${key}/active`

const DEFAULT_SEGMENTS = [
  { position: 1, label: '1 Syiling', syiling: 1, weight: 25, active: true },
  { position: 2, label: '3 Syiling', syiling: 3, weight: 20, active: true },
  { position: 3, label: '5 Syiling', syiling: 5, weight: 15, active: true },
  { position: 4, label: '10 Syiling', syiling: 10, weight: 8, active: true },
  { position: 5, label: '20 Syiling', syiling: 20, weight: 3, active: true },
  { position: 6, label: 'Cuba Lagi', syiling: 0, weight: 15, active: true },
  { position: 7, label: '2 Syiling', syiling: 2, weight: 10, active: true },
  { position: 8, label: '7 Syiling', syiling: 7, weight: 4, active: true },
]

interface AuditRow {
  action: string
  actor_user_id: string
  actor_role: string
  detail: { before: unknown; after: unknown }
}

describe('Tetapan Permainan (S7-T03, API-ADM-08, API-ADM-23)', () => {
  let t: GamesTestApp
  let admin: Client
  let settings: GameSettingsService

  const audits = (action: string) =>
    t.db.query<AuditRow>(`select action, actor_user_id::text, actor_role, detail from audit_events where action = $1 order by id`, [action])
  const overview = async () => parseData(await admin.get('/api/admin/games'), GamesAdminOverviewSchema).settings
  const stored = async (key: string) => (await t.db.query<{ value: string }>(`select value::text from gamification_settings where key = $1`, [key]))[0]?.value
  const storedTiles = async () => (await t.db.query<{ boardgame_quiz_tiles: number }>('select boardgame_quiz_tiles from game_settings'))[0]?.boardgame_quiz_tiles

  beforeAll(async () => {
    t = await bootGamesApp()
    admin = await loginAs(t, ACCOUNTS.admin)
    settings = t.app.get(GameSettingsService, { strict: false })
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await t.db.query(`delete from audit_events where action in ($1, $2, $3)`, [SETTINGS_ACTION, SEGMENTS_ACTION, GAME_ACTION])
    await t.db.query(`update gamification_settings set value = 1 where key like 'game\\_enabled\\_%'`)
    for (const key of GAMES_ADMIN_SETTING_KEYS) {
      await t.db.query(`update gamification_settings set value = $2 where key = $1`, [key, GAMES_ADMIN_SETTINGS[key].default])
    }
    await t.db.query(`delete from game_settings`)
    for (const s of DEFAULT_SEGMENTS) {
      await t.db.query(`update spin_segments set label = $2, syiling = $3, weight = $4, active = $5 where position = $1`, [s.position, s.label, s.syiling, s.weight, s.active])
    }
  })

  describe('the key list', () => {
    it('is exactly the 22 "Tetapan Permainan" keys of 48 section 2; quiz tiles are apart and no other screen has a key here', () => {
      expect(GAMES_ADMIN_SETTING_KEYS).toHaveLength(22)
      for (const key of ['xp_per_correct', 'xp_level_size', 'challenge_accuracy_min_questions', 'mystery_box_cost', 'draw_max_tickets_per_pupil', 'mission_reward_max', 'referral_max_rewarded', 'boardgame_quiz_tiles', 'games_award_syiling']) {
        expect(GAMES_ADMIN_SETTING_KEYS).not.toContain(key)
      }
    })

    it('the contract ranges and defaults are those of GAME_SETTINGS', () => {
      for (const key of GAMES_ADMIN_SETTING_KEYS) {
        const spec: { default: number; min: number; max: number; oneOf?: readonly number[] } = GAMES_ADMIN_SETTINGS[key]
        const owner: { default: number; min?: number; max?: number; oneOf?: readonly number[] } = GAME_SETTINGS[key]
        expect(spec.default, key).toBe(owner.default)
        if (owner.oneOf) expect(spec.oneOf, key).toEqual(owner.oneOf)
        else expect([spec.min, spec.max], key).toEqual([owner.min, owner.max])
      }
      expect([GAMES_ADMIN_QUIZ_TILES.default, GAMES_ADMIN_QUIZ_TILES.min, GAMES_ADMIN_QUIZ_TILES.max]).toEqual([35, 0, 38])
    })

    it('every label is the row label of migration 0224', async () => {
      const rows = await t.db.query<{ key: string; label: string }>(`select key, label from gamification_settings`)
      const labels = new Map(rows.map((r) => [r.key, r.label]))
      for (const key of GAMES_ADMIN_SETTING_KEYS) expect(labels.get(key), key).toBe(GAMES_ADMIN_SETTINGS[key].label)
    })
  })

  describe('PUT settings', () => {
    it('is partial: one key changes, the answer is the full settings, and the value reads back through GameSettingsService', async () => {
      const res = await admin.put(SETTINGS_URL, { game_win_xp: 30, battle_questions_default: 15, games_room_bots_enabled: 0 })
      const saved = parseData(res, GamesAdminSettingsResultSchema)
      expect(saved.game_win_xp).toBe(30)
      expect(saved.battle_questions_default).toBe(15)
      expect(saved.games_room_bots_enabled).toBe(0)
      expect(saved.game_draw_xp).toBe(10)
      expect(saved.boardgameQuizTiles).toBe(35)
      expect(await settings.get('game_win_xp')).toBe(30)
      expect(await settings.get('battle_questions_default')).toBe(15)
      expect(await settings.get('games_room_bots_enabled')).toBe(0)
      expect(await overview()).toEqual(saved)
    })

    it('saves every range edge', async () => {
      for (const key of GAMES_ADMIN_SETTING_KEYS) {
        const spec: { min: number; max: number; oneOf?: readonly number[] } = GAMES_ADMIN_SETTINGS[key]
        for (const value of spec.oneOf ?? [spec.min, spec.max]) {
          expect((await admin.put(SETTINGS_URL, { [key]: value })).status, `${key}=${String(value)}`).toBe(200)
          expect(await settings.get(key as GameSettingKey), key).toBe(value)
        }
      }
    })

    it('AC-GM-00.11: battle_question_seconds = 5 is refused with "Nilai mesti antara 10 dan 60." and the stored value is unchanged', async () => {
      const err = expectError(await admin.put(SETTINGS_URL, { battle_question_seconds: 5 }), 'VALIDATION_ERROR', 'Nilai mesti antara 10 dan 60.')
      expect(err.fields).toEqual({ battle_question_seconds: 'Nilai mesti antara 10 dan 60.' })
      expect(await stored('battle_question_seconds')).toBe('15.00')
    })

    it('every key refuses a value outside its range, a fraction and a string, with its own range message', async () => {
      for (const key of GAMES_ADMIN_SETTING_KEYS) {
        const { min, max } = GAMES_ADMIN_SETTINGS[key]
        const message = gamesSettingRangeMessage(min, max)
        for (const value of [min - 1, max + 1, min + 0.5, String(min), null, true]) {
          const err = expectError(await admin.put(SETTINGS_URL, { [key]: value }), 'VALIDATION_ERROR', message)
          expect(err.fields, `${key}=${String(value)}`).toEqual({ [key]: message })
        }
      }
    })

    it('battle_questions_default: only 5, 10, 15 or 20, with the message of 5 and 20', async () => {
      for (const value of [4, 6, 7, 12, 21]) {
        const err = expectError(await admin.put(SETTINGS_URL, { battle_questions_default: value }), 'VALIDATION_ERROR', 'Nilai mesti antara 5 dan 20.')
        expect(err.fields, String(value)).toEqual({ battle_questions_default: 'Nilai mesti antara 5 dan 20.' })
      }
      expect(await stored('battle_questions_default')).toBe('10.00')
    })

    it('all or nothing: one bad value saves none of the others, quiz tiles included; no audit row', async () => {
      const err = expectError(
        await admin.put(SETTINGS_URL, { game_win_xp: 40, boardgame_quiz_tiles: 20, battle_daily_max: 0 }),
        'VALIDATION_ERROR',
      )
      expect(err.fields).toEqual({ battle_daily_max: 'Nilai mesti antara 1 dan 100.' })
      expect(await stored('game_win_xp')).toBe('20.00')
      expect(await storedTiles()).toBeUndefined()
      expect(await audits(SETTINGS_ACTION)).toEqual([])
    })

    it('names every bad field', async () => {
      const err = expectError(await admin.put(SETTINGS_URL, { game_win_xp: 101, boardgame_quiz_tiles: 39 }), 'VALIDATION_ERROR')
      expect(err.fields).toEqual({ game_win_xp: 'Nilai mesti antara 0 dan 100.', boardgame_quiz_tiles: M.quizTilesMax })
    })

    it('a strict body: an unknown key is a 422 on that key and nothing is saved, keys of other screens included', async () => {
      for (const key of ['nope', 'xp_per_correct', 'games_award_syiling', 'boardgameQuizTiles', '__proto__']) {
        const res = await admin.put(SETTINGS_URL, JSON.parse(`{"game_win_xp":40,${JSON.stringify(key)}:1}`))
        expectError(res, 'VALIDATION_ERROR', 'Data yang dihantar tidak sah. Sila semak dan cuba lagi.')
        // Read from the raw body: the error schema of `expectError` drops a field named `__proto__`.
        const fields = (res.body as { error: { fields: Record<string, string> } }).error.fields
        expect(Object.entries(fields), key).toEqual([[key, `The ${key} field is not allowed.`]])
      }
      expect(await stored('game_win_xp')).toBe('20.00')
      expect(await stored('xp_per_correct')).toBe('10.00')
    })

    it('an empty body changes nothing and answers the settings; an array is refused', async () => {
      expect(parseData(await admin.put(SETTINGS_URL, {}), GamesAdminSettingsResultSchema).game_win_xp).toBe(20)
      expect(parseData(await admin.put(SETTINGS_URL, undefined), GamesAdminSettingsResultSchema).game_win_xp).toBe(20)
      expectError(await admin.put(SETTINGS_URL, []), 'VALIDATION_ERROR')
      expect(await audits(SETTINGS_ACTION)).toEqual([])
    })

    it('audits only the keys that changed, with before and after, in one row', async () => {
      await admin.put(SETTINGS_URL, { game_win_xp: 30, game_draw_xp: 10, boardgame_quiz_tiles: 20 })
      const rows = await audits(SETTINGS_ACTION)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ actor_user_id: admin.userId, actor_role: 'admin' })
      expect(rows[0]?.detail.before).toEqual({ boardgame_quiz_tiles: 35, game_win_xp: 20 })
      expect(rows[0]?.detail.after).toEqual({ boardgame_quiz_tiles: 20, game_win_xp: 30 })
    })

    it('no change writes no audit row', async () => {
      await admin.put(SETTINGS_URL, { game_win_xp: 20, boardgame_quiz_tiles: 35 })
      expect(await audits(SETTINGS_ACTION)).toEqual([])
      await admin.put(SETTINGS_URL, { game_win_xp: 30 })
      await admin.put(SETTINGS_URL, { game_win_xp: 30 })
      expect(await audits(SETTINGS_ACTION)).toHaveLength(1)
    })

    it('AC-GM-00.10: a save is one value for later events; nothing else is recalculated', async () => {
      const coins = await t.db.query(`select count(*)::text as n from coin_ledger`)
      await admin.put(SETTINGS_URL, { game_win_xp: 30 })
      expect(await settings.get('game_win_xp')).toBe(30)
      expect(await t.db.query(`select count(*)::text as n from coin_ledger`)).toEqual(coins)
    })

    it('quiz tiles stay in game_settings: gamification_settings has no row of that key, before or after a save', async () => {
      const saved = parseData(await admin.put(SETTINGS_URL, { boardgame_quiz_tiles: 12 }), GamesAdminSettingsResultSchema)
      expect(saved.boardgameQuizTiles).toBe(12)
      expect(await storedTiles()).toBe(12)
      expect(await stored('boardgame_quiz_tiles')).toBeUndefined()
    })

    it('a key whose row is gone is created with its label', async () => {
      await t.db.query(`delete from gamification_settings where key = 'game_play_xp'`)
      expect((await overview()).game_play_xp).toBe(5)
      expect((await admin.put(SETTINGS_URL, { game_play_xp: 6 })).status).toBe(200)
      expect(await t.db.query(`select value::text, label from gamification_settings where key = 'game_play_xp'`)).toEqual([{ value: '6.00', label: 'Mata untuk bermain' }])
    })

    it('GameSettingsService.setMany refuses quiz tiles and an out-of-range value (a programming error)', async () => {
      await t.db.prisma.$transaction(async (tx) => {
        await expect(settings.setMany([{ key: 'boardgame_quiz_tiles' as GameSettingKey, value: 1, label: 'x' }], new Date(), tx)).rejects.toThrow()
        await expect(settings.setMany([{ key: 'game_win_xp', value: 101, label: 'x' }], new Date(), tx)).rejects.toThrow()
      })
      expect(await stored('game_win_xp')).toBe('20.00')
    })
  })

  describe('Senarai Permainan (N05-04)', () => {
    it('GET lists the 14 games by hub name, all active by default; no tournament, no sambung-kata', async () => {
      const { games } = parseData(await admin.get('/api/admin/games'), GamesAdminOverviewSchema)
      expect(games.map((g) => g.key)).toEqual(GAMES_ADMIN_GAMES.map((g) => g.key))
      expect(games).toHaveLength(14)
      expect(games.every((g) => g.active)).toBe(true)
      const keys: string[] = games.map((g) => g.key)
      expect(keys).toContain('roda-nasib')
      expect(keys).not.toContain('tournament')
      expect(keys).not.toContain('sambung-kata')
    })

    it('a description only where 30 N-05 gives one', async () => {
      const { games } = parseData(await admin.get('/api/admin/games'), GamesAdminOverviewSchema)
      expect(games.filter((g) => g.description !== undefined).map((g) => [g.name, g.description])).toEqual([
        ['Papan Bijak', 'Ular & tangga dengan soalan kuiz. Multiplayer 2-4 pemain.'],
        ['Battle Arena', '1v1 kuiz battle masa nyata. Pilih lawan & subjek.'],
        ['Kad Memori', 'Padankan soalan dengan jawapan. 6 pasangan (12 kad).'],
      ])
    })

    it('every name is the row label of migration 0224', async () => {
      const rows = await t.db.query<{ key: string; label: string }>(`select key, label from gamification_settings`)
      const labels = new Map(rows.map((r) => [r.key, r.label]))
      for (const game of GAMES_ADMIN_GAMES) expect(labels.get(`game_enabled_${game.key}`), game.key).toBe(game.name)
    })

    it('PUT answers the row, stores the flag, and GET and GameSettingsService follow', async () => {
      const row = parseData(await admin.put(gameUrl('kad-memori'), { active: false }), GamesAdminGameSchema)
      expect(row).toEqual({ key: 'kad-memori', name: 'Kad Memori', active: false, description: 'Padankan soalan dengan jawapan. 6 pasangan (12 kad).' })
      expect(await settings.get('game_enabled_kad-memori')).toBe(0)
      const { games } = parseData(await admin.get('/api/admin/games'), GamesAdminOverviewSchema)
      expect(games.filter((g) => !g.active).map((g) => g.key)).toEqual(['kad-memori'])
      expect(parseData(await admin.put(gameUrl('kad-memori'), { active: true }), GamesAdminGameSchema).active).toBe(true)
      expect(await settings.get('game_enabled_kad-memori')).toBe(1)
    })

    it('audits before and after; the same value writes no audit row', async () => {
      await admin.put(gameUrl('battle'), { active: true })
      expect(await audits(GAME_ACTION)).toEqual([])
      await admin.put(gameUrl('battle'), { active: false })
      await admin.put(gameUrl('battle'), { active: false })
      const rows = await audits(GAME_ACTION)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ actor_user_id: admin.userId, actor_role: 'admin' })
      expect(rows[0]?.detail).toMatchObject({ gameKey: 'battle', before: { active: true }, after: { active: false } })
    })

    it('a key outside the list is 404 ERR-ACC-04, tournament and sambung-kata included, and stores nothing', async () => {
      for (const key of ['tournament', 'sambung-kata', 'nope', '__proto__', 'constructor']) {
        expectError(await admin.put(gameUrl(key), { active: false }), 'NOT_FOUND', NO_RECORD)
      }
      expect(await audits(GAME_ACTION)).toEqual([])
    })

    it('a strict body: a bad active or an unknown key is 422 and stores nothing', async () => {
      for (const body of [{}, { active: 1 }, { active: 'ya' }, { active: null }]) {
        const err = expectError(await admin.put(gameUrl('battle'), body), 'VALIDATION_ERROR', 'Nilai tidak sah.')
        expect(err.fields).toEqual({ active: 'Nilai tidak sah.' })
      }
      const extra = expectError(await admin.put(gameUrl('battle'), { active: false, extra: 1 }), 'VALIDATION_ERROR')
      expect(extra.fields).toEqual({ extra: 'The extra field is not allowed.' })
      expect(await stored('game_enabled_battle')).toBe('1.00')
    })

    it('does not change the pupil hub: the flag is only stored here (S7-T01 part GAME-00 reads it)', async () => {
      const student = await loginAs(t, ACCOUNTS.student)
      const before = await student.get('/api/games/hub')
      await admin.put(gameUrl('papan-bijak'), { active: false })
      const after = await student.get('/api/games/hub')
      expect(after.status).toBe(before.status)
      expect(after.body).toEqual(before.body)
    })
  })

  describe('spin segments', () => {
    const put = (segments: unknown) => admin.put(SEGMENTS_URL, { segments })
    const withRow = (index: number, change: Record<string, unknown>) => DEFAULT_SEGMENTS.map((s, i) => (i === index ? { ...s, ...change } : s))

    it('GET answers the 8 rows of the migration by position', async () => {
      expect(parseData(await admin.get(SEGMENTS_URL), GamesAdminSpinSegmentsSchema)).toEqual(DEFAULT_SEGMENTS)
    })

    it('PUT saves the 8 rows in any order, answers them by position, and audits before and after', async () => {
      const next = DEFAULT_SEGMENTS.map((s, i) => (i === 0 ? { ...s, label: 'Satu', weight: 24, active: false } : i === 1 ? { ...s, syiling: 4, weight: 21 } : s))
      const saved = parseData(await put([...next].reverse()), GamesAdminSpinSegmentsSchema)
      expect(saved).toEqual(next)
      expect(parseData(await admin.get(SEGMENTS_URL), GamesAdminSpinSegmentsSchema)).toEqual(next)
      const rows = await audits(SEGMENTS_ACTION)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.detail.before).toEqual(DEFAULT_SEGMENTS)
      expect(rows[0]?.detail.after).toEqual(next)
    })

    it('the same 8 rows write no audit row', async () => {
      expect((await put(DEFAULT_SEGMENTS)).status).toBe(200)
      expect(await audits(SEGMENTS_ACTION)).toEqual([])
    })

    it('AC-GM-14.3: weights totalling 99 or 101 are refused with "Jumlah berat mesti 100." and nothing is saved', async () => {
      for (const weight of [24, 26]) {
        const err = expectError(await put(withRow(0, { weight, label: 'Berubah' })), 'VALIDATION_ERROR', M.spinWeightsTotal)
        expect(err.fields).toEqual({ segments: M.spinWeightsTotal })
      }
      expect(parseData(await admin.get(SEGMENTS_URL), GamesAdminSpinSegmentsSchema)).toEqual(DEFAULT_SEGMENTS)
      expect(await audits(SEGMENTS_ACTION)).toEqual([])
    })

    it('an inactive row still counts in the total', async () => {
      expect((await put(withRow(0, { active: false }))).status).toBe(200)
    })

    it('refuses a wrong count, a repeated position and a bad row shape, saving nothing', async () => {
      const cases: [unknown, string, string][] = [
        [DEFAULT_SEGMENTS.slice(1), 'segments', 'Segmen mesti tepat 8.'],
        [[...DEFAULT_SEGMENTS, { ...DEFAULT_SEGMENTS[0], position: 8 }], 'segments', 'Segmen mesti tepat 8.'],
        ['x', 'segments', 'Segmen mesti tepat 8.'],
        [withRow(1, { position: 1 }), 'segments', 'Kedudukan segmen mesti 1 hingga 8 tanpa ulangan.'],
        [withRow(0, { position: 9 }), 'segments.0.position', 'Nilai mesti antara 1 dan 8.'],
        [withRow(0, { label: '' }), 'segments.0.label', 'Sila isi label.'],
        [withRow(0, { label: '   ' }), 'segments.0.label', 'Sila isi label.'],
        [withRow(0, { label: 'x'.repeat(21) }), 'segments.0.label', 'Label tidak boleh melebihi 20 aksara.'],
        [withRow(2, { syiling: 101 }), 'segments.2.syiling', 'Nilai mesti antara 0 dan 100.'],
        [withRow(2, { syiling: -1 }), 'segments.2.syiling', 'Nilai mesti antara 0 dan 100.'],
        [withRow(3, { weight: 8.5 }), 'segments.3.weight', 'Nilai mesti antara 0 dan 100.'],
        [withRow(3, { weight: -8 }), 'segments.3.weight', 'Nilai mesti antara 0 dan 100.'],
        [withRow(4, { active: 'ya' }), 'segments.4.active', 'Nilai tidak sah.'],
      ]
      for (const [body, field, message] of cases) {
        const err = expectError(await put(body), 'VALIDATION_ERROR', message)
        expect(err.fields?.[field], JSON.stringify(body).slice(0, 80)).toBe(message)
      }
      expectError(await put(withRow(0, { label: 'a\u0000b' })), 'VALIDATION_ERROR')
      expect(parseData(await admin.get(SEGMENTS_URL), GamesAdminSpinSegmentsSchema)).toEqual(DEFAULT_SEGMENTS)
      expect(await audits(SEGMENTS_ACTION)).toEqual([])
    })

    it('a strict body and a strict row: an unknown key is a 422 on that key', async () => {
      expect(expectError(await admin.put(SEGMENTS_URL, { segments: DEFAULT_SEGMENTS, extra: 1 }), 'VALIDATION_ERROR').fields).toEqual({ extra: 'The extra field is not allowed.' })
      expect(expectError(await put(withRow(0, { extra: 1 })), 'VALIDATION_ERROR').fields).toEqual({ 'segments.0.extra': 'The extra field is not allowed.' })
      expect(expectError(await admin.put(SEGMENTS_URL, {}), 'VALIDATION_ERROR').fields).toEqual({ segments: 'Segmen mesti tepat 8.' })
    })
  })

  describe('guards', () => {
    const SEGMENTS_BODY = { segments: DEFAULT_SEGMENTS }

    it('no session: 401 on the new routes and on the settings save', async () => {
      expectError(await t.http().put(gameUrl('battle')).send({ active: false }), 'UNAUTHORIZED', SESSION_ENDED)
      expectError(await t.http().get(SEGMENTS_URL), 'UNAUTHORIZED', SESSION_ENDED)
      expectError(await t.http().put(SEGMENTS_URL).send(SEGMENTS_BODY), 'UNAUTHORIZED', SESSION_ENDED)
      expectError(await t.http().put(SETTINGS_URL).send({ game_win_xp: 30 }), 'UNAUTHORIZED', SESSION_ENDED)
    })

    for (const [name, email] of [
      ['student', ACCOUNTS.student],
      ['teacher', ACCOUNTS.teacher],
      ['school admin', ACCOUNTS.schoolAdmin],
    ] as const) {
      it(`${name}: 403 ERR-ACC-01 on every route, nothing saved, no audit row (AC-GM-00.10)`, async () => {
        const c = await loginAs(t, email)
        expectError(await c.get('/api/admin/games'), 'FORBIDDEN', NOT_ALLOWED)
        expectError(await c.get(SEGMENTS_URL), 'FORBIDDEN', NOT_ALLOWED)
        expectError(await c.put(SETTINGS_URL, { game_win_xp: 30 }), 'FORBIDDEN', NOT_ALLOWED)
        expectError(await c.put(SEGMENTS_URL, SEGMENTS_BODY), 'FORBIDDEN', NOT_ALLOWED)
        expectError(await c.put(gameUrl('battle'), { active: false }), 'FORBIDDEN', NOT_ALLOWED)
        expect(await stored('game_enabled_battle')).toBe('1.00')
        expect(await stored('game_win_xp')).toBe('20.00')
        expect(await audits(SETTINGS_ACTION)).toEqual([])
      })
    }

    it('PUT without the CSRF token is CSRF_INVALID on both saves', async () => {
      expectCsrfInvalid(await admin.noCsrf.put(SETTINGS_URL, { game_win_xp: 30 }))
      expectCsrfInvalid(await admin.noCsrf.put(SEGMENTS_URL, SEGMENTS_BODY))
      expectCsrfInvalid(await admin.noCsrf.put(gameUrl('battle'), { active: false }))
      expect(await stored('game_win_xp')).toBe('20.00')
    })

    it('the writes are rate limited', async () => {
      const limited = await bootGamesApp({ env: { THROTTLE_GAMES_WRITE_PER_MINUTE: '1' } })
      try {
        const c = await loginAs(limited, ACCOUNTS.admin)
        expect((await c.put(SEGMENTS_URL, SEGMENTS_BODY)).status).toBe(200)
        expect((await c.put(SEGMENTS_URL, SEGMENTS_BODY)).status).toBe(429)
      } finally {
        await limited.close()
      }
    })
  })
})
