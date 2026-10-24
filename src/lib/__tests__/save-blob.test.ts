// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { REVOKE_DELAY_MS, saveBlob } from '../save-blob'

describe('saveBlob', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('clicks a download link with the file name and releases the object URL only afterwards', () => {
    vi.useFakeTimers()
    const create = vi.fn(() => 'blob:x')
    const revoke = vi.fn()
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke })
    let href = ''
    let download = ''
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      href = this.href
      download = this.download
    })
    saveBlob(new Blob(['a']), 'a.csv')
    expect(href).toBe('blob:x')
    expect(download).toBe('a.csv')
    expect(document.querySelector('a[download]')).toBeNull()
    expect(revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(REVOKE_DELAY_MS)
    expect(revoke).toHaveBeenCalledWith('blob:x')
  })
})
