// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { copyText } from '../../lib/timeline/clipboard'

vi.mock('@/components/overlay/native-dialogs', () => ({ alertNative: vi.fn() }))

const setClipboard = (value: unknown): void => {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true })
}

afterEach(() => {
  setClipboard(undefined)
})

describe('copyText', () => {
  it('returns true when the write succeeds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ writeText })
    await expect(copyText('https://x.test/pelajar/1')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('https://x.test/pelajar/1')
  })

  it('returns false, without throwing, when the write is rejected', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) })
    await expect(copyText('x')).resolves.toBe(false)
  })

  it('returns false, without throwing, when navigator.clipboard is undefined', async () => {
    setClipboard(undefined)
    await expect(copyText('x')).resolves.toBe(false)
  })
})
