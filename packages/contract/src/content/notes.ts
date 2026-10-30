import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import { listEnvelopeOf } from '../common/envelope'
import { ARTICLE_CONTENT_MAX } from './articles'
import { ContentUserRefSchema, counter, optionalText, pageQuery, requiredText } from './common'

/**
 * M09 notes (admin only, #10-#14). Mock: `handlers/admin-notes.ts`. There is no notes reader
 * (FR-M09-50). The create/edit forms exist because of DV-M09-01.
 */

export const NOTE_SUBJECTS = ['matematik', 'sains', 'bahasa_melayu', 'bahasa_inggeris', 'sejarah'] as const
export const NoteSubjectSchema = z.enum(NOTE_SUBJECTS).meta({ id: 'NoteSubject' })
export type NoteSubject = z.infer<typeof NoteSubjectSchema>

export const NOTE_SUBJECT_LABELS = {
  matematik: 'Matematik',
  sains: 'Sains',
  bahasa_melayu: 'Bahasa Melayu',
  bahasa_inggeris: 'Bahasa Inggeris',
  sejarah: 'Sejarah',
} as const satisfies Record<NoteSubject, string>

/** The four types the create/edit form accepts (FN-M09-3.2.3). */
export const NOTE_FORM_TYPES = ['FORMULA', 'RINGKASAN', 'LENGKAP', 'TIPS_TRICKS'] as const
/** Every stored type (three more exist in imported data and are listable, but not creatable). */
export const NOTE_STORED_TYPES = [...NOTE_FORM_TYPES, 'MIND_MAP', 'FLASHCARD', 'CHEAT_SHEET'] as const
export const NoteFormTypeSchema = z.enum(NOTE_FORM_TYPES).meta({ id: 'NoteFormType' })
export const NoteStoredTypeSchema = z.enum(NOTE_STORED_TYPES).meta({ id: 'NoteStoredType' })

/** Values of the S5 `noteType` list filter (DV-M09-06) and the stored type each one selects. */
export const NOTE_TYPE_FILTERS = {
  summary: 'RINGKASAN',
  full_notes: 'LENGKAP',
  mind_map: 'MIND_MAP',
  flashcard: 'FLASHCARD',
  cheat_sheet: 'CHEAT_SHEET',
} as const

/** Stored grades: Darjah values stay readable (existing and migrated rows); new writes accept NOTE_WRITE_GRADES only (secondary-only, 2026-10-29). */
export const NOTE_GRADES = ['DARJAH_1', 'DARJAH_2', 'DARJAH_3', 'DARJAH_4', 'DARJAH_5', 'DARJAH_6', 'TINGKATAN_4', 'TINGKATAN_5'] as const
export const NOTE_WRITE_GRADES = ['TINGKATAN_4', 'TINGKATAN_5'] as const
export const NoteGradeSchema = z.enum(NOTE_GRADES).meta({ id: 'NoteGrade' })
export const NoteWriteGradeSchema = z.enum(NOTE_WRITE_GRADES).meta({ id: 'NoteWriteGrade' })

export const NOTE_PAGE_SIZE = 20
export const NOTE_SUMMARY_MAX = 1000

const noteItemShape = {
  id: IdSchema,
  title: z.string(),
  summary: z.string().nullable(),
  subject: NoteSubjectSchema,
  subjectLabel: z.string(),
  noteType: NoteStoredTypeSchema,
  grade: z.string().min(1).meta({ description: 'Stored `DARJAH_n` (legacy) or `TINGKATAN_4` / `TINGKATAN_5`.' }),
  gradeLabel: z.string().meta({ description: '"Darjah n" or "Tingkatan n".' }),
  isPublished: z.boolean(),
  views: counter(),
  downloads: counter(),
  author: ContentUserRefSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}

/** Row of the admin list (#10). */
export const AdminNoteItemSchema = z.strictObject(noteItemShape).meta({ id: 'AdminNoteItem' })

/** Detail (#11, and the `data` of #12/#13): the list item plus `content`. */
export const AdminNoteDetailSchema = z
  .strictObject({ ...noteItemShape, content: z.string() })
  .meta({ id: 'AdminNoteDetail' })
export type AdminNoteDetail = z.infer<typeof AdminNoteDetailSchema>

export const AdminNoteListQuerySchema = z
  .object({
    search: z.string().optional().meta({ description: 'Title contains, case-insensitive.' }),
    subject: z.string().optional().meta({ description: 'A NoteSubject code or `all`.' }),
    noteType: z.string().optional().meta({
      description: 'Filter value: summary, mind_map, flashcard, cheat_sheet, full_notes, or `all`. Other values are ignored (no filter).',
    }),
    page: pageQuery(),
  })
  .meta({ id: 'AdminNoteListQuery' })

const noteBodyShape = {
  title: requiredText(255),
  summary: optionalText(NOTE_SUMMARY_MAX),
  content: z.string().trim().min(1).max(ARTICLE_CONTENT_MAX).meta({ description: 'Rich text HTML; sanitised on write.' }),
  subject: NoteSubjectSchema,
  noteType: NoteFormTypeSchema,
  grade: NoteWriteGradeSchema,
  isPublished: z.boolean().optional().meta({ description: 'Default false on create.' }),
}

/** Create body (#12). The mock lower-cases `subject` and upper-cases `noteType` / `grade` before checking them. */
export const AdminNoteCreateRequestSchema = z.object(noteBodyShape).meta({ id: 'AdminNoteCreateRequest' })

/** Update body (#13): every field optional (an absent field keeps its value). */
export const AdminNoteUpdateRequestSchema = z.object(noteBodyShape).partial().meta({ id: 'AdminNoteUpdateRequest' })

export const AdminNoteListResponseSchema = listEnvelopeOf(AdminNoteItemSchema)
