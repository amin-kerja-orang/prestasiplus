import { createHash, randomBytes, randomUUID } from 'node:crypto'

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

import { AuditService } from '../../common/audit/audit.service'
import { ApiError } from '../../common/errors/api-error'
import type { AuthContext } from '../../common/scope/auth-context'
import { ScopeFilter } from '../../common/scope/scope-filter'
import { idFromString, idToString } from '../../db/ids'
import type { File as FileRow } from '../../db/generated/client'
import { PrismaService } from '../../db/prisma.service'
import { EXTENSION_OF, inspectUpload, type DetectedMime } from './content-inspect'
import { FILE_STORAGE, type FileStorage } from './file-storage'
import { FilesConfig } from './files.config'

/** Action names written to `audit_events.action` by the files module. */
export const FILE_AUDIT_ACTIONS = { UPLOADED: 'file.uploaded', DELETED: 'file.deleted' } as const

/** Purposes written only by other services (BE-37 intake); they have no public upload route. */
export const DERIVED_PURPOSES = ['intake_original', 'intake_page', 'intake_figure'] as const
export type DerivedPurpose = (typeof DERIVED_PURPOSES)[number]

const DERIVED_MIMES: Readonly<Record<DerivedPurpose, readonly DetectedMime[]>> = {
  intake_original: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  intake_page: ['image/webp', 'image/png', 'image/jpeg'],
  intake_figure: ['image/webp', 'image/png', 'image/jpeg'],
}

/** Who may upload each public purpose (active role). The mock has no upload route; least privilege. */
export const UPLOAD_ROLES: Readonly<Record<FilePurpose, readonly RoleCode[] | 'any'>> = {
  avatar: 'any',
  bijak_photo: ['student'],
  question_image: ['admin', 'teacher'],
  cms_image: ['admin'],
  audio_kbat: ['admin'],
  cms_screenshot: ['admin'],
  // BE-19: written only by POST /timeline, never through POST /files (403 for every role).
  timeline_photo: [],
}

export function isFilePurpose(value: unknown): value is FilePurpose {
  return typeof value === 'string' && (FILE_PURPOSES as readonly string[]).includes(value)
}

export function mayUpload(purpose: FilePurpose, role: RoleCode): boolean {
  const allowed = UPLOAD_ROLES[purpose]
  return allowed === 'any' || allowed.includes(role)
}

/** A public token: 16 random bytes as base64url (22 characters). */
const PUBLIC_TOKEN = /^[A-Za-z0-9_-]{22}$/

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

/** A stored file as other services see it. `id` is the internal key (use it in foreign keys); `publicId` is the API token. */
export interface StoredFile {
  id: string
  publicId: string
  purpose: string
  mime: string
  size: number
}

export interface FileContent extends StoredFile {
  bytes: Buffer
}

/** The effective byte limit of `purpose`: its own rule, capped by the global ceiling. */
/** Purposes whose own rule is not lowered by MAX_UPLOAD_MB (audio sets are 20 MB, the global default is 10). */
const OWN_CEILING: readonly FilePurpose[] = ['audio_kbat']

export function limitFor(purpose: FilePurpose, maxUploadBytes: number): number {
  if (OWN_CEILING.includes(purpose)) return FILE_PURPOSE_RULES[purpose].maxBytes
  return Math.min(FILE_PURPOSE_RULES[purpose].maxBytes, maxUploadBytes)
}

/** The "must not be greater than" message for `purpose`, honouring a lower global ceiling. */
export function sizeMessageFor(purpose: FilePurpose, maxUploadBytes: number): string {
  const rule = FILE_PURPOSE_RULES[purpose]
  if (maxUploadBytes >= rule.maxBytes || OWN_CEILING.includes(purpose)) return rule.sizeMessage
  return `The file field must not be greater than ${Math.floor(maxUploadBytes / 1024)} kilobytes.`
}

// ---- who may read which file -------------------------------------------------------------------

/**
 * Read visibility is decided per purpose AND ownership, and fails closed: a purpose with no rule is
 * treated like a derived file (owner or admin). A refused read is always 404 (never 403), so there is
 * no oracle for which ids exist. To change one purpose, change its entry here and its test.
 */
interface ReadContext {
  row: FileRow
  auth: AuthContext | null
  owns: boolean
  /** Loads the owner's school (id, state, district) for scope checks; null when the owner has none. */
  ownerSchool(): Promise<{ schoolId: bigint; school: { state: string | null; district: string | null } } | null>
}

type ReadRule = (c: ReadContext) => boolean | Promise<boolean>

const isRole = (c: ReadContext, ...roles: RoleCode[]): boolean => c.auth !== null && roles.includes(c.auth.active.role)

const READ_RULES: Readonly<Record<string, ReadRule>> = {
  // Working photos of a pupil: the owner only.
  bijak_photo: (c) => c.owns,
  // Authoring material: staff only. Pupils see question images through published questions (a later card).
  question_image: (c) => isRole(c, 'admin', 'teacher'),
  // Interim (F2): public, reachable only through the opaque token, until BE-24 gates it on publish state.
  cms_image: () => true,
  // BE-24: section audio of Audio KBAT sets. Admin only, fail closed: students never read it through /files, they
  // reach it only through the stream route of an approved set (`FilesService.readManaged`, which does its own check).
  audio_kbat: (c) => isRole(c, 'admin'),
  // BE-24: private admin screenshots.
  cms_screenshot: (c) => isRole(c, 'admin'),
  // BE-19: photo of a pupil timeline post (OQ-5). Any signed-in user (a post is shown on the pupil's profile to signed-in
  // viewers), never anonymous (fail closed). A file written under Mod Pelajar (is_test) is for its owner and admin only.
  timeline_photo: (c) => c.auth !== null && (!c.row.isTest || c.owns || isRole(c, 'admin')),
  // Personal data of a minor: the owner, admin, and staff whose scope covers the owner.
  // Classmates and other users in the same school are NOT entitled here (leaderboards and class lists are the
  // user cards' job). A teacher of the owner's class is entitled once class membership exists.
  avatar: async (c) => {
    if (c.owns || isRole(c, 'admin')) return true
    if (c.auth && isRole(c, 'school_admin', 'ppd_officer')) {
      const owner = await c.ownerSchool()
      if (!owner) return false
      try {
        return new ScopeFilter(c.auth).isInScope(owner, { schoolColumn: 'schoolId', schoolRelation: 'school' })
      } catch {
        return false // a scope shape this check cannot express fails closed
      }
    }
    // TODO(BE-17): allow a teacher whose class contains the owner. Until class membership exists a teacher
    // gets 404 for other users' avatars (fail closed). Dependency: BE-17.
    return false
  },
}

/** Everything else (derived intake files, unknown purposes): the owner or an admin. */
const DEFAULT_READ_RULE: ReadRule = (c) => c.owns || isRole(c, 'admin')

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name)

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(FilesConfig) private readonly config: FilesConfig,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** `POST /files`. Role, size, type (from the bytes) and the stored copy are all decided here. */
  async upload(auth: AuthContext, purpose: FilePurpose, file: UploadedBytes | undefined, who: CallerInfo): Promise<FileRef> {
    if (!mayUpload(purpose, auth.active.role)) throw ApiError.of('FORBIDDEN')
    if (!file || file.buffer.length === 0) throw invalidFile(FILE_MESSAGES.required)

    const rule = FILE_PURPOSE_RULES[purpose]
    // Size first: nothing is parsed or hashed for a body over the limit (the multer limit already stops the read).
    if (file.buffer.length > limitFor(purpose, this.config.maxUploadBytes)) {
      throw invalidFile(sizeMessageFor(purpose, this.config.maxUploadBytes))
    }
    const inspected = inspectUpload(file.buffer)
    if (!inspected || !(rule.mimes as readonly string[]).includes(inspected.mime)) throw invalidFile(rule.typeMessage)

    const stored = await this.persist({
      ownerUserId: auth.userId,
      purpose,
      mime: inspected.mime,
      bytes: inspected.bytes,
      isTest: auth.mode !== null,
    })
    await this.record(FILE_AUDIT_ACTIONS.UPLOADED, auth, stored, who)
    return {
      id: stored.publicId,
      url: `/api/files/${stored.publicId}`,
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

  /**
   * A service-side upload of a public purpose (BE-24 audio sets): the same size and type rules as `upload`
   * (type from the bytes, `FILE_PURPOSE_RULES`), but no role check and no route: the caller did its own
   * authorisation. A refusal is the same 422 `fields.file`.
   */
  async storeManaged(input: { ownerUserId: string; purpose: FilePurpose; bytes: Buffer; isTest?: boolean }): Promise<StoredFile> {
    const rule = FILE_PURPOSE_RULES[input.purpose]
    if (input.bytes.length === 0) throw invalidFile(FILE_MESSAGES.required)
    if (input.bytes.length > limitFor(input.purpose, this.config.maxUploadBytes)) {
      throw invalidFile(sizeMessageFor(input.purpose, this.config.maxUploadBytes))
    }
    const inspected = inspectUpload(input.bytes)
    if (!inspected || !(rule.mimes as readonly string[]).includes(inspected.mime)) throw invalidFile(rule.typeMessage)
    return this.persist({ ownerUserId: input.ownerUserId, purpose: input.purpose, mime: inspected.mime, bytes: inspected.bytes, isTest: input.isTest ?? false })
  }

  /**
   * The bytes of a file of exactly `purpose`, by public token, for a service that already decided the caller
   * may read it (the Audio KBAT stream route). No visibility rule runs; a token of another purpose is null.
   */
  async readManaged(token: string, purpose: FilePurpose): Promise<FileContent | null> {
    const row = await this.findByToken(token)
    if (!row || row.purpose !== purpose) return null
    const bytes = await this.storage.get(row.storageKey)
    if (!bytes) {
      this.logger.error(`File object missing for file ${idToString(row.id)}`)
      return null
    }
    return { ...this.summary(row), bytes }
  }

  /** Removes a file row and its object (clean-up after a failed write). Never throws. */
  async discard(token: string, purpose: FilePurpose): Promise<void> {
    try {
      const row = await this.findByToken(token)
      if (!row || row.purpose !== purpose) return
      await this.prisma.client.file.delete({ where: { id: row.id } })
      await this.storage.delete(row.storageKey)
    } catch {
      this.logger.warn('Could not discard a managed file')
    }
  }

  /** `GET /files/:token`. `auth` is null for an anonymous caller. Anything not visible is 404 (401 when anonymous). */
  async read(token: string, auth: AuthContext | null): Promise<FileContent> {
    const row = await this.findByToken(token)
    if (!row || !(await this.canRead(row, auth))) throw this.denied(auth)
    const bytes = await this.storage.get(row.storageKey)
    if (!bytes) {
      // The row exists but the object is gone (volume restore, manual cleanup): report it, hide the key.
      this.logger.error(`File object missing for file ${idToString(row.id)}`)
      throw ApiError.of('NOT_FOUND')
    }
    return { ...this.summary(row), bytes }
  }

  /** Bytes of a stored file for another service, by internal id (no visibility check: the caller did its own). */
  async readStored(idText: string): Promise<FileContent | null> {
    let id: bigint
    try {
      id = idFromString(idText)
    } catch {
      return null
    }
    const row = await this.prisma.client.file.findUnique({ where: { id } })
    if (!row) return null
    const bytes = await this.storage.get(row.storageKey)
    return bytes ? { ...this.summary(row), bytes } : null
  }

  /** Purpose and owner of a stored file by internal id: reads the row only, never the object bytes. */
  async metaOf(idText: string): Promise<{ purpose: string; ownerUserId: string | null } | null> {
    let id: bigint
    try {
      id = idFromString(idText)
    } catch {
      return null
    }
    const row = await this.prisma.client.file.findUnique({ where: { id }, select: { purpose: true, ownerUserId: true } })
    return row ? { purpose: row.purpose, ownerUserId: row.ownerUserId === null ? null : idToString(row.ownerUserId) } : null
  }

  /** `DELETE /files/:token`: the owner only; someone else's file is 404. */
  async remove(auth: AuthContext, token: string, who: CallerInfo): Promise<void> {
    const row = await this.findByToken(token)
    if (!row || row.ownerUserId === null || idToString(row.ownerUserId) !== auth.userId) throw ApiError.of('NOT_FOUND')
    await this.prisma.client.file.delete({ where: { id: row.id } })
    try {
      await this.storage.delete(row.storageKey)
    } catch {
      this.logger.error(`Could not remove the object of file ${idToString(row.id)}`)
    }
    await this.record(FILE_AUDIT_ACTIONS.DELETED, auth, this.summary(row), who)
  }

  // ---- internals -------------------------------------------------------------------------------

  /** 401 for an anonymous caller (sign in first), 404 otherwise (never reveals existence). */
  private denied(auth: AuthContext | null): ApiError {
    return auth ? ApiError.of('NOT_FOUND') : ApiError.of('UNAUTHORIZED')
  }

  private async canRead(row: FileRow, auth: AuthContext | null): Promise<boolean> {
    const rule = READ_RULES[row.purpose] ?? DEFAULT_READ_RULE
    // Every purpose except the public one needs a session; a rule never sees an anonymous caller otherwise.
    if (!auth && row.purpose !== 'cms_image') return false
    const owns = auth !== null && row.ownerUserId !== null && idToString(row.ownerUserId) === auth.userId
    const ownerSchool = async () => {
      if (row.ownerUserId === null) return null
      const owner = await this.prisma.client.user.findUnique({
        where: { id: row.ownerUserId },
        select: { schoolId: true, school: { select: { state: true, district: true } } },
      })
      return owner?.schoolId && owner.school ? { schoolId: owner.schoolId, school: owner.school } : null
    }
    return rule({ row, auth, owns, ownerSchool })
  }

  private summary(row: FileRow): StoredFile {
    return { id: idToString(row.id), publicId: row.publicId, purpose: row.purpose, mime: row.mime, size: Number(row.sizeBytes) }
  }

  private async findByToken(token: string): Promise<FileRow | null> {
    if (!PUBLIC_TOKEN.test(token)) return null
    return this.prisma.client.file.findUnique({ where: { publicId: token } })
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
          publicId: randomBytes(16).toString('base64url'),
          ownerUserId: input.ownerUserId === null ? null : idFromString(input.ownerUserId),
          purpose: input.purpose,
          mime: input.mime,
          sizeBytes: BigInt(input.bytes.length),
          sha256: createHash('sha256').update(input.bytes).digest('hex'),
          storageKey,
          isTest: input.isTest,
        },
      })
      return this.summary(row)
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
