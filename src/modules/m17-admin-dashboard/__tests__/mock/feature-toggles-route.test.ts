import { describe, expect, it } from 'vitest'

import { featureToggleRoutes } from '../../mock/handlers/feature-toggles'

describe('GET /api/admin/feature-toggles (mock)', () => {
  const r = featureToggleRoutes[0]

  it('registers the GET route', () => {
    expect(r?.method).toBe('GET')
    expect(r?.pattern).toBe('/api/admin/feature-toggles')
  })

  it('answers 32 rows in the contract shape, locked keys OFF (INV-29), 4 gated by the migration seed', () => {
    const res = (r?.handler as unknown as () => { body: { data: Record<string, unknown>[] } })()
    const rows = res.body.data
    expect(rows).toHaveLength(32)
    expect(new Set(rows.map((x) => x.key)).size).toBe(32)
    for (const x of rows) {
      expect(Object.keys(x).sort()).toEqual(['audience', 'enabled', 'key', 'labelMs', 'locked'])
      expect(['pelajar', 'guru']).toContain(x.audience)
      if (x.locked) expect(x.enabled).toBe(false)
    }
    expect(rows.filter((x) => x.locked).map((x) => x.key)).toEqual(['cikgu-alesa', 'keluarga-angkat'])
  })
})
