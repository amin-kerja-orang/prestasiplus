import { describe, expect, it } from 'vitest'

import { inviteUrl, sortParents, whatsAppHref } from '../../lib/jemput'

describe('jemput helpers', () => {
  it('builds the invite URL from the origin and token (BR-L45-11)', () => {
    expect(inviteUrl('abc', 'http://localhost:4704')).toBe(
      'http://localhost:4704/ibu-bapa/terima/abc',
    )
  })

  it('builds the WhatsApp href with the encoded message (FR-L45-09)', () => {
    const href = whatsAppHref('http://x/ibu-bapa/terima/t')
    expect(href.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeURIComponent(href.slice('https://wa.me/?text='.length))).toBe(
      'Salam ibu/bapa! Klik pautan ini untuk pantau perkembangan saya di PRESTASIPLUS: http://x/ibu-bapa/terima/t',
    )
  })

  it('sorts parents case-insensitively and does not mutate the input', () => {
    const input = [
      { id: 1, name: 'budi', email: '', linkedAt: '' },
      { id: 2, name: 'Ali', email: '', linkedAt: '' },
    ]
    expect(sortParents(input).map((p) => p.name)).toEqual(['Ali', 'budi'])
    expect(input[0]?.name).toBe('budi')
  })
})
