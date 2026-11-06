import { describe, expect, it } from 'vitest'

import routes from '../../routes/headcount'

/**
 * S10-T09 role map of the Headcount routes (the guard answers the 403 page for a role outside `meta.roles`).
 * Pupil: the two read screens only. School admin: read-only, so the write pages are 403 by URL.
 */
const rolesOf = (name: string): readonly string[] => {
  const r = routes.find((x) => x.name === name)
  if (!r) throw new Error(`no route ${name}`)
  return r.meta?.roles ?? []
}

describe('m08 headcount route roles', () => {
  it.each(['m08.headcount', 'm08.headcount.student'])('%s is open to the pupil and every staff role', (name) => {
    expect(rolesOf(name)).toEqual(expect.arrayContaining(['student', 'admin', 'teacher', 'school_admin']))
  })

  it.each([
    'm08.headcount.dashboard',
    'm08.headcount.create',
    'm08.headcount.detail',
    'm08.headcount.summary',
    'm08.headcount.export',
    'm08.headcount.unjuran',
    'm08.headcount.results',
    'm08.headcount.edit',
    'm08.headcount.settings',
  ])('%s is 403 for the pupil', (name) => {
    expect(rolesOf(name)).not.toContain('student')
  })

  it.each(['m08.headcount.results', 'm08.headcount.edit', 'm08.headcount.settings'])(
    '%s (write page) is the admin and the teacher only, 403 for the school admin',
    (name) => {
      expect([...rolesOf(name)].sort()).toEqual(['admin', 'teacher'])
    },
  )

  it.each([
    'm08.headcount.dashboard',
    'm08.headcount.detail',
    'm08.headcount.summary',
    'm08.headcount.export',
    'm08.headcount.unjuran',
  ])('%s stays readable for the school admin', (name) => {
    expect(rolesOf(name)).toContain('school_admin')
  })

  it('the create page is a write page: teacher and admin only (school admin 403 by URL, AC-AS-3-3)', () => {
    expect(rolesOf('m08.headcount.create')).toEqual(['admin', 'teacher'])
  })

  it('every route keeps the 403 page for a forbidden role', () => {
    for (const r of routes) expect(r.meta?.onForbidden).toBe('403')
  })
})
