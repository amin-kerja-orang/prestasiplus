/**
 * Identity steps of `migrate:core` (v2-data-migration.md 6.1 step 2): users with their role, teacher
 * profile and scope rows, and parent links. The clear IC and the legacy password never reach a v2 table,
 * a log, a report or `etl_rejects` (the transform keeps only the keyed IC hash, the mask and a usable hash).
 */
import type { AnyEntityStep, BatchContext, BatchResult } from '../kit/runner'
import { assertSurrogateLegacyId } from '../kit/sql'
import type { LegacyRow } from '../kit/upsert'
import { heldValues } from './claim'
import type { CoreContext } from './context'
import { rejectRow, sumResults, upsertAndMap } from './helpers'
import { distinctValues, readById, readPairTable, resolveFk, type StagedRow } from './source'
import { parentLinkLegacyId, transformParentLink } from '../transform/classes'
import { roleRejectLabel, transformUser, type UserOutput } from '../transform/users'

const idOf = (row: StagedRow): string => {
  const id = row.id ?? ''
  assertSurrogateLegacyId(id, 'migrate:core')
  return id
}

const USER_COLUMNS = [
  'name', 'email', 'username', 'password_hash', 'must_reset_password', 'ic_hash', 'ic_masked', 'phone', 'school_id',
  'grade', 'class_label', 'bio', 'is_active', 'is_suspended', 'is_complimentary', 'last_login_at', 'created_at', 'updated_at',
] as const

interface SchoolFacts {
  type: string | null
  state: string | null
  district: string | null
}

async function schoolFacts(ctx: BatchContext, ids: readonly string[]): Promise<Map<string, SchoolFacts>> {
  const out = new Map<string, SchoolFacts>()
  if (ids.length === 0) return out
  const res = await ctx.db.query<{ id: string; type: string | null; state: string | null; district: string | null }>(
    `SELECT id::text AS id, type, state, district FROM schools WHERE id = ANY($1::bigint[])`,
    [ids],
  )
  for (const r of res.rows) out.set(r.id, { type: r.type, state: r.state, district: r.district })
  return out
}

export function usersStep(core: CoreContext): AnyEntityStep {
  const entity = 'users'
  return {
    entity,
    source: core.source,
    extract: (after) => readById(core.pool, 'users', after, core.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const schools = await ctx.idMap.resolveMany('schools', distinctValues(rows, 'school_id'))
      const facts = await schoolFacts(ctx, [...new Set(schools.values())])

      const accepted: { legacyId: string; out: UserOutput }[] = []
      for (const row of rows) {
        const legacyId = idOf(row)
        const schoolId = resolveFk(row.school_id, schools)
        const out = transformUser(row, {
          schoolId,
          school: typeof schoolId === 'string' ? (facts.get(schoolId) ?? null) : null,
          ic: core.ic,
          defaultHashes: core.defaultHashes,
        })
        if (!out.ok) {
          rejectRow(ctx, entity, legacyId, out.reject)
          // Roles that are not migrated (agent) are counted by name; any other unknown role is counted together.
          if (out.reject.column === 'role') core.notes.count(`users.role_rejected.${roleRejectLabel(row.role)}`)
        } else accepted.push({ legacyId, out: out.value })
      }

      await dropDuplicateLogins(ctx, core, accepted)

      // Q11: always present in the report, 0 when there is none.
      core.notes.count('nullHashAccounts', 0)
      core.notes.count('flaggedWithoutLoginId', 0)
      for (const r of ['roster_account', 'non_bcrypt', 'shared_default']) core.notes.count(`must_reset.${r}`, 0) // C5 needs 0, not absent
      for (const { legacyId, out } of accepted) {
        core.notes.resetReason(out.notes.resetReasons)
        // Q11 (after dropDuplicateLogins): ids go to the restricted file only, never to the aggregate report or stdout.
        if (out.user.password_hash === null) core.notes.addRestricted('nullHashAccounts', legacyId)
        if (out.user.must_reset_password && out.user.email === null && out.user.username === null) {
          core.notes.addRestricted('flaggedWithoutLoginId', legacyId)
        }
        if (out.notes.icInvalid) core.notes.addId('ic_invalid', legacyId)
        if (out.notes.emailInvalid) core.notes.addId('email_invalid', legacyId)
        if (out.notes.experienceInvalid) core.notes.addId('teaching_experience_invalid', legacyId)
        if (out.ppdUnscoped) core.notes.addId('ppd_officer_without_scope', legacyId)
      }

      const result = await upsertAndMap(
        ctx, entity, 'users', USER_COLUMNS,
        accepted.map((a) => ({ legacyId: a.legacyId, values: a.out.user as unknown as Record<string, unknown> })),
      )

      // Child rows follow the ids the users received (duplicates inside the batch were rejected above).
      const ids = await ctx.idMap.resolveMany(entity, accepted.map((a) => a.legacyId))
      const roles: LegacyRow[] = []
      const scopes: LegacyRow[] = []
      const teachers: LegacyRow[] = []
      for (const { legacyId, out } of accepted) {
        const userId = ids.get(legacyId)
        if (userId === undefined) continue
        roles.push({ legacyId, values: { user_id: userId, role: out.role } })
        if (out.scope) scopes.push({ legacyId, values: { user_id: userId, ...out.scope } })
        if (out.teacher) teachers.push({ legacyId, values: { user_id: userId, ...out.teacher } })
      }
      const derived = [
        await upsertAndMap(ctx, 'user_roles', 'user_roles', ['user_id', 'role'], roles, { register: false }),
        await upsertAndMap(ctx, 'user_scopes', 'user_scopes', ['user_id', 'role', 'level', 'state_code', 'district_code', 'school_id'], scopes, { register: false }),
        await upsertAndMap(ctx, 'teacher_profiles', 'teacher_profiles', ['user_id', 'subject', 'qualification', 'experience_years'], teachers, { register: false }),
      ]
      for (const [name, r] of [['user_roles', derived[0]], ['user_scopes', derived[1]], ['teacher_profiles', derived[2]]] as const) {
        core.notes.count(`derived.${name}`, (r?.inserted ?? 0) + (r?.updated ?? 0) + (r?.unchanged ?? 0))
      }
      return result
    },
  }
}

/**
 * Q2: duplicate people are kept as separate accounts and reported. An e-mail (case-insensitive) or a
 * username within a school (case-insensitive) that another account already holds is dropped from the LATER
 * account, because v2 enforces both as unique. The account itself is migrated. Ids only in the report.
 */
async function dropDuplicateLogins(
  ctx: BatchContext,
  core: CoreContext,
  accepted: { legacyId: string; out: UserOutput }[],
): Promise<void> {
  const emails = new Set<string>()
  const names = new Set<string>()
  for (const a of accepted) {
    const u = a.out.user
    if (u.email !== null) {
      if (emails.has(u.email)) {
        u.email = null
        core.notes.addId('duplicate_email', a.legacyId)
      } else emails.add(u.email)
    }
    if (u.username !== null && u.school_id !== null) {
      const key = `${u.school_id}|${u.username.toLowerCase()}`
      if (names.has(key)) {
        u.username = null
        core.notes.addId('duplicate_username', a.legacyId)
      } else names.add(key)
    }
  }

  const heldEmail = await heldValues(ctx.db, { table: 'users', expr: 'lower(email)' }, [...emails])
  const heldName = await heldValues(
    ctx.db,
    { table: 'users', expr: `school_id::text || '|' || lower(username)` },
    [...names],
  )
  const foreign = (holders: { source: string | null; legacyId: string | null }[] | undefined, legacyId: string): boolean =>
    (holders ?? []).some((h) => !(h.source === ctx.source && h.legacyId === legacyId))
  for (const a of accepted) {
    const u = a.out.user
    if (u.email !== null && foreign(heldEmail.get(u.email), a.legacyId)) {
      u.email = null
      core.notes.addId('duplicate_email', a.legacyId)
    }
    if (u.username !== null && u.school_id !== null && foreign(heldName.get(`${u.school_id}|${u.username.toLowerCase()}`), a.legacyId)) {
      u.username = null
      core.notes.addId('duplicate_username', a.legacyId)
    }
  }
}

// ---------------------------------------------------------------- parent links

export function parentLinksStep(core: CoreContext): AnyEntityStep {
  const entity = 'parent_links'
  return {
    entity,
    source: core.source,
    extract: (after) => readPairTable(core.pool, 'parent_student', 'parent_id', 'student_id', after, core.pageSize),
    keyOf: parentLinkLegacyId,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const users = await ctx.idMap.resolveMany('users', [...distinctValues(rows, 'parent_id'), ...distinctValues(rows, 'student_id')])
      const items: LegacyRow[] = []
      for (const row of rows) {
        const legacyId = parentLinkLegacyId(row)
        const out = transformParentLink(row, {
          parentId: resolveFk(row.parent_id, users) ?? undefined,
          studentId: resolveFk(row.student_id, users) ?? undefined,
        })
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else items.push({ legacyId, values: out.value as unknown as Record<string, unknown> })
      }
      const result = await upsertAndMap(ctx, entity, 'parent_links', ['parent_id', 'student_id', 'relationship', 'created_at', 'updated_at'], items, { register: false })
      return sumResults(result)
    },
  }
}
