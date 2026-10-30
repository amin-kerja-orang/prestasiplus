import { Prisma } from '../../../db/generated/client'
import { PRIMARY_SCHOOL_TYPES } from '../../schools/schools.constants'

/**
 * Secondary-only (D72, OQ-06): Command Center pupil counts leave out the hidden primary population: a pupil of Darjah 1-6
 * (`users.grade` below 7) and a pupil of a primary school (`PRIMARY_SCHOOL_TYPES`). `VISIBLE_USER_SQL` takes the alias `u` of the
 * users table; `VISIBLE_SCHOOL_SQL` takes the alias `sc` of the schools table.
 */
export const VISIBLE_SCHOOL_SQL = Prisma.sql`(sc.type IS NULL OR sc.type NOT IN (${Prisma.join([...PRIMARY_SCHOOL_TYPES])}))`

export const VISIBLE_USER_SQL = Prisma.sql`(u.grade IS NULL OR u.grade >= 7) AND (u.school_id IS NULL OR NOT EXISTS (SELECT 1 FROM schools vs WHERE vs.id = u.school_id AND vs.type IN (${Prisma.join([...PRIMARY_SCHOOL_TYPES])})))`
