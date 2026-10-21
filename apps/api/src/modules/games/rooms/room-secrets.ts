import { randomBytes, randomInt } from 'node:crypto'

import { Injectable } from '@nestjs/common'

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/**
 * Secret randomness of the rooms (not derivable from public input): the per-room seed that goes into every engine
 * stream name, and the room codes. A provider so tests can pin the values.
 */
@Injectable()
export class RoomSecrets {
  /** 128-bit hex seed, generated once per room at create. */
  newSeed(): string {
    return randomBytes(16).toString('hex')
  }

  /** Uniform integer in [0, max) from crypto (secret per-fact draws). */
  int(max: number): number {
    return randomInt(max)
  }

  /** 6 characters from [A-Z0-9], uniformly. */
  roomCode(): string {
    let out = ''
    for (let i = 0; i < 6; i++) out += ALNUM[randomInt(ALNUM.length)]
    return out
  }
}
