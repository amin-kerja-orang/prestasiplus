import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'

import { cloneConfig, configEqual, samePlugins } from '../config-utils'

describe('config-utils (F-17)', () => {
  it('deep-copies plain objects and arrays, keeping functions by reference', () => {
    const cb = () => 'x'
    const source = reactive({ a: { b: [1, { c: 2 }] }, cb })
    const copy = cloneConfig(source)
    expect(copy).toEqual({ a: { b: [1, { c: 2 }] }, cb })
    expect(copy.a).not.toBe(source.a)
    expect(copy.cb).toBe(cb)
    source.a.b.push(3)
    expect(copy.a.b).toHaveLength(2)
  })

  it('compares structure, with functions and non-plain values by identity', () => {
    const cb = () => 1
    expect(configEqual({ a: [1, { b: 'x' }], cb }, { a: [1, { b: 'x' }], cb })).toBe(true)
    expect(configEqual({ a: [1] }, { a: [1, 2] })).toBe(false)
    expect(configEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false)
    expect(configEqual({ cb }, { cb: () => 1 })).toBe(false)
    expect(configEqual(new Date(0), new Date(0))).toBe(false)
    expect(configEqual(Number.NaN, Number.NaN)).toBe(true)
  })

  it('compares plugin lists element by element', () => {
    const p = { id: 'p' }
    expect(samePlugins([p], [p])).toBe(true)
    expect(samePlugins([p], [{ id: 'p' }])).toBe(false)
    expect(samePlugins([p], [])).toBe(false)
  })
})
