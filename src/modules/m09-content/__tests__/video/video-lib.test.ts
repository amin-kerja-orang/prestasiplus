import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api'

import {
  detectPlatform,
  errorLines,
  isVideoCategory,
  listQuery,
  queryPage,
  querySubject,
  toSearchString,
} from '../../lib/video'

describe('detectPlatform (BR-M09-17)', () => {
  it('detects the four YouTube shapes with the hqdefault thumbnail', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=abc123XYZ00',
      'https://youtube.com/watch?x=1&v=abc123XYZ00',
      'https://www.youtube.com/embed/abc123XYZ00',
      'https://www.youtube.com/shorts/abc123XYZ00',
      'https://youtu.be/abc123XYZ00',
    ]) {
      expect(detectPlatform(url)).toEqual({
        label: 'YouTube',
        thumbnailUrl: 'https://img.youtube.com/vi/abc123XYZ00/hqdefault.jpg',
      })
    }
  })

  it('detects Vimeo without a thumbnail, Dailymotion with one, TikTok and Facebook video', () => {
    expect(detectPlatform('https://vimeo.com/123456')).toEqual({
      label: 'Vimeo',
      thumbnailUrl: null,
    })
    expect(detectPlatform('https://www.dailymotion.com/video/x8abc')).toEqual({
      label: 'Dailymotion',
      thumbnailUrl: 'https://www.dailymotion.com/thumbnail/video/x8abc',
    })
    expect(detectPlatform('https://dai.ly/x8abc')?.label).toBe('Dailymotion')
    expect(detectPlatform('https://www.tiktok.com/@a/video/1')?.label).toBe('TikTok')
    expect(detectPlatform('https://www.facebook.com/page/videos/1')?.label).toBe('Facebook')
  })

  it('shows nothing for an unsupported URL, a short id or Facebook without "video"', () => {
    expect(detectPlatform('https://example.com/x')).toBeNull()
    expect(detectPlatform('https://youtu.be/short')).toBeNull()
    expect(detectPlatform('https://www.facebook.com/page')).toBeNull()
    expect(detectPlatform('')).toBeNull()
  })
})

describe('query helpers', () => {
  it('reads page and subject defensively', () => {
    expect(queryPage('3')).toBe(3)
    expect(queryPage('0')).toBe(1)
    expect(queryPage(['x'])).toBe(1)
    expect(querySubject('5')).toBe(5)
    expect(querySubject('5x')).toBeUndefined()
    expect(querySubject(undefined)).toBeUndefined()
  })

  it('knows the five category codes', () => {
    expect(isVideoCategory('tips-spm')).toBe(true)
    expect(isVideoCategory('x')).toBe(false)
  })

  it('builds the observed link orders and keeps the search last', () => {
    expect(toSearchString(listQuery({}, 'subject-first'))).toBe('/video')
    expect(toSearchString(listQuery({ subject: 5, category: 'motivasi' }, 'subject-first'))).toBe(
      '/video?subject=5&category=motivasi',
    )
    expect(toSearchString(listQuery({ subject: 5, category: 'motivasi' }, 'category-first'))).toBe(
      '/video?category=motivasi&subject=5',
    )
    expect(toSearchString(listQuery({ subject: 5, search: ' abc ' }, 'subject-first'))).toBe(
      '/video?subject=5&search=abc',
    )
  })
})

describe('errorLines', () => {
  it('uses the field messages, then the message, then the generic copy', () => {
    const fields = new ApiError({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'x',
      fields: { title: 'A', videoUrl: 'A' },
    })
    expect(errorLines(fields)).toEqual(['A'])
    expect(
      errorLines(new ApiError({ status: 403, code: 'FORBIDDEN', message: 'Tiada akses' })),
    ).toEqual(['Tiada akses'])
    expect(errorLines(new Error('boom'))).toEqual(['Ralat berlaku. Sila cuba lagi.'])
  })
})
