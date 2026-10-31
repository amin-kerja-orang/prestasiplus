import type { Mode } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { canUseSpecBlueprints } from '../../src/modules/bijak/papers/spec-access'

/**
 * REQ-B-005: Spec blueprint heads are for Admin Pusat in Mod Pelajar only, decided by the role the session returns to.
 * (The end-to-end cases for the two seeded admins are in generate.spec.ts.)
 */
const mode = (returnRole: Mode['returnRole']): Mode => ({ kind: 'mod_pelajar', returnRole, since: '2026-10-16T09:00:00+08:00', isTest: true })

describe('canUseSpecBlueprints', () => {
  it('Admin Pusat in Mod Pelajar may', () => {
    expect(canUseSpecBlueprints({ mode: mode('admin') })).toBe(true)
  })

  it('Admin Sekolah in Mod Pelajar may not, even when the account also holds the admin role', () => {
    // The account roles are not an input: the decision is the return role alone.
    expect(canUseSpecBlueprints({ mode: mode('school_admin') })).toBe(false)
  })

  it('outside Mod Pelajar nobody may', () => {
    expect(canUseSpecBlueprints({ mode: null })).toBe(false)
  })
})
