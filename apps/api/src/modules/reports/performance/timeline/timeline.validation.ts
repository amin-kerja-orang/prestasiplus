import {
  PERFORMANCE_TIMELINE_LIMITS,
  PERFORMANCE_TIMELINE_MESSAGES,
  PerformanceTimelineCreateRequestSchema,
} from '@pp/contract'

import { inspectUpload } from '../../../files/content-inspect'
import type { TimelineCategory } from '../ports'

const MSG = PERFORMANCE_TIMELINE_MESSAGES
const LIMITS = PERFORMANCE_TIMELINE_LIMITS

/** One uploaded part: only the bytes are read, never the client's file name or declared type. */
export interface RawPhoto {
  buffer: Buffer
}

export interface ValidTimelineInput {
  title: string
  category: TimelineCategory
  eventDate: string | null
  story: string | null
  /** Photos in upload order; the type is decided from the bytes (magic numbers), never from the name or header. */
  photos: { bytes: Buffer; caption: string | null }[]
}

export type TimelineValidation =
  | { ok: true; value: ValidTimelineInput }
  | { ok: false; fields: Record<string, string> }

const asText = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

/** A real calendar day (the mock only checks the shape; `2026-02-31` would be a database error). */
export function isCalendarDay(text: string): boolean {
  const d = new Date(`${text}T00:00:00.000Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text
}

/**
 * The caption of photo `index`, read by index only (the `captions` array can be sparse or huge, so it is never
 * iterated). Trimmed; truncated to 200 characters (contract); empty means no caption.
 */
export function captionOf(captions: unknown, index: number): string | null {
  const raw = Array.isArray(captions)
    ? (captions as unknown[])[index]
    : typeof captions === 'object' && captions !== null && Object.hasOwn(captions, String(index))
      ? (captions as Record<string, unknown>)[String(index)]
      : undefined
  const text = asText(raw)?.trim()
  if (text === undefined || text === '') return null
  return [...text].slice(0, LIMITS.captionMax).join('')
}

/**
 * Validates the multipart fields and photos of `POST /timeline` against the contract. Field messages are the
 * contract's, one per field (the first problem of that field), in field order. Photos are judged from their bytes:
 * 1 to 5 files, at most 2 MB each, and JPEG, PNG or WebP by magic number (a `.png` that is really HTML is refused);
 * the container must also parse (`inspectUpload`). Nothing is written here.
 */
export function validateTimelineInput(body: unknown, photos: readonly RawPhoto[]): TimelineValidation {
  const record = typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {}
  const eventDate = record.eventDate
  const parsed = PerformanceTimelineCreateRequestSchema.safeParse({
    title: asText(record.title) ?? '',
    category: asText(record.category),
    eventDate: eventDate === undefined ? undefined : (asText(eventDate) ?? 'invalid'),
    story: record.story === undefined ? undefined : (asText(record.story) ?? 'x'.repeat(LIMITS.storyMax + 1)),
    // The schema counts the photo parts; the bytes are checked below.
    photos: photos.map(() => 'file'),
  })
  const fields: Record<string, string> = {}
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '_')
      fields[key] ??= issue.message
    }
  }
  if (typeof eventDate === 'string' && eventDate !== '' && fields.eventDate === undefined && !isCalendarDay(eventDate)) {
    fields.eventDate = MSG.dateInvalid
  }
  if (fields.photos === undefined) {
    const mimes: readonly string[] = LIMITS.photoTypes
    const bad = photos.some((p) => {
      if (p.buffer.length === 0 || p.buffer.length > LIMITS.photoMaxBytes) return true
      const found = inspectUpload(p.buffer)
      return found === null || !mimes.includes(found.mime)
    })
    if (bad) fields.photos = MSG.photoInvalid
  }
  if (!parsed.success || Object.keys(fields).length > 0) {
    // Report in the contract's field order.
    const ordered: Record<string, string> = {}
    for (const key of ['title', 'category', 'eventDate', 'story', 'photos']) {
      const message = fields[key]
      if (message !== undefined) ordered[key] = message
    }
    return { ok: false, fields: ordered }
  }
  const data = parsed.data
  return {
    ok: true,
    value: {
      title: data.title,
      category: data.category,
      eventDate: data.eventDate === undefined || data.eventDate === '' ? null : data.eventDate,
      story: data.story === undefined || data.story.trim() === '' ? null : data.story,
      photos: photos.map((p, i) => ({ bytes: p.buffer, caption: captionOf(record.captions, i) })),
    },
  }
}

/** Laravel `ValidationException::summarize`: the first message, plus "(and N more error(s))". */
export function summarizeFields(fields: Record<string, string>): string {
  const messages = Object.values(fields)
  const first = messages[0] ?? ''
  const more = messages.length - 1
  return more <= 0 ? first : `${first} (and ${String(more)} more error${more === 1 ? '' : 's'})`
}
