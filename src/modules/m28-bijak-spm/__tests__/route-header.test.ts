import { describe, expect, it } from 'vitest'

import routes from '../routes'

describe('C-67: Bijak SPM hub shell header', () => {
  const hub = routes.find((r) => r.name === 'm28.bijak')
  const header = (hub?.meta as { header?: { title: string; subtitle?: string } } | undefined)?.header

  it('names the hub "Bijak SPM" (AC-01.1), not the stale V2 "Simulasi Peperiksaan"', () => {
    expect(header?.title).toBe('Bijak SPM')
  })

  it('uses the page subtitle, not the stale V2 one (N-03)', () => {
    expect(header?.subtitle).toBe('Duduki kertas SPM penuh dalam format kertas sebenar — bermasa, dengan skema.')
  })

  it('keeps the browser tab title on Bijak SPM', () => {
    expect((hub?.meta as { title?: string }).title).toBe('Bijak SPM - PRESTASIPLUS')
  })
})
