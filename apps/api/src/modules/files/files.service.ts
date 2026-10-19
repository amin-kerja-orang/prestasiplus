import { randomUUID, createHash } from 'node:crypto'

import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  FILE_MESSAGES,
  FILE_PURPOSE_RULES,
  FILE_PURPOSES,
  type FileMime,
  type FilePurpose,
  type FileRef,
  type RoleCode,
} from '@pp/contract'

import { AUDIT_ACTIONS } from '../../common/audit/audit-actions'
import { AuditService } from '../../common/audit/audit.service'
import { ApiError } from '../../common/errors/api-error'
import type { AuthContext } from '../../common/scope/auth-context'
import { idFromString, idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { EXTENSION_OF, inspectUpload, type DetectedMime } from './content-inspect'
import { FILE_STORAGE, type FileStorage } from './file-storage'
import { FilesConfig } from './files.config'

/** Purposes written only by other services (BE-37 intake); they have no public upload route. */
export const DERIVED_PURPOSES = ['intake_original', 'intake_page', 'intake_figure'] as const
export type DerivedPurpose = (typeof DERIVED_PURPOSES)[number]

const DERIVED_MIMES: Readonly<Record<DerivedPurpose, readonly DetectedMime[]>> = {
  intake_original: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  intake_page: ['image/webp', 'image/png', 'image/jpeg'],
  intake_figure: ['image/webp', 'image/png', 'image/jpeg'],
}

/** Who may upload each public purpose (active role). Working rule, listed under open questions. */
export const UPLOAD_ROLES: Readonly<Record<FilePurpose, readonly RoleCode[] | 'any'>> = {
  avatar: 'any',
  bijak_photo: ['student'],
  question_image: ['admin', 'teacher'],
  cms_image: ['admin'],
}

export function isFilePurpose(value: unknown): value is FilePurpose {
  return typeof value === 'string' && (FILE_PURPOSES as readonly string[]).includes(value)
}

export function mayUpload(purpose: FilePurpose, role: RoleCode): boolean {
  const allowed = UPLOAD_ROLES[purpose]
  return allowed === 'any' || allowed.includes(role)
}

function invalidFile(message: string): ApiError {
  return ApiError.of('VALIDATION_ERROR', { fields: { file: message } })
}

export interface UploadedBytes {
  buffer: Buffer
}

export interface CallerInfo {
  ip: string | null
  requestId: string | null
}

/** A stored file as other services see it. */
export interface StoredFile {
  id: string
  purpose: string
  mime: string
  size: number
}

export interface FileContent extends StoredFile {
  bytes: Buffer
}

/** The "must not be greater than" message for `purpose`, honouring a lower global ceiling. */
export function sizeMessageFor(purpose: FilePurpose, ceilingBytes: number): string {
  const rule = FILE_PURPOSE_RULES[purpose]
  if (ceilingBytes >= rule.maxBytes) return rule.sizeMessage
  return `The file field must not be greater than ${Math.floor(ceilingBytes / 1024)} kilobytes.`
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name)

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(FilesConfig) private readonly config: FilesConfig,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** `POST /files`. Role, type (from the bytes), size and the stored copy are all decided here. */
  async upload(auth: AuthContext, purpose: FilePurpose, file: UploadedBytes | undefined, who: CallerInfo): Promise<FileRef> {
    if (!mayUpload(purpose, auth.active.role)) throw ApiError.of('FORBIDDEN')
    if (!file || file.buffer.length === 0) throw invalidFile(FILE_MESSAGES.required)

    const rule = FILE_PURPOSE_RULES[purpose]
    const inspected = inspectUpload(file.buffer)
    if (!inspected || !(rule.mimes as readonly string[]).includes(inspected.mime)) throw invalidFile(rule.typeMessage)
    const ceiling = Math.min(rule.maxBytes, this.config.maxUploadBytes)
    if (file.buffer.length > ceiling) throw invalidFile(sizeMessageFor(purpose, this.config.maxUploadBytes))

    const stored = await this.persist({
      ownerUserId: auth.userId,
      purpose,
      mime: inspected.mime,
      bytes: inspected.bytes,
      isTest: auth.mode !== null,
    })
    await this.record(AUDIT_ACTIONS.FILE_UPLOADED, auth, stored, who)
    return {
      id: stored.id,
      url: `/api/files/${stored.id}`,
      mime: stored.mime as FileMime,
      size: stored.size,
      purpose,
    }
  }

  /**
   * Derived files for BE-37 (intake originals, page images, figure crops). No public route: callers
   * are services. The limit is `INTAKE_MAX_FILE_MB`; the type is still decided from the bytes.
   */
  async storeDerived(input: {
    ownerUserId: string | null
    purpose: DerivedPurpose
    bytes: Buffer
    isTest?: boolean
  }): Promise<StoredFile> {
    if (!(DERIVED_PURPOSES as readonly string[]).includes(input.purpose)) throw new RangeError('Unknown derived purpose')
    if (input.bytes.length === 0) throw invalidFile(FILE_MESSAGES.required)
    if (input.bytes.length > this.config.intakeMaxBytes) {
      throw invalidFile(`The file field must not be greater than ${Math.floor(this.config.intakeMaxBytes / 1024)} kilobytes.`)
    }
    const inspected = inspectUpload(input.bytes)
    if (!inspected || !DERIVED_MIMES[input.purpose].includes(inspected.mime)) {
      throw invalidFile('The file field must be a file of type: pdf, jpeg, png, webp.')
    }
    return this.persist({
      ownerUserId: input.ownerUserId,
      purpose: input.purpose,
      mime: inspected.mime,
      bytes: inspected.bytes,
      isTest: input.isTest ?? false,
    })
  }

  /** `GET /files/:id`. `auth` is null for an anonymous caller. Anything not visible is 404. */
  async read(idText: string, auth: AuthContext | null): Promise<FileContent> {
    const row = await this.find(idText)
    if (!row) throw this.denied(auth)
    if (!this.canRead(row.purpose, row.ownerUserId, auth)) throw this.denied(auth)
    const bytes = await this.storage.get(row.storageKey)
    if (!bytes) {
      // The row exists but the object is gone (volume restore, manual cleanup): report it, hide the key.
      this.logger.error(`File object missing for file ${idToString(row.id)}`)
      throw ApiError.of('NOT_FOUND')
    }
    return { id: idToString(row.id), purpose: row.purpose, mime: row.mime, size: Number(row.sizeBytes), bytes }
  }

  /** Bytes of a stored file for another service (no visibility check: the caller has done its own). */
  async readStored(idText: string): Promise<FileContent | null> {
    const row = await this.find(idText)
    if (!row) return null
    const bytes = await this.storage.get(row.storageKey)
    return bytes ? { id: idToString(row.id), purpose: row.purpose, mime: row.mime, size: Number(row.sizeBytes), bytes } : null
  }

  /** `DELETE /files/:id`: the owner only; someone else's file is 404. */
  async remove(auth: AuthContext, idText: string, who: CallerInfo): Promise<void> {
    const row = await this.find(idText)
    if (!row || row.ownerUserId === null || idToString(row.ownerUserId) !== auth.userId) throw ApiError.of('NOT_FOUND')
    await this.prisma.client.file.delete({ where: { id: row.id } })
    try {
      await this.storage.delete(row.storageKey)
    } catch {
      this.logger.error(`Could not remove the object of file ${idToString(row.id)}`)
    }
    await this.record(
      AUDIT_ACTIONS.FILE_DELETED,
      auth,
      { id: idToString(row.id), purpose: row.purpose, mime: row.mime, size: Number(row.sizeBytes) },
      who,
    )
  }

  // ---- internals -------------------------------------------------------------------------------

  /** 401 for an anonymous caller (sign in first), 404 otherwise (never reveals existence). */
  private denied(auth: AuthContext | null): ApiError {
    return auth ? ApiError.of('NOT_FOUND') : ApiError.of('UNAUTHORIZED')
  }

  private canRead(purpose: string, ownerUserId: bigint | null, auth: AuthContext | null): boolean {
    if (purpose === 'cms_image') return true // public (open question 1)
    if (!auth) return false
    if (purpose === 'avatar' || purpose === 'question_image') return true // any signed-in user
    const owner = ownerUserId !== null && idToString(ownerUserId) === auth.userId
    if (purpose === 'bijak_photo') return owner
    return owner || auth.active.role === 'admin' // derived intake files
  }

  private async find(idText: string) {
    let id: bigint
    try {
      id = idFromString(idText)
    } catch {
      return null
    }
    return this.prisma.client.file.findUnique({ where: { id } })
  }

  private async persist(input: {
    ownerUserId: string | null
    purpose: string
    mime: DetectedMime
    bytes: Buffer
    isTest: boolean
  }): Promise<StoredFile> {
    // The key is random and built from the purpose and the detected type only: the client's file name never reaches it.
    const storageKey = `${input.purpose.replace(/_/g, '-')}/${randomUUID()}.${EXTENSION_OF[input.mime]}`
    await this.storage.put(storageKey, input.bytes)
    try {
      const row = await this.prisma.client.file.create({
        data: {
          ownerUserId: input.ownerUserId === null ? null : idFromString(input.ownerUserId),
          purpose: input.purpose,
          mime: input.mime,
          sizeBytes: BigInt(input.bytes.length),
          sha256: createHash('sha256').update(input.bytes).digest('hex'),
          storageKey,
          isTest: input.isTest,
        },
      })
      return { id: idToString(row.id), purpose: row.purpose, mime: row.mime, size: input.bytes.length }
    } catch (err) {
      await this.storage.delete(storageKey).catch(() => undefined)
      throw err
    }
  }

  private async record(action: string, auth: AuthContext, file: StoredFile, who: CallerInfo): Promise<void> {
    try {
      await this.audit.record({
        action,
        actorUserId: auth.userId,
        actorRole: auth.active.role,
        scopeLevel: auth.active.scope.level,
        schoolId: auth.active.scope.schoolId ?? null,
        targetType: 'file',
        targetId: file.id,
        requestId: who.requestId,
        ip: who.ip,
        isTest: auth.mode !== null,
        details: { purpose: file.purpose, mime: file.mime, size: file.size },
      })
    } catch {
      this.logger.warn(`Audit write failed for ${action}`)
    }
  }
}
