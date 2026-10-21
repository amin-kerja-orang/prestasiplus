import { describe, expect, it } from 'vitest'

import { assertSurrogateLegacyId } from '../../../src/migration/kit/sql'

describe('assertSurrogateLegacyId', () => {
  it('accepts surrogate ids, plain and composite', () => {
    for (const id of ['1', '42', '123456789', '5:7', '3:42:1']) {
      expect(() => assertSurrogateLegacyId(id, 'test'), id).not.toThrow()
    }
  })

  it('checks each ":" segment on its own: several short keys never add up to personal data', () => {
    expect(() => assertSurrogateLegacyId('12345:123456:1', 'test')).not.toThrow()
    expect(() => assertSurrogateLegacyId('1234:56789:1', 'test')).not.toThrow()
  })

  it('still refuses an IC or phone number, alone or as a segment', () => {
    for (const id of ['0123456789', '900101145678', '1:900101-14-5678', '1:0123456789', '012-345 6789:1', '7:012 345 6789']) {
      expect(() => assertSurrogateLegacyId(id, 'test'), id).toThrow(RangeError)
    }
  })

  it('still refuses an e-mail address, alone or as a segment, without repeating it', () => {
    for (const id of ['someone@example.test', '4:someone@example.test:1']) {
      let message = ''
      try {
        assertSurrogateLegacyId(id, 'test')
      } catch (e) {
        message = (e as Error).message
      }
      expect(message, id).toMatch(/personal data/)
      expect(message).not.toContain('example.test')
    }
  })
})
