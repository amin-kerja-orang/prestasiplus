import { Inject, Injectable } from '@nestjs/common'

import { prngStream } from '../../../db/prng'
import { UsersRepository } from '../../users'
import type { BotCandidate, BotPickInput, BotPoolPort } from './ports'

/**
 * Default bot pool (BR-M16-05, simulation): active students of the HOST'S SCHOOL with a fitting grade not already
 * in the room, picked by a named PRNG stream, so the same room and poll give the same bot.
 *
 * LIMITATION: school-scoped. The mock picked platform-wide; a platform-wide pick needs a BE-05 read
 * (`UsersRepository` has none for "students by grade, platform-wide"). A host without a school gets no bot.
 * Mod Pelajar test actors are not users, so "not test" needs no filter. Open question 3: bots are real pupils shown
 * as players; the lead decides before production.
 */
@Injectable()
export class SchoolBotPool implements BotPoolPort {
  constructor(@Inject(UsersRepository) private readonly users: UsersRepository) {}

  async pick(input: BotPickInput): Promise<BotCandidate | null> {
    const host = await this.users.get(input.hostId)
    if (!host?.schoolId) return null
    const taken = new Set(input.exclude)
    taken.add(input.hostId)
    const rows = await this.users.studentsOfSchool(host.schoolId, '', '')
    const pool = rows
      .filter((r) => r.isActive && !taken.has(r.id) && r.grade !== null && input.fits(r.grade))
      .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0))
    if (pool.length === 0) return null
    const chosen = prngStream(input.stream).pick(pool)
    return { id: chosen.id, name: chosen.name, grade: chosen.grade }
  }
}
