/**
 * F3: `RESERVED_USER_BLOCKS` (mock/data/spec.ts) is a hand copy of the F-23 user anchor blocks
 * (M02 §6.15 B/D). This test reads the M01 users repository through its public entry, so an F-23
 * anchor move fails here instead of silently misclassifying anchors as generated rows.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { users } from '@/modules/m01-authentication/mock'

import { isReservedUser } from '../../mock/data/spec'
import { bootM10 } from './helpers'

beforeAll(async () => {
  await bootM10()
}, 120_000)

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

/** Every anchor id documented in M02 §6.15 B "Anchors" and D (placement table). */
const DOCUMENTED_ANCHORS: readonly number[] = [
  ...range(1, 11),
  1919,
  ...range(2001, 2060),
  ...range(3001, 3008),
  ...range(3101, 3109),
  ...range(3151, 3152),
  ...range(3201, 3215),
  ...range(3301, 3324),
  3614,
  4373,
  ...range(4001, 4108),
  ...range(4201, 4208),
  ...range(4301, 4358).filter((id) => id !== 4351),
  4401,
  4402,
  4418,
  ...range(4501, 4504),
  4627,
  4644,
  4664,
  ...range(5001, 5990),
]

describe('reserved user blocks match the F-23 anchors', () => {
  it('every documented anchor exists and is reserved', () => {
    const missing = DOCUMENTED_ANCHORS.filter((id) => users.get(id) === undefined)
    const unreserved = DOCUMENTED_ANCHORS.filter((id) => !isReservedUser(id))
    expect(missing).toEqual([])
    expect(unreserved).toEqual([])
  })

  it('every student or teacher with a hand-written e-mail (not the generated pattern) is reserved', () => {
    const pad = (n: number, w: number) => String(n).padStart(w, '0')
    const stray: number[] = []
    for (const role of ['student', 'teacher'] as const) {
      for (const u of users.query('U-ROLE', { sort: 'id' }, role).rows) {
        const generated =
          role === 'student'
            ? u.email === `pelajar${pad(u.id, 6)}@demo.test`
            : u.email === `guru${pad(u.id, 4)}@demo.test`
        if (!generated && !isReservedUser(u.id)) stray.push(u.id)
      }
    }
    expect(stray).toEqual([])
  })
})
