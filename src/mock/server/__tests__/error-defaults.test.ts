import { ERROR_CODES, ERROR_STATUS } from '@pp/contract'
import { describe, expect, it } from 'vitest'

// The API texts are the source of truth (40 X10.11); the mock must answer with the same BM defaults (FR-ERR-4).
import { DEFAULT_ERROR_MESSAGES as API_DEFAULTS } from '../../../../apps/api/src/common/errors/api-error'
import { DEFAULT_ERROR_MESSAGES, STATUS_FOR_CODE } from '../respond'

describe('mock error defaults (S0-T12)', () => {
  it('has the same text as the API default for every ErrorCode', () => {
    for (const code of ERROR_CODES) {
      expect(DEFAULT_ERROR_MESSAGES[code], code).toBe(API_DEFAULTS[code])
    }
  })

  it('has the contract status for every code the mock can fail with', () => {
    for (const code of ERROR_CODES) {
      if (code === 'PASSWORD_CHANGE_REQUIRED') continue
      expect(STATUS_FOR_CODE[code], code).toBe(ERROR_STATUS[code])
    }
  })
})
