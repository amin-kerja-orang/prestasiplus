import { describe, expect, it } from 'vitest'

import { DEFAULT_ERROR_MESSAGES } from '../src/common/errors/api-error'
import { summarize as accountSummarize } from '../src/modules/account/account.errors'
import { invalid as commandCenterInvalid } from '../src/modules/command-center/http/errors'
import { summarize as supportSummarize } from '../src/modules/support/support.errors'

/** S0-T12 (FR-ERR-4): the generic validation fallback of a module is the shared BM default. */
describe('module validation fallbacks', () => {
  it('account, support and command-center fall back to the BM VALIDATION_ERROR default', () => {
    const bm = DEFAULT_ERROR_MESSAGES.VALIDATION_ERROR
    expect(bm).toBe('Data yang dihantar tidak sah. Sila semak dan cuba lagi.')
    expect(accountSummarize({})).toBe(bm)
    expect(supportSummarize({})).toBe(bm)
    expect(commandCenterInvalid({}).message).toBe(bm)
  })
})
