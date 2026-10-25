/**
 * Session image URLs of the S14 screenshots (DV-M09-23): bound to the row they were made for, so a
 * reused id after a mock reset never shows a stale image, and revoked once the row is gone.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  clearPreviews,
  previewUrlOf,
  pruneTo,
  rememberPreview,
  type PreviewRow,
} from '../../mock/repository/screenshot-previews'
import { support } from '../../mock'
import { bootM09 } from './helpers'

const row = (
  id: number,
  fileName = `f${String(id)}.png`,
  createdAt = '2026-09-25T15:40:00+08:00',
): PreviewRow => ({
  id,
  fileName,
  createdAt,
})

afterEach(() => {
  clearPreviews()
  vi.restoreAllMocks()
})

describe('screenshot previews', () => {
  it('keeps an object URL per row and revokes the one it replaces', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:a').mockReturnValueOnce('blob:b')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    rememberPreview(row(7), new Blob(['x']))
    expect(previewUrlOf(row(7))).toBe('blob:a')
    rememberPreview(row(7), new Blob(['y']))
    expect(previewUrlOf(row(7))).toBe('blob:b')
    expect(revoke).toHaveBeenCalledWith('blob:a')
    expect(previewUrlOf(row(8))).toBeUndefined()
  })

  it('a reused id of another file (name or time differs) gets no preview', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:old')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    rememberPreview(row(1, 'old.png'), new Blob(['x']))
    expect(previewUrlOf(row(1, 'new.png'))).toBeUndefined()
    expect(previewUrlOf(row(1, 'old.png', '2026-10-01T10:00:00+08:00'))).toBeUndefined()
  })

  it('pruneTo revokes previews whose row is gone or no longer matches', () => {
    vi.spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:keep')
      .mockReturnValueOnce('blob:gone')
      .mockReturnValueOnce('blob:other')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    rememberPreview(row(1), new Blob(['a']))
    rememberPreview(row(2), new Blob(['b']))
    rememberPreview(row(3, 'old.png'), new Blob(['c']))
    pruneTo([row(1), row(3, 'new.png')])
    expect(previewUrlOf(row(1))).toBe('blob:keep')
    expect(revoke).toHaveBeenCalledWith('blob:gone')
    expect(revoke).toHaveBeenCalledWith('blob:other')
    expect(revoke).not.toHaveBeenCalledWith('blob:keep')
    expect(previewUrlOf(row(2))).toBeUndefined()
  })

  it('after a mock reset a reused id shows no stale image and the old URL is revoked on the next list', async () => {
    const { runtime } = await bootM09()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:stale')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const first = support.addScreenshot(1, { name: 'a.png', size: 1, mime: 'image/png' })
    rememberPreview(first, new Blob(['x']))
    expect(previewUrlOf(first)).toBe('blob:stale')

    await runtime.reset()
    const again = support.addScreenshot(1, { name: 'b.png', size: 1, mime: 'image/png' })
    expect(again.id).toBe(first.id)
    expect(previewUrlOf(again)).toBeUndefined()

    pruneTo(support.screenshots())
    expect(revoke).toHaveBeenCalledWith('blob:stale')
  })
})
