import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Injectable, Logger } from '@nestjs/common'

import { PrismaService } from '../../db/prisma.service'

export const READY_DB_TIMEOUT_MS = 3_000
/** A result (ok or not) is reused for this long, so an anonymous caller cannot turn the route into a DB load. */
export const READY_CACHE_TTL_MS = 3_000

interface MigrationRow {
  migration_name: string
  finished_at: Date | null
  rolled_back_at: Date | null
}

function hereDir(): string {
  try {
    return dirname(fileURLToPath(import.meta.url))
  } catch {
    return process.cwd()
  }
}

/** Candidate places of `prisma/migrations`: env override, the working dir (image: /app/apps/api), and relative to this file (src/ and dist/). */
export function migrationsDirCandidates(): string[] {
  const here = hereDir()
  const list = [
    process.env.PRISMA_MIGRATIONS_DIR,
    resolve(process.cwd(), 'prisma/migrations'),
    resolve(here, '../../../prisma/migrations'),
    resolve(here, '../prisma/migrations'),
    resolve(here, 'prisma/migrations'),
  ]
  return list.filter((p): p is string => typeof p === 'string' && p.length > 0)
}

/** Names of the migration directories shipped with this build, or null when the folder cannot be found. */
export function shippedMigrationNames(): string[] | null {
  for (const dir of migrationsDirCandidates()) {
    if (!existsSync(dir)) continue
    try {
      return readdirSync(dir).filter((d) => statSync(join(dir, d)).isDirectory())
    } catch {
      continue
    }
  }
  return null
}

export type ReadyResult = { ok: true } | { ok: false; reason: string }

/** Readiness: the database answers within 3 s AND every shipped migration is applied (and none is failed). */
@Injectable()
export class ReadyService {
  private readonly logger = new Logger(ReadyService.name)
  private warnedNoDir = false
  private shipped: string[] | null | undefined // undefined = not read yet; read once per process
  private cached: { result: Promise<ReadyResult>; expiresAt: number } | undefined
  /** Overridable in tests. */
  ttlMs = READY_CACHE_TTL_MS
  now: () => number = () => Date.now()

  constructor(private readonly prisma: PrismaService) {}

  /** Concurrent callers share one in-flight check; the result is cached for `ttlMs`. */
  check(): Promise<ReadyResult> {
    const t = this.now()
    if (this.cached && t < this.cached.expiresAt) return this.cached.result
    const result = this.run()
    this.cached = { result, expiresAt: t + this.ttlMs }
    return result
  }

  private async run(): Promise<ReadyResult> {
    let timer: NodeJS.Timeout | undefined
    try {
      const rows = await Promise.race([
        this.prisma.$queryRaw<MigrationRow[]>`select migration_name, finished_at, rolled_back_at from _prisma_migrations`,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('database check timed out')), READY_DB_TIMEOUT_MS)
        }),
      ])
      return this.evaluate(rows)
    } catch (err) {
      // The reason goes to the log only; never into the response body.
      return { ok: false, reason: `database or migration table check failed: ${err instanceof Error ? err.message : 'unknown'}` }
    } finally {
      clearTimeout(timer)
    }
  }

  private evaluate(rows: MigrationRow[]): ReadyResult {
    const failed = rows.filter((r) => r.finished_at === null && r.rolled_back_at === null)
    if (failed.length > 0) return { ok: false, reason: `${failed.length} migration(s) unfinished or failed` }
    const applied = new Set(rows.filter((r) => r.finished_at !== null && r.rolled_back_at === null).map((r) => r.migration_name))
    if (applied.size === 0) return { ok: false, reason: 'no migration applied' }
    if (this.shipped === undefined) this.shipped = shippedMigrationNames()
    const shipped = this.shipped
    if (shipped === null) {
      if (!this.warnedNoDir) {
        this.warnedNoDir = true
        this.logger.warn('prisma/migrations folder not found; readiness checks only that no migration is failed and one is applied')
      }
      return { ok: true }
    }
    const missing = shipped.filter((n) => !applied.has(n))
    if (missing.length > 0) return { ok: false, reason: `${missing.length} shipped migration(s) not applied` }
    return { ok: true }
  }
}
