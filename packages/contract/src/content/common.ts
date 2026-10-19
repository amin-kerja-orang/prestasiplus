import { z } from '../zod'
import { IdSchema } from '../common/ids'

/**
 * Shared pieces of the M09 content wire contract (BE-24, contract-only).
 *
 * The frontend mock (`src/modules/m09-content/mock`) is the wire spec. Ids are opaque strings
 * (`Id`) even where the mock uses integers (OQ-API-B4-1, UD-1). Article slugs stay strings.
 */

// ---------------------------------------------------------------------------------------------
// Local reference shapes (owners: users BE-05, schools BE-05, curriculum BE-08). Content never
// imports another domain folder; these are the `{ id, name }` pairs the mock embeds.
// ---------------------------------------------------------------------------------------------

/** Education level reference (curriculum is owned by BE-08). */
export const ContentLevelRefSchema = z
  .strictObject({ id: IdSchema, name: z.string() })
  .meta({ id: 'ContentLevelRef', description: 'Education level `{ id, name }` (owner: curriculum, BE-08).' })

/** Subject reference (curriculum is owned by BE-08). */
export const ContentSubjectRefSchema = z
  .strictObject({ id: IdSchema, name: z.string() })
  .meta({ id: 'ContentSubjectRef', description: 'Subject `{ id, name }` (owner: curriculum, BE-08).' })

/** School reference (schools are owned by BE-05). */
export const ContentSchoolRefSchema = z
  .strictObject({ id: IdSchema, name: z.string() })
  .meta({ id: 'ContentSchoolRef', description: 'School `{ id, name }` (owner: schools, BE-05).' })

/** User reference used by admin lists (users are owned by BE-05). */
export const ContentUserRefSchema = z
  .strictObject({ id: IdSchema, name: z.string() })
  .meta({ id: 'ContentUserRef', description: 'User `{ id, name }` (owner: users, BE-05).' })

// ---------------------------------------------------------------------------------------------
// Copy and codes (exact BM strings of the mock)
// ---------------------------------------------------------------------------------------------

/** Generic and module messages the M09 handlers produce. Default 404 copy is the mock's. */
export const CONTENT_MESSAGES = {
  fieldRequired: 'Medan ini diperlukan.',
  fieldInvalid: 'Medan ini tidak sah.',
  notFound: 'Not Found.',
  forbidden: 'This action is unauthorized.',
  articleNotFound: 'Artikel tidak dijumpai.',
  noteNotFound: 'Nota tidak dijumpai.',
  bannerNotFound: 'Banner tidak dijumpai.',
  videoNoSchool: 'Anda tiada sekolah untuk dikongsi.',
  videoEditForbidden: 'Anda tidak dibenarkan mengubah video ini.',
  videoDeleteForbidden: 'Anda tidak dibenarkan memadam video ini.',
  perutusanWriteForbidden: 'Anda tidak dibenarkan menulis perutusan.',
  perutusanPinLimit: 'Maksimum 2 perutusan boleh disematkan.',
  perutusanSchoolAdminNoSchool: 'Pentadbir sekolah mesti mempunyai sekolah.',
  commentLength: 'Komen mesti antara 1 hingga 1000 aksara.',
  audioSetShape: 'Set mesti mempunyai 4 bahagian dan 30 soalan.',
  screenshotRefused: 'Fail mesti JPG, PNG, GIF, WebP atau BMP, maksimum 10 MB.',
  screenshotMaxFiles: 'Maksimum 20 fail setiap muat naik.',
  supportConfigMissing: 'Konfigurasi sokongan tidak dijumpai.',
} as const

/** Per-file refusal copy: "{file}: format atau saiz tidak dibenarkan." */
export const contentFileRefused = (name: string): string => `${name}: format atau saiz tidak dibenarkan.`

/** Success flash texts returned in the extra top-level `status` key (PROPOSED COPY, SRS M09 8.2). */
export const CONTENT_FLASH = {
  article: {
    created: 'Artikel berjaya ditambah.',
    updated: 'Artikel berjaya dikemaskini.',
    deleted: 'Artikel berjaya dipadam.',
  },
  note: {
    created: 'Nota berjaya ditambah.',
    updated: 'Nota berjaya dikemaskini.',
    deleted: 'Nota berjaya dipadam.',
  },
  banner: {
    created: 'Banner berjaya ditambah.',
    updated: 'Banner berjaya dikemaskini.',
    deleted: 'Banner berjaya dipadam.',
  },
  video: {
    created: 'Video berjaya diterbitkan.',
    updated: 'Video berjaya dikemaskini.',
    deleted: 'Video berjaya dipadam.',
  },
  perutusan: {
    published: 'Perutusan berjaya dihantar.',
    scheduled: 'Perutusan dijadualkan.',
    draft: 'Draf perutusan disimpan.',
  },
  commentSent: 'Komen anda telah dihantar dan akan disemak.',
  audioCreated: 'Set Audio KBAT berjaya disimpan.',
  screenshots: (n: number): string => `${String(n)} fail berjaya dimuat naik.`,
} as const

// ---------------------------------------------------------------------------------------------
// Envelopes
// ---------------------------------------------------------------------------------------------

/**
 * Mutating M09 routes answer `{ data, status }`: `status` is the BM flash text the screen queues
 * (SRS M09 8.2). Deletes answer 200 (not 204).
 */
export function contentMutationOf<T extends z.ZodType>(data: T) {
  return z.object({ data, status: z.string().min(1).meta({ description: 'BM flash text for the success message.' }) })
}

/** `{ data: { deleted: 1 }, status }` body of every M09 delete. */
export const ContentDeletedSchema = z
  .strictObject({ deleted: z.literal(1) })
  .meta({ id: 'ContentDeleted', description: 'Delete result; the row is hard-deleted.' })

// ---------------------------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------------------------

/** Required text: trimmed by the server (blank counts as missing), at most `max` characters. */
export const requiredText = (max: number) => z.string().trim().min(1).max(max)

/** Optional text: `null` or blank clears the stored value on update (Laravel ConvertEmptyStringsToNull). */
export const optionalText = (max: number) => z.string().trim().max(max).nullable().optional()

/** http or https URL, at most 2048 characters. */
export const httpUrl = () => z.url({ protocol: /^https?$/ }).max(2048)

/** Non-negative counter (views, likes, reads...). */
export const counter = () => z.number().int().min(0)

/** Request `page` query: invalid or missing means 1 (an out-of-range page is not an error). */
export const pageQuery = () => z.coerce.number().int().min(1).optional()

/** Opaque id in a path. Non-existing or malformed ids are 404 (the mock 404s a non-numeric id). */
export const idParams = z.object({ id: IdSchema })

/**
 * Multipart boolean: the form sends text. The mock treats `true`, `1`, `on`, `yes` as true and
 * anything else as false (never an error).
 */
export const FormBooleanSchema = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0', 'on', 'off', 'yes', 'no'])])
  .meta({ id: 'ContentFormBoolean', description: 'Multipart boolean: true/false, "true", "1", "on", "yes" are true; anything else is false.' })

/** Options of a file field. */
export interface UploadFileOptions {
  maxBytes: number
  /** Accepted declared MIME types. An empty declared type is judged by extension. */
  mimes: readonly string[]
  /** Accepted extensions (lower case, without the dot). */
  extensions: readonly string[]
  /** When set, the declared type must be the type of the extension (screenshots: `a.gif` declared `image/png` is refused). */
  mimeByExtension?: Readonly<Record<string, string>>
  description: string
}

/**
 * A multipart file part (OpenAPI `string` / `binary`). Validates `Blob`/`File` instances: size,
 * declared MIME type (or, when the browser sends none, the extension). File storage itself belongs
 * to BE-04 (`FileStorage`); the contract only describes the field.
 */
export function uploadFile(options: UploadFileOptions) {
  const { maxBytes, mimes, extensions, mimeByExtension, description } = options
  return z
    .custom<Blob>((value) => {
      if (!(value instanceof Blob)) return false
      if (value.size > maxBytes) return false
      const name = (value as Blob & { name?: string }).name ?? ''
      const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : ''
      const extOk = extensions.includes(ext)
      if (value.type === '') return extOk
      if (mimeByExtension) return extOk && mimeByExtension[ext] === value.type
      return mimes.includes(value.type) && (name === '' || extOk)
    })
    .meta({ type: 'string', format: 'binary', description })
}
