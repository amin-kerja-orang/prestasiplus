import { describe, expect, it } from 'vitest'

import { pageOf } from '../../src/modules/marketplace/marketplace-admin.service'

describe('pageOf (admin list page guard, R-1 minor)', () => {
  it.each([
    [undefined, 1],
    ['', 1],
    ['abc', 1],
    ['NaN', 1],
    ['0', 1],
    ['-3', 1],
    ['2.5', 1],
    ['Infinity', 1],
    ['1e999', 1],
    ['99999999999999999999', 1],
    ['1', 1],
    ['7', 7],
  ])('%j -> %i', (raw, expected) => {
    const page = pageOf(raw)
    expect(Number.isInteger(page)).toBe(true)
    expect(page).toBe(expected)
  })
})
