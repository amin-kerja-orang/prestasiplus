/**
 * Materialised tables of the provisional stores hosted in M17 (F-33). They are guarded for their
 * true owners (M26 and M21) through `defineRepository({owner, provisional: true})`; M17 only hosts
 * them. Table names carry the owner prefix so the persistence keys survive the move to the owner.
 *
 * Runtime ids: `floor`. Mood check-ins and tuition centres are seeded with ids from 1; sponsors
 * with the observed ids 6–11 (M21 §6.2: 1–5 absent as on live, runtime from 12).
 */

import { defineTable, floor, ID_RANGES } from '@/mock/define'

import type { MoodCheckinRow, SponsorRow, TuitionCentreRow } from '../repository/provisional-types'

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

export const sponsorsTable = defineTable<SponsorRow>({
  name: 'm21.sponsors',
  ids: floor({ start: 12 }),
  indexes: ['status', 'userId'],
})

export const M17_PROVISIONAL_TABLES = {
  moodCheckins: moodCheckinsTable,
  tuitionCentres: tuitionCentresTable,
  sponsors: sponsorsTable,
}
