/**
 * M10-T1 seeds (SRS M10 v1.18 §6.4, §6.11 "Accounts", S32 rows): the teacher profiles. The classes,
 * enrolments, missions, remedial tests and question sets are F-30 (`seed.ts`); this file adds the one
 * store F-30 did not model.
 *
 * - profile **3** = the admin (user 1): no school, empty bio, subject and qualification, experience 0
 *   (the observed S32; that 3 is a TeacherProfile id is INFERRED);
 * - profile **4** = guru@demo.test (user 5): school SMK DEMO 900001, bio "Guru Kimia dan Bahasa
 *   Melayu.", subject "Kimia, Bahasa Melayu", qualification "Ijazah Sarjana Muda Pendidikan",
 *   experience 8 (designed).
 *
 * Every other user has no profile row (no school, empty fields); the first save creates one with a
 * runtime id from 9,000,001.
 */

import { teacherProfilesRepo, type TeacherProfileRow } from '../repository/teacher-profiles'

export const SEEDED_PROFILES: readonly TeacherProfileRow[] = [
  {
    id: 3,
    userId: 1,
    schoolId: null,
    bio: null,
    subject: null,
    qualification: null,
    experienceYears: 0,
  },
  {
    id: 4,
    userId: 5,
    schoolId: 900_001,
    bio: 'Guru Kimia dan Bahasa Melayu.',
    subject: 'Kimia, Bahasa Melayu',
    qualification: 'Ijazah Sarjana Muda Pendidikan',
    experienceYears: 8,
  },
]

export function seedTeacherProfiles(): void {
  teacherProfilesRepo.seed(SEEDED_PROFILES)
}
