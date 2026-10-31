import { afterEach, describe, expect, it, vi } from 'vitest'

import { isPathInScope } from '../prototype-scope'

afterEach(() => vi.unstubAllEnvs())

describe('Simulasi - Kuiz in the prototype scope (R1-F12, B-04)', () => {
  it('lets a student open both quiz routes (with a query) with the scope ON', () => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'on')
    expect(isPathInScope('student', '/simulasi/kuiz')).toBe(true)
    expect(isPathInScope('student', '/simulasi/kuiz?count=10&subject=MATH')).toBe(true)
    expect(isPathInScope('student', '/simulasi/mat-k1-2025-a/kuiz')).toBe(true)
  })

  it('does not open it for a teacher, a school admin or a guest, nor match a longer prefix', () => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'on')
    expect(isPathInScope('teacher', '/simulasi/kuiz')).toBe(false)
    expect(isPathInScope('school_admin', '/simulasi/kuiz')).toBe(false)
    expect(isPathInScope(null, '/simulasi/kuiz')).toBe(false)
    expect(isPathInScope('student', '/simulasix/kuiz')).toBe(false)
  })
})
