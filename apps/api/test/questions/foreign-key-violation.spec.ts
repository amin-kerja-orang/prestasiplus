import { describe, expect, it } from 'vitest'

import { isForeignKeyViolation } from '../../src/modules/questions/errors'

/** R1 delete-served-guard: what counts as "a foreign key refused the delete" (the 409 `in_use`), whatever way the driver error is wrapped. */
describe('isForeignKeyViolation', () => {
  it('Prisma P2003 (foreign key constraint violated)', () => {
    expect(isForeignKeyViolation({ code: 'P2003', message: 'x' })).toBe(true)
  })
  it('P2010 (raw query failed) carries the Postgres code in meta', () => {
    expect(isForeignKeyViolation({ code: 'P2010', meta: { code: '23503', message: 'violates foreign key constraint' } })).toBe(true)
  })
  it('the raw Postgres code, on the error or as originalCode', () => {
    expect(isForeignKeyViolation({ code: '23503' })).toBe(true)
    expect(isForeignKeyViolation({ originalCode: '23503' })).toBe(true)
  })
  it('wrapped: cause, meta.driverAdapterError.cause (the driver-adapter shape) and the message text', () => {
    expect(isForeignKeyViolation({ code: 'P2000', cause: { code: '23503' } })).toBe(true)
    expect(isForeignKeyViolation({ code: 'P2010', meta: { driverAdapterError: { name: 'DriverAdapterError', cause: { kind: 'postgres', originalCode: '23503' } } } })).toBe(true)
    expect(isForeignKeyViolation(new Error('update or delete on table "questions" violates foreign key constraint "fk_question_set_items_question_id"'))).toBe(true)
  })
  it('anything else is not a foreign key violation (a unique violation, a timeout, a plain error, a non-object, a loop)', () => {
    expect(isForeignKeyViolation({ code: 'P2002' })).toBe(false) // unique constraint
    expect(isForeignKeyViolation({ code: '23505' })).toBe(false)
    expect(isForeignKeyViolation({ code: 'P2010', meta: { code: '40001' } })).toBe(false)
    expect(isForeignKeyViolation(new Error('connection timed out'))).toBe(false)
    expect(isForeignKeyViolation(null)).toBe(false)
    expect(isForeignKeyViolation('23503')).toBe(false)
    const loop: Record<string, unknown> = {}
    loop.cause = loop
    expect(isForeignKeyViolation(loop)).toBe(false) // depth-bounded
  })
})
