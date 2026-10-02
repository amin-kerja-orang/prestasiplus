import { describe, expect, it } from 'vitest'

import { DISPLAY_CONSTANT, defineDisplayConstant, listDisplayConstants } from '../display-constants'

describe('display constants (D11 exception, XL-34)', () => {
  it('registers a constant with its DV id and lists it', () => {
    const c = defineDisplayConstant({
      module: 'TEST',
      name: 'hubTotal',
      value: 20_529,
      dv: 'DV-M06-01',
    })
    expect(c).toMatchObject({ kind: DISPLAY_CONSTANT, value: 20_529, dv: 'DV-M06-01' })
    expect(Object.isFrozen(c)).toBe(true)
    expect(listDisplayConstants().filter((x) => x.module === 'TEST')).toEqual([c])
    // Re-declaring the same value (module re-evaluation) is allowed.
    expect(
      defineDisplayConstant({ module: 'TEST', name: 'hubTotal', value: 20_529, dv: 'DV-M06-01' }),
    ).toBe(c)
  })

  it('rejects a missing DV id and a conflicting redeclaration', () => {
    expect(() => defineDisplayConstant({ module: 'TEST', name: 'x', value: 1, dv: 'M06' })).toThrow(
      /dv must look like/,
    )
    defineDisplayConstant({ module: 'TEST', name: 'y', value: 1, dv: 'DV-M06-02' })
    expect(() =>
      defineDisplayConstant({ module: 'TEST', name: 'y', value: 2, dv: 'DV-M06-02' }),
    ).toThrow(/another value/)
  })
})
