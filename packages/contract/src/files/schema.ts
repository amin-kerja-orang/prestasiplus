import { z } from '../zod'
import { IdSchema } from '../common/ids'

/**
 * File upload wire contract (BE-04). Mock sources: `PICTURE_TYPES` / `PICTURE_MAX_KB` /
 * validator copy in `src/modules/m01-authentication/mock/handlers/auth-account.ts`, and
 * `MAX_PHOTO_BYTES` / `MSG_PHOTO_TYPE` in `src/modules/m28-bijak-spm/lib/photo-store.ts`.
 *
 * The three routes are new (the mock stores a data URL / an in-memory blob). A type or size
 * refusal is 422 VALIDATION_ERROR with `fields.file`. The validator copy is the mock's with the
 * attribute name `file` (BE-06 keeps `profilePicture` for `POST /me/picture`).
 */

export const FILE_PURPOSES = ['avatar', 'bijak_photo', 'question_image', 'cms_image'] as const
export const FilePurposeSchema = z.enum(FILE_PURPOSES).meta({ id: 'FilePurpose' })
export type FilePurpose = z.infer<typeof FilePurposeSchema>

export const FILE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type FileMime = (typeof FILE_MIMES)[number]

const AVATAR_LIKE = {
  mimes: ['image/jpeg', 'image/png', 'image/webp'] as readonly FileMime[],
  maxBytes: 2048 * 1024,
  typeMessage: 'The file field must be a file of type: jpeg, png, webp.',
  sizeMessage: 'The file field must not be greater than 2048 kilobytes.',
}

/** Per-purpose limits of the public upload route (one table; the effective size is also capped by MAX_UPLOAD_MB). */
export const FILE_PURPOSE_RULES: Readonly<
  Record<FilePurpose, { mimes: readonly FileMime[]; maxBytes: number; typeMessage: string; sizeMessage: string }>
> = {
  avatar: AVATAR_LIKE,
  bijak_photo: {
    mimes: ['image/jpeg', 'image/png'],
    maxBytes: 5 * 1024 * 1024,
    typeMessage: 'Gambar mesti JPG atau PNG, maksimum 5 MB.',
    sizeMessage: 'Gambar mesti JPG atau PNG, maksimum 5 MB.',
  },
  // No source for these two (URS OQ-23): same as avatar until confirmed.
  question_image: AVATAR_LIKE,
  cms_image: AVATAR_LIKE,
}

export const FILE_MESSAGES = {
  required: 'The file field is required.',
  purposeInvalid: 'The selected purpose is invalid.',
} as const

export const UploadFileQuerySchema = z
  .strictObject({ purpose: FilePurposeSchema })
  .meta({ id: 'UploadFileQuery' })
export type UploadFileQuery = z.infer<typeof UploadFileQuerySchema>

/** `multipart/form-data` body: one `file` part. */
export const UploadFileMultipartSchema = z
  .object({ file: z.string().meta({ format: 'binary', description: 'The file bytes (one part named `file`).' }) })
  .meta({ id: 'UploadFileMultipartRequest' })

export const FileRefSchema = z
  .object({
    id: IdSchema.meta({ description: 'Opaque public token (random, 22 characters). It is the only id the API shows for a file; never parse it.' }),
    url: z.string().min(1).meta({ description: 'Relative URL of the download route, `/api/files/{id}`. Clients use this field and never build the URL.', example: '/api/files/Zk3Qx9vB2mLw7TnRa1YpUg' }),
    mime: z.enum(FILE_MIMES),
    size: z.number().int().min(1).meta({ description: 'Stored size in bytes (after metadata stripping).' }),
    purpose: FilePurposeSchema,
  })
  .meta({ id: 'FileRef' })
export type FileRef = z.infer<typeof FileRefSchema>
