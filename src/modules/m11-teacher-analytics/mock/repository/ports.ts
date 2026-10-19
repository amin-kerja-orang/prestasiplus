/**
 * The M16 read port (SRS M11 v1.10 §6.1 "Battle/game records", BR-M11-04/05; M16 v1.3 §7.2, XR-M16-05).
 *
 * M11 S1 shows "Battle" and "Permainan" counts and the Battle score bar. They are read from M16's
 * `battles.countFor(userIds, {from, to})` and `gameResults.countFor(userIds, {from, to})`, each **one
 * call returning the counts per user id**. M16 (battles, game results) is built by a later task, so
 * M11 reads them through this **port**: until M16 calls `registerM16Reads` the port is empty (no user has
 * a battle or game), which is also the SRS value for every observed and designed M11 view — the seed
 * battle players are in no M10 class (§6.1), so the S1 population never contains them.
 *
 * Contract (the M16 task implements and registers it from its seed; nothing here is reset by the M11
 * seed, so a registration is never wiped; precedent: M08 `headcount-port.ts`):
 * - `from` inclusive, `to` exclusive, epoch milliseconds (the S1 window is
 *   00:00 of today − (range − 1) → now, and one day each for the trend);
 * - `battles.countFor(userIds, range)` → `Map<userId, {count, correct, answered}>`: for each user the
 *   finished and forfeited battles they played, both sides (`count` battles; `correct` / `answered`
 *   over that user's answers); users with none may be absent;
 * - `gameResults.countFor(userIds, range)` → `Map<userId, {count}>`: each user's game results;
 * - only ids in `userIds` may appear in the result.
 */

export interface TimeRange {
  /** Epoch ms, inclusive. */
  from: number
  /** Epoch ms, exclusive. */
  to: number
}

export interface BattleCounts {
  count: number
  correct: number
  answered: number
}

export interface GameCounts {
  count: number
}

export interface M16Reads {
  battles: {
    countFor(userIds: readonly number[], range: TimeRange): ReadonlyMap<number, BattleCounts>
  }
  gameResults: {
    countFor(userIds: readonly number[], range: TimeRange): ReadonlyMap<number, GameCounts>
  }
}

const EMPTY: M16Reads = {
  battles: { countFor: () => new Map() },
  gameResults: { countFor: () => new Map() },
}

let reader: M16Reads = EMPTY

/** Called by M16: replaces the reader (until then the port reads 0). */
export function registerM16Reads(next: M16Reads): void {
  reader = next
}

/** Test helper: back to the empty reader. */
export function resetM16Reads(): void {
  reader = EMPTY
}

export const m16Reads: M16Reads = {
  battles: { countFor: (ids, range) => reader.battles.countFor(ids, range) },
  gameResults: { countFor: (ids, range) => reader.gameResults.countFor(ids, range) },
}
