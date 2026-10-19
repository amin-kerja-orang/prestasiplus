/**
 * M13 test hooks (`window.__mock`, dev and e2e builds; SRS M13 v1.1 §6.9). Names are global, so they
 * are the ones the SRS names:
 *
 * | Hook | Effect |
 * |---|---|
 * | `cikguNextReply(text)` | the next canned reply is `text` (e.g. `''`, `'Baris 1\n<b>x</b>'`); tools still run |
 * | `cikguSetTurnsUsed(userId, n)` | today's quota count of the user reads `n` |
 * | `cikguVoice({supported?, transcript?, delays?})` | configures the simulated recogniser (S1) |
 * | `cikguVoiceError()` | fires the error step of the current recogniser session (S1) |
 * | `cikguSpoken()` | the texts passed to the simulated speaker |
 *
 * Each validates its input and throws a `RangeError` / `TypeError`. The voice hooks only touch the
 * shared simulated-voice state (`../../api/voice-sim`); no browser speech API is used (D4).
 */

import { clock } from '@/lib/time'
import { users } from '@/modules/m01-authentication/mock'

import { configureVoice, fireVoiceError, spokenTexts, type VoiceConfig } from '../../api/voice-sim'
import { cikguRepo } from '../repository/cikgu'

/** `mock.cikguNextReply(text)`. */
export function cikguNextReply(text: string): void {
  if (typeof text !== 'string') throw new TypeError('cikguNextReply: expected a string')
  cikguRepo.setNextReply(text)
}

/** `mock.cikguSetTurnsUsed(userId, n)`. */
export function cikguSetTurnsUsed(userId: number, n: number): void {
  if (!Number.isInteger(userId) || userId < 1 || !users.get(userId)) {
    throw new RangeError(`cikguSetTurnsUsed: unknown user ${String(userId)}`)
  }
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`cikguSetTurnsUsed: invalid count ${String(n)}`)
  }
  cikguRepo.setTurnsUsed(userId, n, clock.now())
}

/** `mock.cikguVoice(config)`. */
export function cikguVoice(config: Parameters<typeof configureVoice>[0] = {}): VoiceConfig {
  if (typeof config !== 'object' || config === null) {
    throw new TypeError('cikguVoice: expected {supported?, transcript?, delays?}')
  }
  return configureVoice(config)
}

/** `mock.cikguVoiceError()`. */
export function cikguVoiceError(): void {
  fireVoiceError()
}

/** `mock.cikguSpoken()`. */
export function cikguSpoken(): string[] {
  return spokenTexts()
}

export const m13Hooks = {
  cikguNextReply,
  cikguSetTurnsUsed,
  cikguVoice,
  cikguVoiceError,
  cikguSpoken,
}
