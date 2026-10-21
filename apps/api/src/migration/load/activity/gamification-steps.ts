/**
 * Gamification activity of `migrate:activity` (BE-29 Part B): challenge completions, achievement unlocks, referral
 * codes, referrals and SPM targets. Runs in the `activity` group after Part A's wallet-bound steps.
 *
 * Every row is loaded, rejected with a reason code, or excluded by a documented rule.
 */
import type pg from 'pg'

import { STAGING_SCHEMA } from '../../ddl/spec'
import type { AnyEntityStep, BatchContext, BatchResult } from '../../kit/runner'
import { assertSurrogateLegacyId, quoteIdent } from '../../kit/sql'
import type { LegacyRow } from '../../kit/upsert'
import { excludedResult, klDateSql, sumBatch } from '../../transform/activity-common'
import { pairId, stamps } from '../../transform/common'
import {
  completionLegacyId,
  parseSpmTargets,
  transformCompletion,
  transformReferral,
  transformReferralCode,
  transformSpmTarget,
  transformUnlock,
  type CompletionRow,
  type SpmEntry,
  type UnlockRow,
} from '../../transform/gamification'
import { dropConflicts } from '../claim'
import { rejectRow, upsertAndMap } from '../helpers'
import { distinctValues, type StagedRow } from '../source'
import { readExpanded, type Expanded } from './catalogue-steps'
import type { ActivityContext } from './context'

// ---------------------------------------------------------------- keyed pair reader

interface PairReaderSpec {
  table: string
  /** The two key columns of the pivot (bigint); a null sorts as -1. */
  a: string
  b: string
  /** Extra columns of the first level (alias `t`), comma-separated, static loader text. */
  level1: string
  /** Window expressions of the second level; must define `_rk` and `_rn` (bigint). */
  level2: string
  /** Output columns (text) of the final select, comma-separated. */
  outputs: string
}

export interface PairRow {
  key: string
  row: Record<string, string | null>
}

const HIGH = '9223372036854775807'

/**
 * Keyset reader for a pivot without a primary key whose rows are told apart by derived ordinals. A page is a run of
 * whole (a, b) pairs, and the resume key `ka|kb|rk|rn` also names the row inside its pair, so a checkpoint in the
 * middle of a pair continues with the rest of it instead of skipping it.
 */
export async function* readPairKeyed(pool: pg.Pool, spec: PairReaderSpec, afterKey: string | null, pageSize: number): AsyncGenerator<PairRow> {
  const from = `${quoteIdent(STAGING_SCHEMA)}.${quoteIdent(spec.table)}`
  const a = `t.${quoteIdent(spec.a)}`
  const b = `t.${quoteIdent(spec.b)}`
  const pairKey = `(coalesce(${a}, -1), coalesce(${b}, -1))`
  let after = { ka: '-2', kb: '-2', rk: '0', rn: '0' }
  if (afterKey !== null) {
    const [ka, kb, rk, rn] = afterKey.split('|')
    after = { ka: ka ?? '-2', kb: kb ?? '-2', rk: rk ?? '0', rn: rn ?? '0' }
  }
  for (;;) {
    const pairs = await pool.query<{ ka: string; kb: string }>(
      `SELECT DISTINCT coalesce(${a}, -1) AS ka, coalesce(${b}, -1) AS kb FROM ${from} t
       WHERE ${pairKey} >= ($1::bigint, $2::bigint) ORDER BY 1, 2 LIMIT $3`,
      [after.ka, after.kb, pageSize],
    )
    const lo = pairs.rows[0]
    const hi = pairs.rows[pairs.rows.length - 1]
    if (!lo || !hi) return
    const res = await pool.query<Record<string, string | null>>(
      `WITH l1 AS (
         SELECT ${spec.level1}, coalesce(${a}, -1) AS _ka, coalesce(${b}, -1) AS _kb FROM ${from} t
         WHERE ${pairKey} >= ($1::bigint, $2::bigint) AND ${pairKey} <= ($3::bigint, $4::bigint)
       ), l2 AS (SELECT l1.*, ${spec.level2} FROM l1)
       SELECT ${spec.outputs}, _ka::text AS k_a, _kb::text AS k_b, _rk::text AS k_rk, _rn::text AS k_rn FROM l2
       WHERE (_ka, _kb, _rk, _rn) > ($5::bigint, $6::bigint, $7::bigint, $8::bigint)
       ORDER BY l2._ka, l2._kb, l2._rk, l2._rn`,
      [lo.ka, lo.kb, hi.ka, hi.kb, after.ka, after.kb, after.rk, after.rn],
    )
    for (const row of res.rows) yield { key: `${row.k_a}|${row.k_b}|${row.k_rk}|${row.k_rn}`, row }
    if (pairs.rows.length < pageSize) return
    after = { ka: hi.ka, kb: hi.kb, rk: HIGH, rn: HIGH }
  }
}

/** Rows of `challenge_user`: one per day claimed; ordinals per pair (`rk` = day number) and per day (`rn` = repeat number). */
export function readCompletionRows(pool: pg.Pool, afterKey: string | null, pageSize: number): AsyncGenerator<PairRow> {
  return readPairKeyed(
    pool,
    {
      table: 'challenge_user',
      a: 'challenge_id',
      b: 'user_id',
      level1: `t.challenge_id::text AS challenge_id, t.user_id::text AS user_id, t.progress AS _progress, t.completed_at AS _ca,
         coalesce(t.claimed_on, ${klDateSql('t.completed_at')}) AS _d,
         coalesce(t.completed_at, (t.claimed_on::timestamp AT TIME ZONE 'Asia/Kuala_Lumpur')) AS _c`,
      level2: `CASE WHEN _d IS NULL THEN 0 ELSE dense_rank() OVER (PARTITION BY _ka, _kb ORDER BY _d) END AS _rk,
         row_number() OVER (PARTITION BY _ka, _kb, _d ORDER BY _ca NULLS LAST, _progress NULLS LAST) AS _rn`,
      outputs: `challenge_id, user_id, _d::text AS dkey, _c::text AS cat`,
    },
    afterKey,
    pageSize,
  )
}

/** Rows of `achievement_user`; `rn` numbers the repeats of one (achievement, user) pair, earliest unlock first. */
export function readUnlockRows(pool: pg.Pool, afterKey: string | null, pageSize: number): AsyncGenerator<PairRow> {
  return readPairKeyed(
    pool,
    {
      table: 'achievement_user',
      a: 'achievement_id',
      b: 'user_id',
      level1: `t.achievement_id::text AS achievement_id, t.user_id::text AS user_id, t.unlocked_at AS _u, t.unlocked_at::text AS unlocked_at`,
      level2: `1 AS _rk, row_number() OVER (PARTITION BY _ka, _kb ORDER BY _u NULLS LAST) AS _rn`,
      outputs: `achievement_id, user_id, unlocked_at`,
    },
    afterKey,
    pageSize,
  )
}

const keyOfPair = (r: PairRow): string => r.key

// ---------------------------------------------------------------- challenge completions

/**
 * `challenge_user` -> `challenge_completions`. The completion day is `claimed_on`, else the Malaysia date of `completed_at`;
 * a row with neither is excluded. The pivot holds one row per claimed day, so the legacy id is `challenge:user:day-ordinal`
 * (the plain pair would make a second day overwrite the first); a repeat of (user, challenge, day) is DUPLICATE_KEY.
 */
export function completionsStep(a: ActivityContext): AnyEntityStep {
  const entity = 'challenge_completions'
  return {
    entity,
    source: a.source,
    extract: (after) => readCompletionRows(a.pool, after, a.pageSize),
    keyOf: keyOfPair,
    async load(rows: PairRow[], ctx: BatchContext): Promise<BatchResult> {
      const users = await ctx.idMap.resolveMany('users', distinctValues(rows.map((r) => r.row), 'user_id'))
      const challenges = await ctx.idMap.resolveMany('challenges', distinctValues(rows.map((r) => r.row), 'challenge_id'))
      let excluded = 0
      const items: LegacyRow[] = []
      for (const r of rows) {
        const row: CompletionRow = {
          challenge_id: r.row.challenge_id ?? null,
          user_id: r.row.user_id ?? null,
          dkey: r.row.dkey ?? null,
          cat: r.row.cat ?? null,
          rk: Number(r.row.k_rk),
          rn: Number(r.row.k_rn),
        }
        const legacyId = completionLegacyId(row)
        assertSurrogateLegacyId(legacyId, 'migrate:activity')
        const out = transformCompletion(row, {
          userId: row.user_id === null ? undefined : users.get(row.user_id),
          challengeId: row.challenge_id === null ? undefined : challenges.get(row.challenge_id),
        })
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else if ('excluded' in out) excluded++
        else items.push({ legacyId, values: out.value as unknown as Record<string, unknown> })
      }
      a.notes.count('challenge_completions.no_day', excluded)
      const res = await upsertAndMap(
        ctx, entity, 'challenge_completions',
        ['user_id', 'challenge_id', 'completion_date', 'completed_at', 'is_test', 'created_at', 'updated_at'],
        items, { register: false },
      )
      return sumBatch(res, excludedResult(excluded))
    },
  }
}

// ---------------------------------------------------------------- achievement unlocks

export function unlocksStep(a: ActivityContext): AnyEntityStep {
  const entity = 'user_achievements'
  return {
    entity,
    source: a.source,
    extract: (after) => readUnlockRows(a.pool, after, a.pageSize),
    keyOf: keyOfPair,
    async load(rows: PairRow[], ctx: BatchContext): Promise<BatchResult> {
      const users = await ctx.idMap.resolveMany('users', distinctValues(rows.map((r) => r.row), 'user_id'))
      const achievements = await ctx.idMap.resolveMany('achievements', distinctValues(rows.map((r) => r.row), 'achievement_id'))
      const items: LegacyRow[] = []
      for (const r of rows) {
        const row: UnlockRow = {
          achievement_id: r.row.achievement_id ?? null,
          user_id: r.row.user_id ?? null,
          unlocked_at: r.row.unlocked_at ?? null,
          rn: Number(r.row.k_rn),
        }
        const legacyId = pairId(row.achievement_id, row.user_id)
        assertSurrogateLegacyId(legacyId, 'migrate:activity')
        const out = transformUnlock(row, {
          userId: row.user_id === null ? undefined : users.get(row.user_id),
          achievementId: row.achievement_id === null ? undefined : achievements.get(row.achievement_id),
        })
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else items.push({ legacyId, values: out.value as unknown as Record<string, unknown> })
      }
      return upsertAndMap(
        ctx, entity, 'user_achievements',
        ['user_id', 'achievement_id', 'unlocked_at', 'is_test', 'created_at', 'updated_at'],
        items, { register: false },
      )
    },
  }
}

// ---------------------------------------------------------------- referral codes and referrals

const idOfUser = (row: StagedRow): string => {
  const id = row.id ?? ''
  assertSurrogateLegacyId(id, 'migrate:activity')
  return id
}

/** Pass 1: `users.referral_code` -> `referral_codes` (one per user; the code is unique, a clash is DUPLICATE_KEY). */
export function referralCodesStep(a: ActivityContext): AnyEntityStep {
  const entity = 'referral_codes'
  return {
    entity,
    source: a.source,
    extract: (after) =>
      readExpanded<StagedRow>(
        a.pool,
        { table: 'users', columns: ['referral_code', 'created_at', 'updated_at'], where: `referral_code IS NOT NULL AND btrim(referral_code) <> ''` },
        after, a.pageSize, (row) => [row],
      ),
    keyOf: (e: Expanded<StagedRow>) => e.key,
    async load(rows: Expanded<StagedRow>[], ctx: BatchContext): Promise<BatchResult> {
      const users = await ctx.idMap.resolveMany('users', rows.map((e) => idOfUser(e.row)))
      let items: { legacyId: string; code: string; values: Record<string, unknown> }[] = []
      for (const e of rows) {
        const legacyId = idOfUser(e.row)
        const out = transformReferralCode(e.row, users.get(legacyId))
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else items.push({ legacyId, code: out.value.code, values: out.value as unknown as Record<string, unknown> })
      }
      items = await dropConflicts(ctx.db, items, {
        entity, table: 'referral_codes', column: 'referral_code', expr: 'code', source: ctx.source, rejects: ctx.rejects,
        legacyIdOf: (i) => i.legacyId, valueOf: (i) => i.code,
      })
      return upsertAndMap(
        ctx, entity, 'referral_codes', ['user_id', 'code', 'created_at', 'updated_at'],
        items.map((i) => ({ legacyId: i.legacyId, values: i.values })), { register: false },
      )
    },
  }
}

/** The staged referral codes of some users, by user id (trimmed; blank is absent). */
async function stagedCodes(pool: pg.Pool, ids: readonly string[]): Promise<Map<string, string>> {
  const numeric = ids.filter((i) => /^\d{1,18}$/.test(i))
  if (numeric.length === 0) return new Map()
  const res = await pool.query<{ id: string; code: string }>(
    `SELECT id::text AS id, btrim(referral_code) AS code FROM ${quoteIdent(STAGING_SCHEMA)}."users"
     WHERE id = ANY($1::bigint[]) AND referral_code IS NOT NULL AND btrim(referral_code) <> ''`,
    [numeric],
  )
  return new Map(res.rows.map((r) => [r.id, r.code]))
}

/**
 * Pass 2: `users.referred_by` -> `referrals` (referee = the user, referrer = `referred_by`, code used = the referrer's code).
 * A self-referral, a referrer that was not loaded and a referrer without a code are rejected, never repaired.
 */
export function referralsStep(a: ActivityContext): AnyEntityStep {
  const entity = 'referrals'
  return {
    entity,
    source: a.source,
    extract: (after) =>
      readExpanded<StagedRow>(
        a.pool,
        { table: 'users', columns: ['referred_by', 'created_at', 'updated_at'], where: `referred_by IS NOT NULL` },
        after, a.pageSize, (row) => [row],
      ),
    keyOf: (e: Expanded<StagedRow>) => e.key,
    async load(rows: Expanded<StagedRow>[], ctx: BatchContext): Promise<BatchResult> {
      const referees = await ctx.idMap.resolveMany('users', rows.map((e) => idOfUser(e.row)))
      const referrerIds = distinctValues(rows.map((e) => e.row), 'referred_by')
      const referrers = await ctx.idMap.resolveMany('users', referrerIds)
      const codes = await stagedCodes(a.pool, referrerIds)
      const items: LegacyRow[] = []
      for (const e of rows) {
        const legacyId = idOfUser(e.row)
        const referredBy = e.row.referred_by ?? null
        const out = transformReferral(e.row, {
          refereeId: referees.get(legacyId),
          referrerId: referredBy === null ? undefined : referrers.get(referredBy),
          referrerCode: referredBy === null ? null : (codes.get(referredBy) ?? null),
        })
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else items.push({ legacyId, values: out.value as unknown as Record<string, unknown> })
      }
      return upsertAndMap(
        ctx, entity, 'referrals', ['referrer_id', 'referee_id', 'code_used', 'rewarded', 'created_at', 'updated_at'],
        items, { register: false },
      )
    },
  }
}

// ---------------------------------------------------------------- SPM targets

/**
 * `users.spm_targets` (text, probably JSON) -> `spm_targets`, one row per subject. Each entry of the JSON is one source
 * row of the step (legacy id `user:subject`). An unknown shape, an unknown grade, an unknown subject and a repeated
 * subject are rejected; a grade is never defaulted.
 */
export function spmTargetsStep(a: ActivityContext): AnyEntityStep {
  const entity = 'spm_targets'
  return {
    entity,
    source: a.source,
    extract: (after) =>
      readExpanded<SpmEntry>(
        a.pool,
        { table: 'users', columns: ['spm_targets', 'created_at', 'updated_at'], where: `spm_targets IS NOT NULL AND btrim(spm_targets) <> ''` },
        after, a.pageSize, (row) => parseSpmTargets(row.spm_targets),
      ),
    keyOf: (e: Expanded<SpmEntry>) => e.key,
    async load(rows: Expanded<SpmEntry>[], ctx: BatchContext): Promise<BatchResult> {
      const users = await ctx.idMap.resolveMany('users', rows.map((e) => idOfUser(e.row)))
      const subjects = await ctx.idMap.resolveMany('subjects', rows.flatMap((e) => (e.entry.subjectRef === null ? [] : [e.entry.subjectRef])))
      const items: LegacyRow[] = []
      for (const e of rows) {
        const uid = idOfUser(e.row)
        const legacyId = `${uid}:${e.entry.subjectRef ?? `x${e.entry.index}`}`
        assertSurrogateLegacyId(legacyId, 'migrate:activity')
        const out = transformSpmTarget(
          e.entry,
          { userId: users.get(uid), subjectId: e.entry.subjectRef === null ? undefined : subjects.get(e.entry.subjectRef) },
          stamps(e.row),
        )
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else items.push({ legacyId, values: out.value as unknown as Record<string, unknown> })
      }
      return upsertAndMap(
        ctx, entity, 'spm_targets', ['user_id', 'subject_id', 'target_grade', 'is_test', 'created_at', 'updated_at'],
        items, { register: false },
      )
    },
  }
}
