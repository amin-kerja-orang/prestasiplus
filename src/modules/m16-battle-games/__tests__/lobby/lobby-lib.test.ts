/**
 * Pure logic of the lobbies and rooms (SRS M16 v1.6 FR-M16-55, 61, 62, 68..70; BR-M16-22; URS FN-M16-5.x).
 */

import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api'

import type { RoomView } from '../../api'
import {
  CUSTOM_GRADE_OPTIONS,
  GRADE_GROUPS,
  LOBBY_GAMES,
  PB_SUBJECTS,
  ROOM_GAME_META,
  isRoomGame,
  sameLevelLabel,
} from '../../components/lobby/lobby-config'
import {
  buildCreateBody,
  clock,
  errorLines,
  kadarClass,
  teamLabel,
  topRowClass,
} from '../../components/lobby/lobby-lib'
import {
  answerBody,
  answerSeconds,
  canAct,
  canStart,
  isHost,
  isOpenRoom,
  lastRoll,
  metricText,
  resultHeadline,
  roundText,
  tileTarget,
  tileView,
} from '../../components/lobby/room-lib'

const room = (over: Partial<RoomView> = {}): RoomView => ({
  code: 'ABC123',
  game: 'perang-fakta',
  status: 'waiting',
  host: { id: 1, name: 'Admin Demo' },
  players: [
    { id: 1, name: 'Admin Demo', grade: 'Darjah 4', points: 0, isBot: false },
    { id: 2, name: 'Pelajar Dua', grade: 'Darjah 4', points: 0, isBot: true },
  ],
  settings: {
    subject: 'MATEMATIK',
    gradeLevel: 'DARJAH_4',
    matchMode: 'same_grade',
    gradeMin: null,
    gradeMax: null,
    maxPlayers: 6,
    minPlayers: 2,
  },
  state: null,
  ...over,
})

describe('lobby config (URS FN-M16-5.1.x, 5.4.x)', () => {
  it('relabels same_level by the chosen grade (FR-M16-55)', () => {
    expect(sameLevelLabel('DARJAH_4')).toBe('Semua Darjah (1-6)')
    expect(sameLevelLabel('TINGKATAN_2')).toBe('Semua Tingkatan (1-5)')
    expect(sameLevelLabel('')).toBe('Semua Darjah/Tingkatan')
  })

  it('has the grade optgroups and the custom range 1-11 (D1-D6, T1-T5)', () => {
    expect(GRADE_GROUPS.map((g) => [g.label, g.options.length])).toEqual([
      ['Sekolah Rendah', 6],
      ['Sekolah Menengah', 5],
    ])
    expect(CUSTOM_GRADE_OPTIONS.map((o) => o.label).join(' ')).toBe(
      'D1 D2 D3 D4 D5 D6 T1 T2 T3 T4 T5',
    )
    expect(CUSTOM_GRADE_OPTIONS[10]?.value).toBe(11)
  })

  it('offers four Papan Bijak subjects with emoji', () => {
    expect(PB_SUBJECTS.map((s) => `${s.emoji} ${s.label}`)).toEqual([
      '🔢 Matematik',
      '📝 Bahasa Melayu',
      '🔬 Sains',
      '🇬🇧 Bahasa Inggeris',
    ])
  })

  it('has the five lobby heroes with the exact rule lines (FR-M16-62)', () => {
    expect(LOBBY_GAMES.map((g) => ROOM_GAME_META[g].rule)).toEqual([
      '2-6 pemain · 15 pusingan · 10 saat setiap soalan',
      '2 pemain · HP 100 · Giliran bertukar',
      '2-4 pemain · 20 langkah · Siapa sampai dulu menang',
      '4-8 pemain · 2 pasukan · 10 pusingan',
      '2 pemain · 5 minit · Markah tertinggi menang',
    ])
    expect(ROOM_GAME_META['kuiz-relay'].unit).toBe('kali MVP')
    expect(isRoomGame('papan-bijak')).toBe(true)
    expect(isRoomGame('betul-salah')).toBe(false)
  })
})

describe('create body (FR-M16-55, 63)', () => {
  const v = {
    subject: 'MATEMATIK' as const,
    gradeLevel: 'DARJAH_4',
    matchMode: 'same_grade' as const,
    gradeMin: 2,
    gradeMax: 5,
    maxPlayers: 4,
  }

  it('sends max_players for Papan Bijak and the range only for custom', () => {
    expect(buildCreateBody('papan-bijak', v)).toEqual({
      subject: 'MATEMATIK',
      grade_level: 'DARJAH_4',
      match_mode: 'same_grade',
      max_players: 4,
    })
    expect(buildCreateBody('papan-bijak', { ...v, matchMode: 'custom' })).toMatchObject({
      match_mode: 'custom',
      grade_min: 2,
      grade_max: 5,
    })
  })

  it('sends three fields for the S8-S12 lobbies', () => {
    expect(buildCreateBody('perang-fakta', { ...v, matchMode: 'same_level' })).toEqual({
      subject: 'MATEMATIK',
      grade_level: 'DARJAH_4',
      match_mode: 'same_level',
    })
  })
})

describe('Top 10 styling (BR-M16-22)', () => {
  it('uses green at 70 and above, amber 40-69, red below 40', () => {
    expect(kadarClass(100)).toContain('emerald')
    expect(kadarClass(75)).toContain('emerald')
    expect(kadarClass(70)).toContain('emerald')
    expect(kadarClass(67)).toContain('amber')
    expect(kadarClass(40)).toContain('amber')
    expect(kadarClass(33)).toContain('red')
    expect(kadarClass(25)).toContain('red')
  })

  it('styles ranks 1-3 only', () => {
    expect(topRowClass(1)).toContain('amber')
    expect(topRowClass(2)).toContain('slate')
    expect(topRowClass(3)).toContain('orange')
    expect(topRowClass(4)).toBe('')
  })
})

describe('error lines', () => {
  it('prefers the server field messages, then the message, then the generic line', () => {
    const fields = new ApiError({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'x',
      fields: { subject: 'Subjek tidak sah.', grade_level: 'Tahap soalan tidak sah.' },
    })
    expect(errorLines(fields)).toEqual(['Subjek tidak sah.', 'Tahap soalan tidak sah.'])
    expect(
      errorLines(
        new ApiError({ status: 409, code: 'CONFLICT', message: 'Pemain belum mencukupi.' }),
      ),
    ).toEqual(['Pemain belum mencukupi.'])
    expect(errorLines(new Error('x'))).toEqual(['Ralat berlaku. Sila cuba lagi.'])
  })
})

describe('room helpers (FR-M16-68..70)', () => {
  it('knows the host, the acting player and when the host may start', () => {
    const r = room()
    expect(isHost(r, 1)).toBe(true)
    expect(isHost(r, 2)).toBe(false)
    expect(canStart(r)).toBe(true)
    expect(canStart(room({ players: [r.players[0]!] }))).toBe(false)
    expect(canAct(r, 1)).toBe(false) // no state yet
    expect(
      canAct(
        room({
          status: 'playing',
          state: { awaiting: 'answer', round: 1, total: 15, humanId: 1, log: [] },
        }),
        1,
      ),
    ).toBe(true)
  })

  it('polls only waiting and playing rooms', () => {
    expect(isOpenRoom(room({ status: 'waiting' }))).toBe(true)
    expect(isOpenRoom(room({ status: 'playing' }))).toBe(true)
    expect(isOpenRoom(room({ status: 'finished' }))).toBe(false)
    expect(isOpenRoom(room({ status: 'closed' }))).toBe(false)
  })

  it('measures the answer seconds in 0..15 and builds the #28 body', () => {
    expect(answerSeconds(0)).toBe(0)
    expect(answerSeconds(3)).toBe(3)
    expect(answerSeconds(99)).toBe(15)
    expect(answerBody(7, { optionId: 2 }, 3)).toEqual({
      type: 'answer',
      questionId: 7,
      optionId: 2,
      seconds: 3,
    })
    expect(answerBody(7, { value: 'kucing' }, 4)).toEqual({
      type: 'answer',
      questionId: 7,
      optionId: null,
      value: 'kucing',
      seconds: 4,
    })
  })

  it('reads the last dice value', () => {
    expect(lastRoll(undefined)).toBeNull()
    expect(lastRoll([])).toBeNull()
    expect(lastRoll(['roll:2', 'x', 'roll:6'])).toBe(6)
  })

  it('maps board tiles', () => {
    expect(tileView('quiz').emoji).toBe('❓')
    expect(tileView('ladder:23').emoji).toBe('🪜')
    expect(tileView('snake:4').emoji).toBe('🐍')
    expect(tileView('plain').emoji).toBe('')
    expect(tileTarget('ladder:23')).toBe(23)
    expect(tileTarget('bonus')).toBeNull()
  })

  it('writes the per-game metric and round lines (§8.2)', () => {
    const state = (extra: object) => ({
      awaiting: 'answer' as const,
      round: 3,
      total: 15,
      humanId: 1,
      log: [],
      ...extra,
    })
    const pf = room({ status: 'playing', state: state({}) })
    expect(roundText(pf)).toBe('Pusingan 3/15')
    expect(metricText(pf, pf.players[0]!)).toBe('0 mata')
    const bi = room({
      game: 'benteng-ilmu',
      status: 'playing',
      state: state({ meter: { '1': 60 } }),
    })
    expect(metricText(bi, bi.players[0]!)).toBe('HP 60')
    const pm = room({
      game: 'perlumbaan-matematik',
      status: 'playing',
      state: state({ meter: { '1': 7 } }),
    })
    expect(metricText(pm, pm.players[0]!)).toBe('7/20 langkah')
    const pb = room({
      game: 'papan-bijak',
      status: 'playing',
      state: state({ positions: { '1': 12 } }),
    })
    expect(metricText(pb, pb.players[0]!)).toBe('Petak 12/50')
    expect(roundText(pb)).toBe('')
    const tk = room({
      game: 'teka-silang-kata',
      status: 'playing',
      state: state({ total: 8, round: 2 }),
    })
    expect(roundText(tk)).toBe('Kata 2/8')
  })

  it('writes the result headline (winner, draw, team + MVP)', () => {
    const base = { winnerId: 1, winnerName: 'Admin Demo', mvpId: null, scores: [] }
    expect(resultHeadline(room({ status: 'finished', result: base }))).toEqual({
      title: '🏆 Admin Demo menang!',
    })
    expect(
      resultHeadline(
        room({ status: 'finished', result: { ...base, winnerId: null, winnerName: null } }),
      ),
    ).toEqual({ title: '🤝 Seri' })
    const relay = room({
      game: 'kuiz-relay',
      status: 'finished',
      players: [
        { id: 1, name: 'Admin Demo', grade: 'Darjah 4', points: 5, isBot: false, team: 1 },
        { id: 2, name: 'Pelajar Dua', grade: 'Darjah 4', points: 30, isBot: true, team: 2 },
      ],
      result: { winnerId: null, winnerName: null, mvpId: 2, scores: [] },
    })
    expect(resultHeadline(relay)).toEqual({
      title: '🏆 Pasukan B menang!',
      mvp: 'MVP: Pelajar Dua',
    })
    expect(resultHeadline(room())).toBeNull()
  })

  it('formats clock and team labels', () => {
    expect(clock(300)).toBe('5:00')
    expect(clock(61)).toBe('1:01')
    expect(clock(-3)).toBe('0:00')
    expect(teamLabel(1)).toBe('A')
    expect(teamLabel(2)).toBe('B')
  })
})
