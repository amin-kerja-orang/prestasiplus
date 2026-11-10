import { Inject, Injectable, Logger, Optional, type OnApplicationBootstrap } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  ACCOUNT_SETTINGS_DEFAULTS,
  AccountSettingsUpdateRequestSchema,
  type AccountPlatformStats,
  type AccountSettings,
} from '@pp/contract'

import { CLOCK, type Clock } from '../../db/clock'
import { fieldsOf, invalid } from './account.errors'
import { AccountDataRepository } from './account-data.repository'

const timeOr = (value: string | null | undefined, fallback: string): string => (value === undefined || value === null || value === '' ? fallback : value)

/**
 * Personal settings (mock BR-17). `faith` is religion: sensitive personal data. It is stored for the
 * owner only, returned by the owner's own `GET/PUT /me/settings` only, and never written to a log or an audit row.
 */
@Injectable()
export class SettingsService {
  constructor(
    @Inject(AccountDataRepository) private readonly data: AccountDataRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** A user who never saved reads the defaults. */
  async get(userId: string): Promise<AccountSettings> {
    return (await this.data.getSettings(userId)) ?? { ...ACCOUNT_SETTINGS_DEFAULTS }
  }

  /** Every save writes all seven fields: a missing boolean is false, a blank time is the default, a blank faith is null. */
  async save(userId: string, raw: unknown): Promise<AccountSettings> {
    const parsed = AccountSettingsUpdateRequestSchema.safeParse(raw)
    if (!parsed.success) throw invalid(fieldsOf(parsed.error))
    const b = parsed.data
    const settings: AccountSettings = {
      spiritualMode: b.spiritualMode,
      showBismillahSplash: b.showBismillahSplash,
      subuhPushEnabled: b.subuhPushEnabled,
      subuhPushTime: timeOr(b.subuhPushTime, ACCOUNT_SETTINGS_DEFAULTS.subuhPushTime),
      ramadanModeEnabled: b.ramadanModeEnabled,
      sahurPushTime: timeOr(b.sahurPushTime, ACCOUNT_SETTINGS_DEFAULTS.sahurPushTime),
      faith: b.faith === undefined || b.faith === null || b.faith === '' ? null : b.faith,
    }
    await this.data.saveSettings(userId, settings, this.clock.now())
    return settings
  }
}

/** Seconds the public counters are reused (`PUBLIC_STATS_CACHE_SECONDS`; 0 turns it off). */
export const PUBLIC_STATS_CACHE_SECONDS = 120

/**
 * `GET /public/stats`: the counters are computed from the database (BR-21: nothing is stored in a table). The question count scans the 450 thousand
 * questions of the real bank (1 to 5 s) and this is the login page, so the result is kept in the process for `PUBLIC_STATS_CACHE_SECONDS` and, past that
 * age, still served at once while one recount runs behind it. Built without a `ConfigService` (the unit specs) it counts on every call, as before.
 */
@Injectable()
export class StatsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StatsService.name)
  private memo: { at: number; value: Promise<AccountPlatformStats>; settled: boolean } | null = null
  private refreshing = false

  constructor(
    @Inject(AccountDataRepository) private readonly data: AccountDataRepository,
    @Optional() @Inject(ConfigService) private readonly config?: ConfigService,
  ) {}

  private ttlMs(): number {
    if (!this.config) return 0
    const n = Number.parseInt(String(this.config.get<string>('PUBLIC_STATS_CACHE_SECONDS') ?? ''), 10)
    return (Number.isInteger(n) && n >= 0 ? n : PUBLIC_STATS_CACHE_SECONDS) * 1000
  }

  get(): Promise<AccountPlatformStats> {
    const ttl = this.ttlMs()
    if (ttl <= 0) return this.data.platformCounts()
    const nowMs = performance.now()
    const memo = this.memo
    if (memo) {
      if (nowMs - memo.at >= ttl && memo.settled && !this.refreshing) this.refresh()
      return memo.value
    }
    const value = this.data.platformCounts()
    const entry = { at: nowMs, value, settled: false }
    this.memo = entry
    value.then(
      () => {
        entry.settled = true
      },
      () => {
        if (this.memo === entry) this.memo = null
      },
    )
    return value
  }

  private refresh(): void {
    this.refreshing = true
    this.data
      .platformCounts()
      .then((value) => {
        this.memo = { at: performance.now(), value: Promise.resolve(value), settled: true }
      })
      .catch((err: unknown) => this.logger.warn(`public stats refresh failed: ${err instanceof Error ? err.message : String(err)}`))
      .finally(() => {
        this.refreshing = false
      })
  }

  /** Counts once at start (not awaited, a failure only logs) so the first visitor of the login page does not wait. Same switch as the admin overview warm-up. */
  onApplicationBootstrap(): void {
    if (!this.config || this.ttlMs() <= 0) return
    const flag = this.config.get<string>('SERVABILITY_OVERVIEW_WARM')
    const on = flag === undefined || flag === '' ? this.config.get<string>('NODE_ENV') === 'production' : flag === 'true'
    if (!on) return
    setTimeout(() => {
      void this.get().catch((e: unknown) => this.logger.warn(`public stats warm-up failed: ${e instanceof Error ? e.message : String(e)}`))
    }, 1_000).unref()
  }
}
