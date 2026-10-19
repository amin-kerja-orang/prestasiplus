import { describe, expect, it } from 'vitest'

import { IMAGE_PLACEHOLDER, imageSrc, isMockBlob } from '../../lib/image-url'

describe('image-url (one rule for stored images)', () => {
  it('swaps a blob:mock name for the grey placeholder and keeps real URLs', () => {
    expect(imageSrc('blob:mock/a.png')).toBe(IMAGE_PLACEHOLDER)
    expect(imageSrc('https://contoh.test/a.png')).toBe('https://contoh.test/a.png')
    expect(IMAGE_PLACEHOLDER.startsWith('data:image/svg+xml')).toBe(true)
  })

  it('isMockBlob matches only the blob:mock/ prefix', () => {
    expect(isMockBlob('blob:mock/x')).toBe(true)
    expect(isMockBlob('blob:https://a/b')).toBe(false)
    expect(isMockBlob('')).toBe(false)
  })
})
