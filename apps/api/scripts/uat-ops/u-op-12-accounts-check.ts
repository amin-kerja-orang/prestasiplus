/**
 * U-OP-12 accounts check for S4-T08 (PRD30 U-OP-12, plan section 7): the acceptance accounts exist on the dedicated test school. READ-ONLY and
 * report-only: it creates nothing and has no `--apply`; the accounts are made by an Admin with "Janakan Akaun" in the Portal Pentadbiran.
 *
 *   DATABASE_URL=... npx tsx apps/api/scripts/uat-ops/u-op-12-accounts-check.ts --school-id <id>
 *
 * `--school-id` is required: without the school the check would be met by the real accounts of every other school. Per slot, one PASS/FAIL line:
 *   - a usable pupil in each of T1, T2, T4 and T5 (T3 is INFO only: PRD30 lists T5, T4, T2, T1; the plan table adds T3);
 *   - a usable teacher;
 *   - the school is an active SMK and has a usable Admin Sekolah (role `school_admin`).
 * INFO: pupils, teachers and Admin Pusat counts. "Usable" = active, not suspended, a password set (so it can log in). That an account really logs in
 * and reaches its portal is a human step on UAT; this script only proves the rows exist.
 * Output: counts, level codes, roles and row ids (first 3 per slot). Never a name, e-mail, phone, IC value or password hash.
 * Exit code 0 ok, 1 a slot is missing, 2 usage or environment error.
 */
import type { Client } from 'pg'

import { exitCodeOf, formatLine, isMain, line, openDb, parseUatArgs, UsageError, writeReport, type CheckLine, type UatArgsSpec } from './lib'

export const SPEC: UatArgsSpec = { name: 'u-op-12-accounts-check', allowApply: false, flags: { 'school-id': { type: 'string' } } }

/** Pupil levels that must exist (T3 is reported but not required, see the header). */
export const REQUIRED_LEVELS = ['T1', 'T2', 'T4', 'T5'] as const
export const OPTIONAL_LEVELS = ['T3'] as const

/** One role (and, for pupils, level) group of the test school (SQL below). */
export interface AccountGroup {
  role: string
  /** `T1`..`T5` for pupils whose grade maps to a level, else null. */
  level_code: string | null
  total: number
  usable: number
  /** Up to 3 ids of usable accounts. */
  ids: string[] | null
}

/** The school row, or null when the id matches no school. */
export interface SchoolRow {
  id: string
  type: string | null
  is_active: boolean
  admins_usable: number
  admin_ids: string[] | null
}

export const USABLE = `u.is_active AND NOT u.is_suspended AND u.password_hash IS NOT NULL`

export const GROUPS_SQL = `
  SELECT r.role, l.code AS level_code, count(*)::int AS total,
         count(*) FILTER (WHERE ${USABLE})::int AS usable,
         (array_agg(u.id::text ORDER BY u.id) FILTER (WHERE ${USABLE}))[1:3] AS ids
    FROM users u
    JOIN user_roles r ON r.user_id = u.id
    LEFT JOIN education_levels l ON l.grade = u.grade AND l.code = ANY($2::text[]) AND r.role = 'student'
   WHERE u.school_id = $1::bigint
   GROUP BY r.role, l.code
   ORDER BY r.role, l.code`

export const SCHOOL_SQL = `
  SELECT s.id::text AS id, s.type, s.is_active,
         (SELECT count(*)::int FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'school_admin' WHERE u.school_id = s.id AND ${USABLE}) AS admins_usable,
         (SELECT (array_agg(u.id::text ORDER BY u.id))[1:3] FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'school_admin' WHERE u.school_id = s.id AND ${USABLE}) AS admin_ids
    FROM schools s WHERE s.id = $1::bigint`

export const ADMIN_PUSAT_SQL = `
  SELECT count(*)::int AS usable FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'admin' WHERE ${USABLE}`

const idsText = (ids: string[] | null): string => (ids && ids.length > 0 ? ` (ids ${ids.join(', ')})` : '')

/** Pure: the query results -> report lines. */
export function accountLines(groups: readonly AccountGroup[], school: SchoolRow | null, adminPusatUsable: number): CheckLine[] {
  if (!school) return [line('FAIL', 'the school id matches no school')]
  const out: CheckLine[] = []
  out.push(
    school.is_active && school.type === 'SMK'
      ? line('PASS', `school ${school.id} is an active SMK`)
      : line('FAIL', `school ${school.id} is ${school.is_active ? 'active' : 'inactive'}, type ${school.type ?? 'unset'}; expected an active SMK`),
  )
  out.push(
    school.admins_usable > 0
      ? line('PASS', `Admin Sekolah: ${String(school.admins_usable)} usable${idsText(school.admin_ids)}`)
      : line('FAIL', 'Admin Sekolah: none usable on the school (create it with "Janakan Akaun Admin Sekolah", S6-T05)'),
  )
  const pupil = (code: string): AccountGroup | undefined => groups.find((g) => g.role === 'student' && g.level_code === code)
  for (const code of [...REQUIRED_LEVELS, ...OPTIONAL_LEVELS]) {
    const g = pupil(code)
    const required = (REQUIRED_LEVELS as readonly string[]).includes(code)
    const usable = g?.usable ?? 0
    const text = `pupil ${code}: ${String(usable)} usable of ${String(g?.total ?? 0)}${idsText(g?.ids ?? null)}`
    out.push(usable > 0 ? line('PASS', text) : line(required ? 'FAIL' : 'INFO', required ? `${text}; create one` : `${text} (optional)`))
  }
  const teacher = groups.find((g) => g.role === 'teacher')
  out.push(
    (teacher?.usable ?? 0) > 0
      ? line('PASS', `teacher: ${String(teacher?.usable)} usable of ${String(teacher?.total)}${idsText(teacher?.ids ?? null)}`)
      : line('FAIL', `teacher: ${String(teacher?.usable ?? 0)} usable of ${String(teacher?.total ?? 0)}; create one`),
  )
  const pupils = groups.filter((g) => g.role === 'student')
  out.push(line('INFO', `school pupils: ${String(pupils.reduce((n, g) => n + g.total, 0))} (usable ${String(pupils.reduce((n, g) => n + g.usable, 0))}); teachers ${String(teacher?.total ?? 0)} (operator checklist FR-AS-0-1 expects 50 pupils and 3 teachers)`))
  out.push(line('INFO', `Admin Pusat accounts usable (all schools): ${String(adminPusatUsable)}`))
  return out
}

/** The school id as text, digits only (it is bound as a parameter, never pasted into SQL). */
export function parseSchoolId(raw: unknown): string {
  if (typeof raw !== 'string' || !/^[1-9][0-9]{0,17}$/.test(raw)) throw new UsageError('--school-id <id> is required (the dedicated test school, digits only)')
  return raw
}

export async function collectAccounts(client: Client, schoolId: string): Promise<{ groups: AccountGroup[]; school: SchoolRow | null; adminPusat: number }> {
  const groups = (await client.query<AccountGroup>(GROUPS_SQL, [schoolId, [...REQUIRED_LEVELS, ...OPTIONAL_LEVELS]])).rows
  const school = (await client.query<SchoolRow>(SCHOOL_SQL, [schoolId])).rows[0] ?? null
  const adminPusat = (await client.query<{ usable: number }>(ADMIN_PUSAT_SQL)).rows[0]?.usable ?? 0
  return { groups, school, adminPusat }
}

async function main(): Promise<number> {
  const started = new Date()
  let db: Awaited<ReturnType<typeof openDb>> | undefined
  try {
    const args = parseUatArgs(process.argv.slice(2), SPEC)
    const schoolId = parseSchoolId(args.values['school-id'])
    db = await openDb()
    const found = await db.readOnly((c) => collectAccounts(c, schoolId))
    const lines = accountLines(found.groups, found.school, found.adminPusat)
    for (const l of lines) console.log(formatLine(l))
    console.log(`INFO report written: ${writeReport('u-op-12-accounts-check', lines, { now: started })}`)
    return exitCodeOf(lines)
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    return 2
  } finally {
    await db?.close()
  }
}

if (isMain(import.meta.url)) void main().then((code) => process.exit(code))
