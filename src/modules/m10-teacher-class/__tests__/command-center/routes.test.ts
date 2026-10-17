import { describe, expect, it } from 'vitest'

import routes from '../../routes/command-center'

describe('S2 route fragment (M10-T4)', () => {
  it('registers S2 in the staff shell for teacher and admin', () => {
    const s2 = routes.find((r) => r.path === '/guru/command-center')
    expect(s2?.meta).toMatchObject({
      layout: 'user',
      v2: true,
      access: 'auth',
      roles: ['teacher', 'admin'],
      module: 'M10',
    })
  })

  it('mounts the four M17 drill-down routes under /guru/command-center for teacher and admin', () => {
    const drill = routes.filter((r) => r.path.startsWith('/guru/command-center/'))
    expect(drill.map((r) => r.path)).toEqual([
      '/guru/command-center/school/:schoolId(\\d+)',
      '/guru/command-center/school/:schoolId(\\d+)/teacher/:userId(\\d+)',
      '/guru/command-center/classroom/:classroomId(\\d+)',
      '/guru/command-center/student/:userId(\\d+)',
    ])
    for (const r of drill) {
      expect(r.meta).toMatchObject({ layout: 'user', v2: true, roles: ['teacher', 'admin'] })
    }
    expect(new Set(routes.map((r) => String(r.name))).size).toBe(routes.length)
  })
})
