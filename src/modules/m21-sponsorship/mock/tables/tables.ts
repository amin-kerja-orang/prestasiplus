/**
 * Materialised tables of M21 (SRS M21 v1.2 §6.10). The sponsors table is moved from M17's
 * provisional host (F-33) and keeps its name `m21.sponsors` (so the persistence key is unchanged) and
 * runtime ids from 12 (seed ids 6-11 as observed; 1-5 absent as on live).
 *
 * Anak angkat: runtime ids from 3 (seed record 2, loaded by M21-T3). Applications: runtime ids from 4
 * (seed rows 1-3, loaded by M21-T3). Both tables are empty until then.
 */

import { defineTable, floor } from '@/mock/define'

import type { AnakAngkatRow, FosterApplicationRow, SponsorRow } from '../repository/types'

export const sponsorsTable = defineTable<SponsorRow>({
  name: 'm21.sponsors',
  ids: floor({ start: 12 }),
  indexes: ['status', 'userId'],
})

export const anakAngkatTable = defineTable<AnakAngkatRow>({
  name: 'm21.anakAngkat',
  ids: floor({ start: 3 }),
  indexes: ['sponsorId', 'status', 'studentId'],
})

export const fosterApplicationsTable = defineTable<FosterApplicationRow>({
  name: 'm21.fosterApplications',
  ids: floor({ start: 4 }),
  indexes: ['status', 'studentId', 'applicantUserId'],
})

export const M21_TABLES = {
  sponsors: sponsorsTable,
  anakAngkat: anakAngkatTable,
  fosterApplications: fosterApplicationsTable,
}
