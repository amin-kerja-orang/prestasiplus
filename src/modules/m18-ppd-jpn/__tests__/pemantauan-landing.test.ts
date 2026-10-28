import { describe, expect, it } from 'vitest'

import routes from '../routes'

describe('PPD officer landing (UAT-M18-001)', () => {
  it('registers the API landing path of a PPD officer with the friendly unavailable page, not a 404', () => {
    const r = routes.find((x) => x.name === 'm18.pemantauan-unavailable')
    expect(r?.path).toBe('/admin/pemantauan/:level(wilayah|negeri)')
    expect(r?.meta?.access).toBe('auth')
    expect(r?.meta?.layout).toBe('bare')
  })
})
