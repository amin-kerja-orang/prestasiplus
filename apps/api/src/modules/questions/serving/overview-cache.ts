import { Inject, Injectable, Logger } from '@nestjs/common'

import { CLOCK, type Clock } from '../../../db/clock'
import { PrismaService } from '../../../db/prisma.service'

/** How long a computed overview is served as fresh. */
export const OVERVIEW_TTL_MS = 5 * 60 * 1000

/**
 * A change that commits a moment after `invalidate()` (the caller may still be inside its transaction) must not be missed by a
 * refresh that started in between: a refresh that started less than this long after the latest invalidation leaves the entry stale.
 */
export const OVERVIEW_SETTLE_MS = 2000

export interface Cached<T> {
  value: T
  /** When the value was computed (the start of the compute that produced it). */
  computedAt: Date
}

interface Entry<T> {
  value: T
  computedAtMs: number
  startedAtMs: number
  fingerprint: string
}

export interface SwrOptions {
  ttlMs: number
  settleMs: number
  now: () => number
  /** Reports a failed background refresh (the stale value keeps being served). */
  onError?: (error: unknown) => void
}

/**
 * H-A21: one stale-while-revalidate slot with single flight.
 *  - cold: the first reader computes; every concurrent reader shares that one promise (never a stampede).
 *  - fresh (younger than the TTL, not invalidated, same fingerprint): served as is.
 *  - stale: served at once, and ONE background refresh starts (a failure keeps the stale value).
 * PURE of Nest and the database: the owner passes `compute` and an optional cheap `fingerprint` (a changed fingerprint marks the
 * entry stale, for changes that have no event hook).
 */
export class SwrSlot<T> {
  private entry: Entry<T> | null = null
  private inflight: Promise<Entry<T>> | null = null
  private invalidatedAtMs: number | null = null
  private dirty = false

  constructor(private readonly opts: SwrOptions) {}

  /** Marks the value stale: the next read serves it and refreshes in the background. */
  invalidate(): void {
    this.invalidatedAtMs = this.opts.now()
    this.dirty = true
  }

  async get(compute: () => Promise<T>, fingerprint?: () => Promise<string>): Promise<Cached<T>> {
    const fp = fingerprint ? await fingerprint() : ''
    const e = this.entry
    if (e === null) return view(await this.refresh(compute, fp))
    const expired = this.opts.now() - e.computedAtMs >= this.opts.ttlMs
    if (!expired && !this.dirty && e.fingerprint === fp) return view(e)
    if (this.inflight === null) {
      // Background: not awaited. A failure is reported and the stale value stays.
      this.refresh(compute, fp).catch((err: unknown) => this.opts.onError?.(err))
    }
    return view(e)
  }

  /** Single flight: a refresh already running is joined, never repeated. */
  private refresh(compute: () => Promise<T>, fp: string): Promise<Entry<T>> {
    if (this.inflight !== null) return this.inflight
    const startedAtMs = this.opts.now()
    // Everything invalidated up to now is part of what this compute will see, unless it is too recent to be committed.
    const settled = this.invalidatedAtMs === null || startedAtMs - this.invalidatedAtMs >= this.opts.settleMs
    const invalidatedBefore = this.invalidatedAtMs
    const run = (async (): Promise<Entry<T>> => {
      const value = await compute()
      const entry: Entry<T> = { value, computedAtMs: startedAtMs, startedAtMs, fingerprint: fp }
      this.entry = entry
      // Cleared only when this compute saw every invalidation so far; an invalidation during or just before it keeps the entry stale.
      this.dirty = !settled || this.invalidatedAtMs !== invalidatedBefore
      return entry
    })()
    const clear = () => {
      this.inflight = null
    }
    this.inflight = run
    run.then(clear, clear)
    return run
  }
}

const view = <T>(e: Entry<T>): Cached<T> => ({ value: e.value, computedAt: new Date(e.computedAtMs) })

/** Scope of the admin overview: today a single, national one (Admin Pusat reads the whole bank). */
export const OVERVIEW_SCOPE_ALL = 'all'

/**
 * H-A21: the cache in front of `ServabilityReadsService.overview()` (22.5 s on a 400k bank). Per scope, 5 minutes, stale-while-
 * revalidate, single flight. Invalidated (marked stale) by the question events that change what pupils are served (approve, archive,
 * Terbit, Tarik balik, create, remove, activate/deactivate: `QuestionsService`); a paper publish or withdraw has no hook in the
 * builder, so the cheap papers fingerprint below catches it on the next read.
 */
@Injectable()
export class OverviewCache {
  private readonly logger = new Logger(OverviewCache.name)
  private readonly slots = new Map<string, SwrSlot<unknown>>()

  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  private slot<T>(scope: string): SwrSlot<T> {
    let s = this.slots.get(scope)
    if (!s) {
      s = new SwrSlot<unknown>({
        ttlMs: OVERVIEW_TTL_MS,
        settleMs: OVERVIEW_SETTLE_MS,
        now: () => this.clock.now().getTime(),
        onError: (e) => this.logger.error(`overview refresh failed: ${e instanceof Error ? e.message : String(e)}`),
      })
      this.slots.set(scope, s)
    }
    return s as SwrSlot<T>
  }

  get<T>(compute: () => Promise<T>, scope: string = OVERVIEW_SCOPE_ALL): Promise<Cached<T>> {
    return this.slot<T>(scope).get(compute, () => this.papersFingerprint())
  }

  /** Every scope becomes stale (the next read refreshes in the background). Cheap: no query. */
  invalidate(): void {
    for (const s of this.slots.values()) s.invalidate()
  }

  /** Published and total papers and the newest edit: a publish or withdraw changes it. A small table, one cheap statement. */
  private async papersFingerprint(): Promise<string> {
    const rows = await this.prisma.client.$queryRaw<{ fp: string }[]>`
      SELECT (count(*) FILTER (WHERE status = 'published'))::text || ':' || count(*)::text || ':' || coalesce(max(updated_at)::text, '') AS fp
        FROM papers WHERE kind <> 'jana'`
    return rows[0]?.fp ?? ''
  }
}
