import { Inject, Injectable } from '@nestjs/common'

import type { TxClient } from '../../db/client'
import { CLOCK, type Clock, mytDay } from '../../db/clock'
import { isIdString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { EMPTY_STREAK, stepStreak, type StreakState } from './rules'
import { STREAK_FUTURE_SKEW_MS, STREAK_MULTIPLIER } from './wallet.constants'
import { WalletRepository, type Db } from './wallet.repository'
import type { StreakView } from './wallet.types'

function assertUser(userId: string): void {
  if (!isIdString(userId)) throw new RangeError('StreakService: invalid user id')
}

const view = (s: StreakState): StreakView => ({ ...s, multiplier: STREAK_MULTIPLIER })

/**
 * The daily streak, by Malaysia day (BR-M14-14, Q8): "today" is the calendar day in `Asia/Kuala_Lumpur` of the
 * injected `Clock` (or of the `at` the caller passes, for example the completion time of a session), never the
 * server's local day. Owner of `streaks` and `daily_login_marks`; callers use these methods and never write
 * the tables.
 *
 * Like `WalletService`, every write uses the caller's transaction (`tx`, else the ambient one, else its own)
 * and locks the user's streak row, so two activities of one user cannot lose an update.
 *
 * LOCK ORDER (`LOCK_ORDER` in wallet.constants.ts): streak first, then wallet. A caller that updates both in one
 * transaction calls `touch` BEFORE `WalletService.credit`. This service never locks a wallet.
 */
@Injectable()
export class StreakService {
  constructor(
    private readonly repo: WalletRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** The stored streak (reads never decay it, BR-M14-14); 0 / 0 / null / 0 for a user without a row. */
  async get(userId: string, options: { tx?: TxClient } = {}): Promise<StreakView> {
    assertUser(userId)
    const row = await this.repo.streak(this.repo.handle(options.tx), userId)
    return view(row ?? EMPTY_STREAK)
  }

  /**
   * Records a qualifying activity (a completed session, a student's password login) and returns the new
   * streak. On the same Malaysia day nothing changes (`changed: false`); on the next day `current` + 1;
   * after a gap `current` restarts at 1; `best` is the maximum; `totalDays` grows on each new streak day.
   *
   * `at` (optional) is the moment of a LATE completion, taken from SERVER state (a stored session completion
   * time), never from a request. It may be in the past, but not in the future: an `at` more than
   * `STREAK_FUTURE_SKEW_MS` (5 minutes, clock skew) after the server clock throws a `RangeError` and writes
   * nothing, so a caller cannot farm days ahead. (Chosen over clamping: a wrong `at` is a caller bug that
   * must be seen, not hidden.)
   *
   * An `at` on a day BEFORE the last activity (a late or replayed event) changes nothing (`changed: false`):
   * the streak never moves backwards.
   */
  async touch(userId: string, options: { at?: Date; tx?: TxClient } = {}): Promise<StreakView & { changed: boolean }> {
    assertUser(userId)
    return this.run(options.tx, async (db) => {
      const now = this.clock.now()
      const at = options.at ?? now
      if (!(at instanceof Date) || Number.isNaN(at.getTime())) throw new RangeError('StreakService.touch: invalid time')
      if (at.getTime() > now.getTime() + STREAK_FUTURE_SKEW_MS) throw new RangeError('StreakService.touch: at is in the future')
      await this.repo.ensureStreak(db, userId, at)
      const before = await this.repo.lockStreak(db, userId)
      const state: StreakState = before ?? { ...EMPTY_STREAK }
      const next = stepStreak(state, mytDay(at))
      const changed = next !== state
      if (changed) await this.repo.saveStreak(db, userId, next, at)
      return { ...view(next), changed }
    })
  }

  /**
   * Marks the first password login of the Malaysia day (BR-M14-14: the +2 `daily_login` credit is paid once a
   * day). `firstToday` is true for the call that wrote the mark and false for every later call of the same day.
   * The day is ALWAYS the server clock's (`Clock.now()`): there is no caller time, so a login cannot be marked
   * for another day. Crediting the syiling stays with the caller (`WalletService.credit`, source `daily_login`,
   * key `daily_login:<day>`), only when `firstToday` is true.
   */
  async markDailyLogin(userId: string, options: { tx?: TxClient } = {}): Promise<{ firstToday: boolean; day: string }> {
    assertUser(userId)
    return this.run(options.tx, async (db) => {
      const at = this.clock.now()
      const day = mytDay(at)
      return { firstToday: await this.repo.insertDailyLoginMark(db, userId, day, at), day }
    })
  }

  private run<T>(tx: TxClient | undefined, fn: (db: Db) => Promise<T>): Promise<T> {
    return tx ? fn(tx) : this.prisma.transaction((t) => fn(t))
  }
}
