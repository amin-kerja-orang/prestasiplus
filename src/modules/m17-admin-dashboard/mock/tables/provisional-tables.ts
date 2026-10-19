/**
 * Materialised tables of the provisional stores hosted in M17 (F-33). They are guarded for their
 * true owner (M26) through `defineRepository({owner, provisional: true})`; M17 only hosts them.
 * Table names carry the owner prefix so the persistence keys survive the move to the owner. The
 * sponsors table moved to M21 (M21-T1).
 *
 * Runtime ids: `floor`. Mood check-ins and tuition centres are seeded with ids from 1.
 */

import { defineTable, floor, ID_RANGES } from '@/mock/define'

import type { MoodCheckinRow, TuitionCentreRow } from '../repository/provisional-types'

export const moodCheckinsTable = defineTable<MoodCheckinRow>({
  name: 'm26.moodCheckins',
  // Runtime check-ins (the `seedMoodCheckin` hook, later) never collide with the 750 seeded ids.
  ids: floor({ start: ID_RANGES.usersRuntimeFloor }),
  indexes: ['userId', 'mood', 'date'],
})

export const tuitionCentresTable = defineTable<TuitionCentreRow>({
  name: 'm26.tuitionCentres',
  ids: floor({ start: 3 }),
})

export const M17_PROVISIONAL_TABLES = {
  moodCheckins: moodCheckinsTable,
  tuitionCentres: tuitionCentresTable,
}
