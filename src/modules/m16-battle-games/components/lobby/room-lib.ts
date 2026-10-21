/**
 * Pure helpers of the room page (SRS M16 v1.6 FR-M16-68..70; BR-M16-19/20; PROVISIONAL layouts of §8.2):
 * who may act, the per-game metric text, the result headline, board tiles and the answer body.
 */

import type { RoomActionBody, RoomView } from '../../api'
import { sameId } from '../../api/wire'
import { teamLabel } from './lobby-lib'

type Player = RoomView['players'][number]

/** Longest time a question may take for the speed bonus and the `seconds` field. */
export const MAX_ANSWER_SECONDS = 15

export const isHost = (room: RoomView, userId: number | null): boolean =>
  sameId(room.host.id, userId)

/** The acting player of the room (the host who started it); others watch (BR-M16-19). */
export const canAct = (room: RoomView, userId: number | null): boolean =>
  room.state !== null && sameId(room.state.humanId, userId)

/** Whether the host may start (BR-M16-19: the game's minimum players are in). */
export const canStart = (room: RoomView): boolean =>
  room.status === 'waiting' && room.players.length >= room.settings.minPlayers

/** Whether the room page keeps polling (#26 while the room is open). */
export const isOpenRoom = (room: RoomView): boolean =>
  room.status === 'waiting' || room.status === 'playing'

/** Whole seconds counted since the question appeared, clamped to 0..15 for the answer body. */
export function answerSeconds(sinceQuestion: number): number {
  return Math.min(MAX_ANSWER_SECONDS, Math.max(0, Math.floor(sinceQuestion)))
}

/** The body of #28 for an answer of the acting player. */
export function answerBody(
  questionId: number,
  answer: { optionId?: number; value?: string },
  seconds: number,
): RoomActionBody {
  return {
    type: 'answer',
    questionId,
    optionId: answer.optionId ?? null,
    ...(answer.value === undefined ? {} : { value: answer.value }),
    seconds,
  }
}

/** The last dice value in the room log (`roll:n`), or null. */
export function lastRoll(log: readonly string[] | undefined): number | null {
  for (let i = (log?.length ?? 0) - 1; i >= 0; i--) {
    const m = /^roll:(\d)$/.exec(log?.[i] ?? '')
    if (m) return Number(m[1])
  }
  return null
}

export interface TileView {
  emoji: string
  /** Tailwind classes of the tile background. */
  className: string
}

/** One board tile (BR-M16-20): kinds `start`, `finish`, `plain`, `quiz`, `bonus`, `trap`, `ladder:N`, `snake:N`. */
export function tileView(kind: string): TileView {
  if (kind === 'start') return { emoji: '🚩', className: 'bg-success-soft' }
  if (kind === 'finish') return { emoji: '🏆', className: 'bg-highlight' }
  if (kind === 'quiz') return { emoji: '❓', className: 'bg-primary-soft' }
  if (kind === 'bonus') return { emoji: '🎁', className: 'bg-secondary/12' }
  if (kind === 'trap') return { emoji: '⚠️', className: 'bg-warning-soft' }
  if (kind.startsWith('ladder:')) return { emoji: '🪜', className: 'bg-info-soft' }
  if (kind.startsWith('snake:')) return { emoji: '🐍', className: 'bg-error-soft' }
  return { emoji: '', className: 'bg-elevated' }
}

/** Where a ladder or snake tile leads (`ladder:23` → 23), or null. */
export function tileTarget(kind: string): number | null {
  const m = /^(?:ladder|snake):(\d+)$/.exec(kind)
  return m ? Number(m[1]) : null
}

/** Tailwind classes of a player's marker, by join order. */
export const MARKER_CLASSES = [
  'bg-primary',
  'bg-error',
  'bg-success',
  'bg-warning',
  'bg-info',
  'bg-secondary',
  'bg-highlight',
  'bg-accented',
] as const

export const markerClass = (index: number): string =>
  MARKER_CLASSES[index % MARKER_CLASSES.length] as string

export interface ResultHeadline {
  title: string
  mvp?: string
}

/** The finished headline: "🏆 {name} menang!", Kuiz Relay "🏆 Pasukan {A|B} menang!" + MVP, or a draw. */
export function resultHeadline(room: RoomView): ResultHeadline | null {
  const r = room.result
  if (!r) return null
  if (room.game === 'kuiz-relay') {
    const mvp = room.players.find((p) => p.id === r.mvpId)
    if (!mvp || mvp.team === undefined) return { title: '🤝 Seri' }
    return { title: `🏆 Pasukan ${teamLabel(mvp.team)} menang!`, mvp: `MVP: ${mvp.name}` }
  }
  if (r.winnerName === null) return { title: '🤝 Seri' }
  return { title: `🏆 ${r.winnerName} menang!` }
}

/** The per-game metric line of a player while the room plays (§8.2). */
export function metricText(room: RoomView, player: Player): string {
  const st = room.state
  if (!st) return ''
  const key = String(player.id)
  switch (room.game) {
    case 'papan-bijak':
      return `Petak ${String(st.positions?.[key] ?? 1)}/50`
    case 'benteng-ilmu':
      return `HP ${String(st.meter?.[key] ?? 100)}`
    case 'perlumbaan-matematik':
      return `${String(st.meter?.[key] ?? 0)}/20 langkah`
    case 'teka-silang-kata':
      return `${String(st.meter?.[key] ?? 0)} kata`
    case 'perang-fakta':
    case 'kuiz-relay':
      return `${String(player.points)} mata`
  }
}

/** The round line of the play area ("Pusingan 3/15"), or "" for games without rounds. */
export function roundText(room: RoomView): string {
  const st = room.state
  if (!st) return ''
  if (room.game === 'perang-fakta' || room.game === 'kuiz-relay') {
    return `Pusingan ${String(Math.min(st.round, st.total))}/${String(st.total)}`
  }
  if (room.game === 'teka-silang-kata') {
    return `Kata ${String(Math.min(st.round, st.total))}/${String(st.total)}`
  }
  return ''
}

/** Play-area mode of the question card for a game. */
export function questionMode(room: RoomView): 'mcq' | 'word' {
  return room.game === 'teka-silang-kata' ? 'word' : 'mcq'
}
