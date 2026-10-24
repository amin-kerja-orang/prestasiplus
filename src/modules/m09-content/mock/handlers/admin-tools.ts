/**
 * SRS M09 v1.6 §7 #41 `GET /api/admin/screenshots` and #42 `POST /api/admin/screenshots` (S14, the
 * private screenshot upload tool; multipart `files[]`). Admin only.
 *
 * Each file is checked in the mock (BR-M09-30): JPG, PNG, GIF, WebP or BMP, at most 10 MB. A refused
 * file is reported in `rejected` while the others are saved; when no file is saved the request
 * answers 422. The file bytes are not persisted: a file uploaded in this browser session is served
 * from an object URL (so S14 shows the picked image as a thumbnail, UAT A-SY05); a file with no
 * object URL (after a reload) returns the `blob:mock/screenshots/{fileName}` placeholder URL, which
 * the page draws as an image glyph (private files, nothing else in the app lists them).
 */

import { created, route, unpaged, validationError, type RouteDef } from '@/mock/define'

import { M09Error, supportRepo } from '../repository'
import { previewUrlOf, pruneTo, rememberPreview } from '../repository/screenshot-previews'
import type { ScreenshotRow } from '../types'
import { ADMIN_FLASH, adminOnly, bodyOf, fileRefused, filesOf } from './admin-common'
import { FIELD_REQUIRED, requireViewer } from './common'

const SCREENSHOT_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']
const EXT_TYPES: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
}
/** At most 20 files per request and 10 MB per file (BR-M09-30; the 20 is INFERRED hardening). */
export const MAX_FILES = 20
export const MAX_BYTES = 10 * 1024 * 1024
/** SRS §8.2 "Screenshot file type/size" (PROPOSED COPY). */
export const SCREENSHOT_REFUSED = 'Fail mesti JPG, PNG, GIF, WebP atau BMP, maksimum 10 MB.'

/** `ScreenshotFile` (§6.8) plus the preview URL (placeholder when the bytes are gone). */
const shape = (s: ScreenshotRow) => ({
  id: s.id,
  fileName: s.fileName,
  originalName: s.originalName,
  size: s.size,
  mimeType: s.mimeType,
  uploadedById: s.uploadedById,
  createdAt: s.createdAt,
  url: previewUrlOf(s) ?? `blob:mock/screenshots/${s.fileName}`,
})

/**
 * The type of an upload when the declared MIME and the extension agree (SEC L-1): both must be
 * an allowed image type and name the same one. A file with no declared type is judged by its
 * extension alone. Returns `''` when refused.
 */
function mimeOf(name: string, type: string): string {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
  const byExt = name.includes('.') ? (EXT_TYPES[ext] ?? '') : ''
  if (type === '') return byExt
  return type === byExt ? type : ''
}

export const adminToolRoutes: RouteDef[] = [
  route('GET', '/api/admin/screenshots', [adminOnly], () => {
    const stored = supportRepo.screenshots()
    pruneTo(stored) // drops previews of rows that no longer exist (e.g. after a mock reset)
    const rows = stored.map(shape)
    return unpaged(rows, { total: supportRepo.screenshotCount() })
  }),

  route('POST', '/api/admin/screenshots', [adminOnly], (req) => {
    const body = bodyOf(req.body)
    const files = filesOf(body['files[]'], body.files, body.file)
    if (files.length === 0) return validationError({ files: FIELD_REQUIRED })
    if (files.length > MAX_FILES)
      return validationError({ files: `Maksimum ${String(MAX_FILES)} fail setiap muat naik.` })

    const uploadedById = requireViewer(req).id
    const saved: ReturnType<typeof shape>[] = []
    const rejected: { name: string; reason: string }[] = []
    for (const file of files) {
      const mime = mimeOf(file.name, file.type)
      if (!SCREENSHOT_TYPES.includes(mime) || file.size > MAX_BYTES) {
        rejected.push({ name: file.name, reason: fileRefused(file.name) })
        continue
      }
      try {
        const row = supportRepo.addScreenshot(uploadedById, {
          name: file.name,
          size: file.size,
          mime,
        })
        if (file.blob) rememberPreview(row, file.blob)
        saved.push(shape(row))
      } catch (error) {
        if (!(error instanceof M09Error) || error.code !== 'VALIDATION_ERROR') throw error
        rejected.push({ name: file.name, reason: fileRefused(file.name) })
      }
    }
    if (saved.length === 0)
      return validationError({ files: SCREENSHOT_REFUSED }, SCREENSHOT_REFUSED)
    return created({ saved, rejected }, { status: ADMIN_FLASH.screenshots(saved.length) })
  }),
]
