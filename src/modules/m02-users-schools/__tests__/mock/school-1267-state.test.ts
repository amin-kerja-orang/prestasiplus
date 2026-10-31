/**
 * M12 / M11 state selects: live shows exactly 10 states. School 1267 (state not observed) is pinned to Kedah /
 * PPD BALING so generation puts no school with users in Sarawak (an 11th state). No observed total moves.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { CLOCK_ANCHOR_ISO, createClock } from '@/lib/time'
import { bootMock } from '@/mock/index'
import m01 from '@/modules/m01-authentication/mock'
import { users } from '@/modules/m01-authentication/mock'

import m02, { schools } from '../../mock'
import { districtsOf } from '../../mock/data/geo'

const OBSERVED_TEN = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Kuala Lumpur',
  'Melaka',
  'Pahang',
  'Perak',
  'Sabah',
  'Selangor',
  'Terengganu',
]

beforeAll(async () => {
  await bootMock({
    mode: 'test',
    // Only the two owners of the data under test (M02 depends on core and M01).
    plugins: [m01, m02],
    clock: createClock({ at: CLOCK_ANCHOR_ISO }),
    latencyMs: 0,
    onWarn: null,
  })
}, 120_000)

describe('school 1267 and the state list', () => {
  it('1267 is in an observed state, in a PPD of that state, still an active SK', () => {
    const s = schools.get(1267)
    expect(s).toBeDefined()
    expect(OBSERVED_TEN).toContain(s!.state)
    expect(s!.state).not.toBe('Sarawak')
    expect(districtsOf(s!.state)).toContain(s!.district)
    expect(s!.type).toBe('SK')
    expect(s!.isActive).toBe(true)
  })

  it('the distinct states of schools with users are exactly the observed ten', () => {
    const states = new Set<string>()
    for (const id of users.schoolsWithUsers()) {
      const s = schools.get(id)
      if (s && s.id < 900_000) states.add(s.state)
    }
    expect([...states].sort()).toEqual([...OBSERVED_TEN].sort())
  })

  it('no school with users sits in a PPD outside its state', () => {
    for (const id of users.schoolsWithUsers()) {
      const s = schools.get(id)
      if (s && s.district) expect(districtsOf(s.state)).toContain(s.district)
    }
  })

  it('school totals are unchanged (Johor 1,189, Perak 1,102; 1,666 / 2,492 pins are build-checked at boot)', () => {
    // The observed whole-register figures (named queries); `list` hides the primary-type schools (D72).
    expect(schools.count('S-STATE', 'Johor')).toBe(1_189)
    expect(schools.count('S-STATE', 'Perak')).toBe(1_102)
  })
})
