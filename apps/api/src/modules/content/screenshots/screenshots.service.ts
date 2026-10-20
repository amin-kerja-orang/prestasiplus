import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  CONTENT_FLASH,
  CONTENT_MESSAGES,
  SCREENSHOT_EXTENSIONS,
  SCREENSHOT_MAX_BYTES,
  SCREENSHOT_MAX_FILES,
  SCREENSHOT_MIME_TYPES,
  contentFileRefused,
} from '@pp/contract'

import { AuditService } from '../../../common/audit/audit.service'
import { ApiError } from '../../../common/errors/api-error'
import type { AuthContext } from '../../../common/scope/auth-context'
import { toMytTimestamp } from '../../../common/time/myt'
import { idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { FilesService } from '../../files'
import { type Actor, auditBase, fileUrlOf, unpagedMeta, writeTx } from '../shared/content-support'
import { ScreenshotsRepository, type ScreenshotRow } from './screenshots.repository'

export const SCREENSHOT_AUDIT = { UPLOADED: 'content.screenshot.uploaded' } as const

/** One multipart file part, as multer hands it over. */
export interface UploadPart {
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

const TYPE_BY_EXTENSION: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
}
const EXT_OF_MIME: Readonly<Record<string, string>> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const NAME_MAX = 120

const extOf = (name: string): string => (name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '')

/** The contract's per-file check: size, and the declared type must be the type of the extension. */
export function acceptedPart(p: { originalname: string; mimetype: string; size: number }): boolean {
  const ext = extOf(p.originalname)
  if (p.size <= 0 || p.size > SCREENSHOT_MAX_BYTES || !(SCREENSHOT_EXTENSIONS as readonly string[]).includes(ext)) return false
  if (p.mimetype === '') return true
  return (SCREENSHOT_MIME_TYPES as readonly string[]).includes(p.mimetype) && TYPE_BY_EXTENSION[ext] === p.mimetype
}

/** Stored name: lower case, spaces to `-`, characters outside `a-z0-9._-` removed, leading dots stripped, at most 120. Empty when nothing is left of the stem. */
export function storedBaseName(original: string): string {
  const lower = original.toLowerCase()
  const dot = lower.lastIndexOf('.')
  const ext = dot > 0 ? lower.slice(dot + 1).replace(/[^a-z0-9]/g, '') : ''
  const stem = (dot > 0 ? lower.slice(0, dot) : lower).replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '').replace(/^\.+/, '')
  if (stem === '') return ''
  const tail = ext === '' ? '' : `.${ext}`
  return stem.slice(0, NAME_MAX - tail.length) + tail
}

/** Unique stored names in id order: a clash gets `-1`, `-2` before the extension; an empty name becomes `screenshot-<id>`. */
export function storedNames(rows: readonly { id: bigint; originalName: string; mime: string }[]): Map<bigint, string> {
  const taken = new Set<string>()
  const out = new Map<bigint, string>()
  for (const r of rows) {
    let name = storedBaseName(r.originalName)
    if (name === '') {
      const own = extOf(r.originalName.toLowerCase()).replace(/[^a-z0-9]/g, '')
      name = `screenshot-${r.id.toString()}.${own || EXT_OF_MIME[r.mime] || 'png'}`
    }
    const dot = name.lastIndexOf('.')
    const stem = dot > 0 ? name.slice(0, dot) : name
    const tail = dot > 0 ? name.slice(dot) : ''
    let candidate = name
    for (let n = 1; taken.has(candidate); n++) candidate = `${stem}-${String(n)}${tail}`
    taken.add(candidate)
    out.set(r.id, candidate)
  }
  return out
}

@Injectable()
export class ScreenshotsService {
  private readonly logger = new Logger(ScreenshotsService.name)

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ScreenshotsRepository) private readonly repo: ScreenshotsRepository,
    @Inject(FilesService) private readonly files: FilesService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private viewsOf(rows: readonly ScreenshotRow[]) {
    const names = storedNames(rows.map((r) => ({ id: r.id, originalName: r.originalName, mime: r.file.mime })))
    return new Map(
      rows.map((r) => [
        r.id,
        {
          id: idToString(r.id),
          fileName: names.get(r.id) as string,
          originalName: r.originalName,
          size: Number(r.file.sizeBytes),
          mimeType: r.file.mime,
          uploadedById: idToString(r.uploadedById),
          createdAt: toMytTimestamp(r.createdAt),
          url: fileUrlOf(r.file.publicId),
        },
      ]),
    )
  }

  /** Newest first, unpaged, with the total. */
  async list() {
    const rows = await this.repo.listAll()
    const views = this.viewsOf(rows)
    const data = [...rows].reverse().map((r) => views.get(r.id) as NonNullable<ReturnType<typeof views.get>>)
    return { data, meta: { ...unpagedMeta(data.length), total: data.length } }
  }

  /**
   * Stores each accepted image through BE-04 (`purpose=cms_screenshot`, so the type comes from the bytes and
   * the effective limits are BE-04's). A refused file is reported in `rejected` and never blocks the others;
   * when nothing is saved the answer is 422.
   */
  async upload(auth: AuthContext, who: Actor, parts: readonly UploadPart[]) {
    if (parts.length === 0) throw ApiError.of('VALIDATION_ERROR', { fields: { files: CONTENT_MESSAGES.fieldRequired } })
    if (parts.length > SCREENSHOT_MAX_FILES) throw ApiError.of('VALIDATION_ERROR', { fields: { files: CONTENT_MESSAGES.screenshotMaxFiles } })

    const savedIds: bigint[] = []
    const rejected: { name: string; reason: string }[] = []
    for (const part of parts) {
      const refuse = () => rejected.push({ name: part.originalname, reason: contentFileRefused(part.originalname) })
      if (!acceptedPart(part)) {
        refuse()
        continue
      }
      let ref
      try {
        ref = await this.files.upload(auth, 'cms_screenshot', { buffer: part.buffer }, { ip: who.ip, requestId: who.requestId })
      } catch (err) {
        if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
          refuse()
          continue
        }
        throw err
      }
      try {
        const id = await writeTx(this.prisma, async (tx) => {
          const fileId = await this.repo.screenshotFileId(ref.id)
          if (fileId === null) throw new Error('uploaded file row not found')
          const created = await this.repo.create(fileId, part.originalname.slice(0, 255), who.userId)
          await this.audit.record({ tx, ...auditBase(who, SCREENSHOT_AUDIT.UPLOADED), targetType: 'screenshot', targetId: idToString(created), details: { size: ref.size, mime: ref.mime } })
          return created
        })
        savedIds.push(id)
      } catch (err) {
        // Do not leave the stored object behind when the row could not be written.
        await this.files.remove(auth, ref.id, { ip: who.ip, requestId: who.requestId }).catch(() => this.logger.warn('Could not remove an orphan screenshot file'))
        throw err
      }
    }
    if (savedIds.length === 0) {
      throw ApiError.of('VALIDATION_ERROR', { message: CONTENT_MESSAGES.screenshotRefused, fields: { files: CONTENT_MESSAGES.screenshotRefused } })
    }
    const views = this.viewsOf(await this.repo.listAll())
    const saved = savedIds.map((id) => views.get(id) as NonNullable<ReturnType<typeof views.get>>)
    return { data: { saved, rejected }, status: CONTENT_FLASH.screenshots(saved.length) }
  }
}
