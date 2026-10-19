import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import { ListMetaSchema } from '../common/envelope'
import { counter, uploadFile } from './common'

/**
 * M09 admin tools and public config: private screenshots (#41-#42) and the support contact
 * (`GET /config/support`, #43, public). Mock: `handlers/admin-tools.ts`, `handlers/support.ts`.
 */

export const SCREENSHOT_MAX_FILES = 20
export const SCREENSHOT_MAX_BYTES = 10 * 1024 * 1024
export const SCREENSHOT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'] as const
export const SCREENSHOT_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] as const
const SCREENSHOT_TYPE_BY_EXTENSION = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
} as const

/** A stored screenshot (#41, and `saved[]` of #42). */
export const ScreenshotFileSchema = z
  .strictObject({
    id: IdSchema,
    fileName: z.string().min(1).meta({ description: 'Stored name: lower case, spaces to "-", characters outside a-z0-9._- removed, at most 120 chars, a clash gets -1, -2.' }),
    originalName: z.string(),
    size: counter().meta({ description: 'Bytes.' }),
    mimeType: z.string().min(1),
    uploadedById: IdSchema,
    createdAt: TimestampSchema,
    url: z.string().min(1).meta({ description: 'Private storage URL (BE-04). The mock returns a `blob:mock/screenshots/{fileName}` placeholder.' }),
  })
  .meta({ id: 'ScreenshotFile' })

/** `meta` of #41: unpaged list meta plus the total. */
export const ScreenshotListMetaSchema = ListMetaSchema.extend({ total: counter() }).meta({ id: 'ScreenshotListMeta' })

export const ScreenshotListResponseSchema = z
  .object({ data: z.array(ScreenshotFileSchema), meta: ScreenshotListMetaSchema })
  .meta({ id: 'ScreenshotListResponse' })

const screenshotFile = uploadFile({
  maxBytes: SCREENSHOT_MAX_BYTES,
  mimes: SCREENSHOT_MIME_TYPES,
  extensions: SCREENSHOT_EXTENSIONS,
  mimeByExtension: SCREENSHOT_TYPE_BY_EXTENSION,
  description: 'JPG, PNG, GIF, WebP or BMP, at most 10 MB; the declared type and the extension must agree.',
})

/**
 * Body of `POST /admin/screenshots` (#42), `multipart/form-data`: 1 to 20 repeated `files[]` parts
 * (file storage: BE-04, `purpose=cms_image`). A refused file does not block the others (see
 * `ScreenshotUploadResult.rejected`); 422 only when none is saved.
 */
export const ScreenshotUploadRequestSchema = z
  .object({ files: z.array(screenshotFile).min(1).max(SCREENSHOT_MAX_FILES) })
  .meta({ id: 'ScreenshotUploadRequest' })

/** `data` of #42 (201). */
export const ScreenshotUploadResultSchema = z
  .strictObject({
    saved: z.array(ScreenshotFileSchema),
    rejected: z.array(z.strictObject({ name: z.string(), reason: z.string() })),
  })
  .meta({ id: 'ScreenshotUploadResult' })

/** `data` of `GET /config/support` (#43, public): the contact shown in the help box. */
export const ContentSupportConfigSchema = z
  .strictObject({ email: z.string().min(1), whatsappNumber: z.string().min(1) })
  .meta({ id: 'ContentSupportConfig' })
export type ContentSupportConfig = z.infer<typeof ContentSupportConfigSchema>
