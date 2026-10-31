/**
 * SRS M09 v1.6 §7 #10 `GET /api/admin/notes` (S5), #11 `GET /api/admin/notes/:id` (S7, S8),
 * #12 `POST /api/admin/notes` (S6), #13 `PUT /api/admin/notes/:id` (S7) and #14
 * `DELETE /api/admin/notes/:id`. Admin only. The create and edit forms exist only because of the
 * DV-M09-01 fix (live answers HTTP 500); there is no notes reader (FR-M09-50).
 */

import {
  created,
  int,
  notFound,
  ok,
  paged,
  pageParams,
  queryString,
  route,
  validationError,
  type RouteDef,
} from '@/mock/define'

import { notesRepo } from '../repository'
import { authorRef } from '../repository/common'
import { isGradeShown, type NoteRow, type NoteSubject, type NoteType } from '../types'
import {
  ADMIN_FLASH,
  adminOnly,
  asBool,
  bodyOf,
  clean,
  has,
  MAX_LEN,
  NOT_FOUND,
} from './admin-common'
import { FIELD_INVALID, FIELD_REQUIRED, requireViewer } from './common'

const NOTE_PAGE_SIZE = 20

/** BR-M09-11 subject codes and labels. */
export const NOTE_SUBJECTS: Readonly<Record<NoteSubject, string>> = {
  matematik: 'Matematik',
  sains: 'Sains',
  bahasa_melayu: 'Bahasa Melayu',
  bahasa_inggeris: 'Bahasa Inggeris',
  sejarah: 'Sejarah',
}

/** The 4 stored types the form accepts (FN-M09-3.2.3). */
export const NOTE_FORM_TYPES: readonly NoteType[] = [
  'FORMULA',
  'RINGKASAN',
  'LENGKAP',
  'TIPS_TRICKS',
]

/** Writable grades: Tingkatan 4 and 5 only (secondary-only, D72; the contract's `NOTE_WRITE_GRADES`). */
export const NOTE_GRADES: readonly string[] = ['TINGKATAN_4', 'TINGKATAN_5']
const PRIMARY_NOTE_GRADES: readonly string[] = [1, 2, 3, 4, 5, 6].map((n) => `DARJAH_${String(n)}`)
/** The grades a write accepts now (the Darjah ones only while the primary content is switched on). */
const writableGrades = (): readonly string[] =>
  isGradeShown('DARJAH_1') ? [...NOTE_GRADES, ...PRIMARY_NOTE_GRADES] : NOTE_GRADES

type NoteInput = Parameters<typeof notesRepo.create>[1]

/** `grade` `TINGKATAN_4` as "Tingkatan 4" (the screens upper-case it by CSS). */
const gradeLabel = (grade: string): string =>
  grade.replace(/^DARJAH_(\d+)$/, 'Darjah $1').replace(/^TINGKATAN_(\d+)$/, 'Tingkatan $1')

/** `NoteItem` (S5 row) and `NoteDetail` (S7/S8: adds `content`). */
function itemOf(n: NoteRow) {
  return {
    id: n.id,
    title: n.title,
    summary: n.summary,
    subject: n.subject,
    subjectLabel: NOTE_SUBJECTS[n.subject] ?? n.subject,
    noteType: n.noteType,
    grade: n.grade,
    gradeLabel: gradeLabel(n.grade),
    isPublished: n.isPublished,
    views: n.views,
    downloads: n.downloads,
    author: { id: n.authorId, name: authorRef(n.authorId).name },
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  }
}

const detailOf = (n: NoteRow) => ({ ...itemOf(n), content: n.content })

function parse(
  raw: unknown,
  current?: NoteRow,
): { fields: Record<string, string> } | { input: NoteInput } {
  const body = bodyOf(raw)
  const fields: Record<string, string> = {}

  const text = (key: 'title' | 'summary' | 'content', max: number, required: boolean) => {
    if (current && !has(body, key)) return current[key]
    const v = clean(body[key])
    if (v === null || v === undefined) {
      if (required) fields[key] = FIELD_REQUIRED
      return null
    }
    if (typeof v !== 'string' || v.length > max) {
      fields[key] = FIELD_INVALID
      return null
    }
    return v
  }
  const title = text('title', 255, true)
  const summary = text('summary', 1000, false)
  const content = text('content', MAX_LEN.content, true)

  const choice = <T extends string>(
    key: 'subject' | 'noteType' | 'grade',
    allowed: readonly string[],
    currentValue: T | undefined,
    upper: boolean,
  ): T | undefined => {
    if (current && !has(body, key)) return currentValue
    const v = clean(body[key])
    if (v === null || v === undefined) {
      fields[key] = FIELD_REQUIRED
      return undefined
    }
    const value = typeof v === 'string' ? (upper ? v.toUpperCase() : v.toLowerCase()) : ''
    if (!allowed.includes(value)) {
      fields[key] = FIELD_INVALID
      return undefined
    }
    return value as T
  }
  const subject = choice<NoteSubject>(
    'subject',
    Object.keys(NOTE_SUBJECTS),
    current?.subject,
    false,
  )
  const noteType = choice<NoteType>('noteType', NOTE_FORM_TYPES, current?.noteType, true)
  const grade = choice<string>('grade', writableGrades(), current?.grade, true)

  let isPublished = current?.isPublished ?? false
  if (has(body, 'isPublished')) {
    const b = asBool(body.isPublished)
    if (b === undefined) fields.isPublished = FIELD_INVALID
    else isPublished = b
  }

  if (Object.keys(fields).length > 0) return { fields }
  return {
    input: {
      title: title as string,
      summary,
      content: content as string,
      subject: subject as NoteSubject,
      noteType: noteType as NoteType,
      grade: grade as string,
      isPublished,
    },
  }
}

export const adminNoteRoutes: RouteDef[] = [
  route('GET', '/api/admin/notes', [adminOnly], (req) => {
    const page = pageParams(req.query, { pageSize: NOTE_PAGE_SIZE })
    const res = notesRepo.adminList({
      search: queryString(req.query, 'search') ?? '',
      subject: queryString(req.query, 'subject')?.trim() ?? '',
      noteType: queryString(req.query, 'noteType')?.trim() ?? '',
      page: page.page,
      pageSize: page.pageSize,
    })
    return paged({ rows: res.rows.map(itemOf), total: res.total }, page)
  }),

  route(
    'GET',
    '/api/admin/notes/:id',
    [adminOnly],
    (req) => {
      const row = notesRepo.getVisible(Number(req.params.id))
      return row ? ok(detailOf(row)) : notFound(NOT_FOUND.note)
    },
    { params: { id: int() } },
  ),

  route('POST', '/api/admin/notes', [adminOnly], (req) => {
    const parsed = parse(req.body)
    if ('fields' in parsed) return validationError(parsed.fields)
    const row = notesRepo.create(requireViewer(req).id, parsed.input)
    return created(detailOf(row), { status: ADMIN_FLASH.note.created })
  }),

  route(
    'PUT',
    '/api/admin/notes/:id',
    [adminOnly],
    (req) => {
      const id = Number(req.params.id)
      const current = notesRepo.getVisible(id)
      if (!current) return notFound(NOT_FOUND.note)
      const parsed = parse(req.body, current)
      if ('fields' in parsed) return validationError(parsed.fields)
      return ok(detailOf(notesRepo.update(id, parsed.input)), { status: ADMIN_FLASH.note.updated })
    },
    { params: { id: int() } },
  ),

  route(
    'DELETE',
    '/api/admin/notes/:id',
    [adminOnly],
    (req) => {
      const id = Number(req.params.id)
      if (!notesRepo.getVisible(id)) return notFound(NOT_FOUND.note)
      notesRepo.remove(id)
      return ok({ deleted: 1 }, { status: ADMIN_FLASH.note.deleted })
    },
    { params: { id: int() } },
  ),
]
