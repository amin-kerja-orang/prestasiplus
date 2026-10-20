import { BadRequestException, PayloadTooLargeException } from '@nestjs/common'
import { PERFORMANCE_TIMELINE_MESSAGES as MSG } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { ApiError } from '../../../../src/common/errors/api-error'
import { multerFailureToApiError } from '../../../../src/modules/reports/performance/timeline/timeline-upload.interceptor'
import { mayPost } from '../../../../src/modules/reports/performance/timeline/timeline.service'
import {
  captionOf,
  isCalendarDay,
  summarizeFields,
  validateTimelineInput,
} from '../../../../src/modules/reports/performance/timeline/timeline.validation'
import { makeJpeg, makePng, makeWebp } from '../../../files/fixtures'

const png = (): { buffer: Buffer } => ({ buffer: makePng() })
const good = { title: 'Johan kuiz', category: 'pencapaian' }

function fieldsOf(body: unknown, photos: { buffer: Buffer }[]): Record<string, string> {
  const r = validateTimelineInput(body, photos)
  if (r.ok) throw new Error('expected a refusal')
  return r.fields
}

describe('timeline validation: fields', () => {
  it('accepts a title, a category and one photo; the optional fields become null', () => {
    const r = validateTimelineInput(good, [png()])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toMatchObject({ title: 'Johan kuiz', category: 'pencapaian', eventDate: null, story: null })
  })

  it('trims the title and keeps a story and a date', () => {
    const r = validateTimelineInput({ ...good, title: '  Tajuk  ', eventDate: '2026-02-28', story: 'Cerita' }, [png()])
    expect(r.ok && r.value).toMatchObject({ title: 'Tajuk', eventDate: '2026-02-28', story: 'Cerita' })
  })

  it('uses the contract messages verbatim', () => {
    expect(fieldsOf({ ...good, title: '   ' }, [png()])).toEqual({ title: MSG.titleRequired })
    expect(fieldsOf({ ...good, title: 'x'.repeat(151) }, [png()])).toEqual({ title: MSG.titleTooLong })
    expect(fieldsOf({ ...good, category: 'bukan' }, [png()])).toEqual({ category: MSG.categoryInvalid })
    expect(fieldsOf({ ...good, category: undefined }, [png()])).toEqual({ category: MSG.categoryInvalid })
    expect(fieldsOf({ ...good, eventDate: '14/08/2026' }, [png()])).toEqual({ eventDate: MSG.dateInvalid })
    expect(fieldsOf({ ...good, story: 'x'.repeat(2001) }, [png()])).toEqual({ story: MSG.storyTooLong })
    expect(fieldsOf(good, [])).toEqual({ photos: MSG.photosRequired })
  })

  it('accepts a 2000 character story and a 150 character title (the limits are inclusive)', () => {
    expect(validateTimelineInput({ ...good, title: 'x'.repeat(150), story: 'y'.repeat(2000) }, [png()]).ok).toBe(true)
  })

  it('refuses a date that is not on the calendar', () => {
    expect(isCalendarDay('2026-02-28')).toBe(true)
    expect(isCalendarDay('2024-02-29')).toBe(true)
    expect(isCalendarDay('2026-02-31')).toBe(false)
    expect(isCalendarDay('2026-13-01')).toBe(false)
    expect(fieldsOf({ ...good, eventDate: '2026-02-31' }, [png()])).toEqual({ eventDate: MSG.dateInvalid })
    expect(validateTimelineInput({ ...good, eventDate: '' }, [png()]).ok).toBe(true)
  })

  it('treats a repeated or non-text field as invalid, never as a crash', () => {
    expect(fieldsOf({ ...good, title: ['a', 'b'] }, [png()])).toEqual({ title: MSG.titleRequired })
    expect(fieldsOf({ ...good, eventDate: ['2026-01-01'] }, [png()])).toEqual({ eventDate: MSG.dateInvalid })
    expect(fieldsOf({ ...good, story: { a: 1 } }, [png()])).toEqual({ story: MSG.storyTooLong })
    expect(fieldsOf(null, [png()])).toMatchObject({ title: MSG.titleRequired, category: MSG.categoryInvalid })
  })

  it('reports every bad field in the contract order, one message each', () => {
    const f = fieldsOf({ title: '', category: 'x', eventDate: 'bad', story: 'y'.repeat(2001) }, [])
    expect(Object.keys(f)).toEqual(['title', 'category', 'eventDate', 'story', 'photos'])
  })

  it('summarises like Laravel: the first message plus the number of the rest', () => {
    expect(summarizeFields({ a: 'Satu' })).toBe('Satu')
    expect(summarizeFields({ a: 'Satu', b: 'Dua' })).toBe('Satu (and 1 more error)')
    expect(summarizeFields({ a: 'Satu', b: 'Dua', c: 'Tiga' })).toBe('Satu (and 2 more errors)')
  })
})

describe('timeline validation: photos are judged by their bytes', () => {
  it('accepts JPEG, PNG and WebP', () => {
    expect(validateTimelineInput(good, [png(), { buffer: makeJpeg() }, { buffer: makeWebp() }]).ok).toBe(true)
  })

  it('accepts 5 photos and refuses 6', () => {
    const five = Array.from({ length: 5 }, png)
    expect(validateTimelineInput(good, five).ok).toBe(true)
    expect(fieldsOf(good, [...five, png()])).toEqual({ photos: MSG.photosRequired })
  })

  it('refuses a .png that is really HTML, plain text, an empty part and a PDF', () => {
    const html = { buffer: Buffer.from('<html><script>alert(1)</script></html>') }
    expect(fieldsOf(good, [html])).toEqual({ photos: MSG.photoInvalid })
    expect(fieldsOf(good, [{ buffer: Buffer.from('hello') }])).toEqual({ photos: MSG.photoInvalid })
    expect(fieldsOf(good, [{ buffer: Buffer.alloc(0) }])).toEqual({ photos: MSG.photoInvalid })
    expect(fieldsOf(good, [{ buffer: Buffer.from('%PDF-1.4 fictitious') }])).toEqual({ photos: MSG.photoInvalid })
  })

  it('refuses one bad photo among good ones (all or nothing)', () => {
    expect(fieldsOf(good, [png(), { buffer: Buffer.from('MZ not an image') }, png()])).toEqual({ photos: MSG.photoInvalid })
  })

  it('refuses a file over 2 MB and accepts one of exactly 2 MB', () => {
    expect(fieldsOf(good, [{ buffer: makePng({ padTo: 2 * 1024 * 1024 + 44 }) }])).toEqual({ photos: MSG.photoInvalid })
    expect(validateTimelineInput(good, [{ buffer: makePng({ padTo: 2 * 1024 * 1024 + 43 }) }]).ok).toBe(true)
  })

  it('refuses a PNG header that is truncated (the container must parse)', () => {
    expect(fieldsOf(good, [{ buffer: makePng().subarray(0, 12) }])).toEqual({ photos: MSG.photoInvalid })
  })
})

describe('timeline validation: captions', () => {
  it('trims, turns empty into null and truncates to 200 characters', () => {
    expect(captionOf(['  Hari sukan  '], 0)).toBe('Hari sukan')
    expect(captionOf(['   '], 0)).toBeNull()
    expect(captionOf([], 0)).toBeNull()
    expect(captionOf(['a'.repeat(250)], 0)).toBe('a'.repeat(200))
  })

  it('reads by index only, from an array or an index-keyed object, and ignores anything else', () => {
    expect(captionOf(['a', 'b'], 1)).toBe('b')
    expect(captionOf({ '0': 'x', '1': 'y' }, 1)).toBe('y')
    expect(captionOf('text', 0)).toBeNull()
    expect(captionOf([['nested']], 0)).toBeNull()
    expect(captionOf({ __proto__: { 0: 'p' } }, 0)).toBeNull()
  })

  it('does not iterate a huge sparse array', () => {
    const sparse: string[] = []
    sparse[999_999_999] = 'far away'
    expect(captionOf(sparse, 0)).toBeNull()
  })

  it('maps each caption to its photo', () => {
    const r = validateTimelineInput({ ...good, captions: ['Satu', '', 'Tiga'] }, [png(), png(), png()])
    expect(r.ok && r.value.photos.map((p) => p.caption)).toEqual(['Satu', null, 'Tiga'])
  })

  it('does not count a caption of a photo that was not sent', () => {
    const r = validateTimelineInput({ ...good, captions: ['Satu', 'Dua', 'Tiga'] }, [png()])
    expect(r.ok && r.value.photos.map((p) => p.caption)).toEqual(['Satu'])
  })
})

describe('timeline upload: multer failures become the contract 422', () => {
  const fieldsOf422 = (err: unknown): Record<string, string> | undefined => {
    const mapped = multerFailureToApiError(err)
    expect(mapped).toBeInstanceOf(ApiError)
    expect(mapped?.code).toBe('VALIDATION_ERROR')
    return mapped?.fields
  }

  it('maps a file over 2 MB to the photo message', () => {
    expect(fieldsOf422(new PayloadTooLargeException())).toEqual({ photos: MSG.photoInvalid })
  })

  it('maps too many files and a file in the wrong part to the photos-required message', () => {
    expect(fieldsOf422(new BadRequestException('Too many files'))).toEqual({ photos: MSG.photosRequired })
    expect(fieldsOf422(new BadRequestException('Unexpected field'))).toEqual({ photos: MSG.photosRequired })
  })

  it('maps a text field over its limit by the actual field name, with the contract copy', () => {
    expect(fieldsOf422(new BadRequestException('Field value too long - story'))).toEqual({ story: MSG.storyTooLong })
    expect(fieldsOf422(new BadRequestException('Field value too long - title'))).toEqual({ title: MSG.titleTooLong })
    expect(fieldsOf422(new BadRequestException('Field value too long - eventDate'))).toEqual({ eventDate: MSG.dateInvalid })
    expect(fieldsOf422(new BadRequestException('Field value too long - category'))).toEqual({ category: MSG.categoryInvalid })
    expect(Object.keys(fieldsOf422(new BadRequestException('Field value too long - captions[2]')) ?? {})).toEqual(['captions[2]'])
  })

  it('a too-long value of an unknown or unnamed field is the generic photos error, never the story message', () => {
    expect(fieldsOf422(new BadRequestException('Field value too long - nonsense'))).toEqual({ photos: MSG.photosRequired })
    expect(fieldsOf422(new BadRequestException('Field value too long'))).toEqual({ photos: MSG.photosRequired })
  })

  it('leaves other errors alone', () => {
    expect(multerFailureToApiError(new Error('boom'))).toBeNull()
  })
})

describe('timeline: who may post (OQ-6)', () => {
  it('allows a student, and an admin only in Mod Pelajar', () => {
    expect(mayPost({ role: 'student', isTest: false })).toBe(true)
    expect(mayPost({ role: 'student', isTest: true })).toBe(true)
    expect(mayPost({ role: 'admin', isTest: true })).toBe(true)
    expect(mayPost({ role: 'admin', isTest: false })).toBe(false)
  })

  it('refuses every other role', () => {
    for (const role of ['teacher', 'school_admin', 'parent', 'ppd_officer'] as const) {
      expect(mayPost({ role, isTest: false })).toBe(false)
      expect(mayPost({ role, isTest: true })).toBe(false)
    }
  })
})
