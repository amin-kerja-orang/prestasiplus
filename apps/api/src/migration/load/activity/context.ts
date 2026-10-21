/**
 * Shared state of one `migrate:activity` run (BE-29): the options, the report notes (counts and surrogate ids
 * only, never values) and the drift collector. Parts A and B add steps that read it; they do not change it.
 */
import type pg from 'pg'

import type { AnyEntityStep } from '../../kit/runner'
import type { LegacySource } from '../../kit/types'
import { CoreNotes } from '../context'
import { DriftCollector } from './drift'

export interface ActivityOptions {
  pool: pg.Pool
  env: Readonly<Record<string, string | undefined>>
  source: Extract<LegacySource, 'cloud'>
  /** The run date (`YYYY-MM-DD`): part of the input hash and the "today" of any date rule. */
  asOf: string
  /** Rows read per keyset page; also bounds memory of an extract. Default 1000. */
  pageSize?: number
  /** v2 user id that owns migrated notes / videos / audio (Q7); content without an owner is rejected when unset. */
  contentOwnerUserId?: string
  /** Read-only .cloud storage directory. File migration is OFF (Q2): the CLI refuses the flag; kept for later. */
  storageDir?: string
}

export class ActivityContext {
  /** Counters and surrogate ids for the report (same shape as BE-28's `CoreNotes`). */
  readonly notes = new CoreNotes()
  /** Derived-figure drift (old vs new): counts and surrogate ids only. */
  readonly drift = new DriftCollector()

  constructor(readonly options: ActivityOptions) {}

  get pool(): pg.Pool {
    return this.options.pool
  }

  get env(): Readonly<Record<string, string | undefined>> {
    return this.options.env
  }

  get source(): Extract<LegacySource, 'cloud'> {
    return this.options.source
  }

  get asOf(): string {
    return this.options.asOf
  }

  get pageSize(): number {
    return this.options.pageSize ?? 1000
  }

  get contentOwnerUserId(): string | undefined {
    return this.options.contentOwnerUserId
  }

  get storageDir(): string | undefined {
    return this.options.storageDir
  }
}

/** Fixed run order of the groups (plan: catalogue, wallets, activity, content, ops). */
export const ACTIVITY_GROUP_NAMES = ['catalogue', 'wallet', 'activity', 'content', 'ops'] as const
export type ActivityGroupName = (typeof ACTIVITY_GROUP_NAMES)[number]

/** One slice of the command. Parts A (wallet, activity) and B (catalogue, content, ops) each export one or more. */
export interface ActivityGroup {
  name: ActivityGroupName
  /** The ordered entity steps of this group (parents before children). Entity names are unique across groups. */
  steps(a: ActivityContext): AnyEntityStep[]
  /** Source tables this group deliberately does not load, with the reason (merged into the printed list). */
  notMigrated: { table: string; reason: string }[]
  /**
   * Optional: staging / archive tables the group reads, as `table` (staging_cloud) or `archive_cloud.table`.
   * They join the input fingerprint (the default list in `preflight.ts` already covers the plan).
   */
  reads?: readonly string[]
}
