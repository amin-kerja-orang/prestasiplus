import { Inject, Injectable } from '@nestjs/common'
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

/** `GET /public/stats`: counters computed per request, nothing stored (BR-21). */
@Injectable()
export class StatsService {
  constructor(@Inject(AccountDataRepository) private readonly data: AccountDataRepository) {}

  get(): Promise<AccountPlatformStats> {
    return this.data.platformCounts()
  }
}
