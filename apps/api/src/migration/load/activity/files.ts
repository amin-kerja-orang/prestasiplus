/**
 * Content files of `migrate:activity` (BE-29 AC9, BE-MIG-09).
 *
 * Nobody reads the .cloud storage from here. The operator exports the storage files once, read-only, into a local
 * directory OUTSIDE the repository (next to the AM-10 dump) and passes it as `--files-dir`. The directory must hold a
 * `SHA256SUMS` manifest (sha256sum format, paths relative to the directory). A file is migrated only when
 *   1. its path is a plain relative path (no `..`, no absolute path, no NUL, no backslash),
 *   2. no component of it is a symbolic link and it is a regular file inside the directory,
 *   3. it is listed in the manifest and its computed SHA-256 equals the listed one,
 *   4. it passes the same size cap and content check (magic bytes, sanitising) an upload of that purpose passes,
 *   5. it is copied to the `FileStorage` (BE-04) and a `files` row exists.
 * Only then does the migrated row get the file id. Any failure is an `INVALID_VALUE` reject on the file column (the
 * row is not loaded, so no dangling reference exists) and is counted by cause. Nothing in this module logs a path,
 * a file name or a byte: causes are fixed words.
 *
 * Idempotent: the stored object is keyed by the SHA-256 of the source file and the legacy id of the row, and the
 * `files` row by `(legacy_source, legacy_id)`. A re-run finds both and copies nothing.
 * A dry-run verifies everything and writes nothing (no object, no `files` row).
 */
import { createHash, randomBytes } from 'node:crypto'
import { constants } from 'node:fs'
import { access, lstat, open, realpath, stat } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'

import { FILE_PURPOSE_RULES, type FilePurpose } from '@pp/contract'
import { EXTENSION_OF, inspectUpload, sniffMime } from '../../../modules/files/content-inspect'
import { LocalDiskStorage } from '../../../modules/files/local-disk.storage'
import type { FileStorage } from '../../../modules/files/file-storage'
import { ApplyGuardError } from '../../kit/apply-guard'
import type { LegacySource, RunMode } from '../../kit/types'
import type { BatchContext } from '../../kit/runner'
import { defaultOutputRoots } from '../../profile/render'

export const MANIFEST_NAME = 'SHA256SUMS'
const MAX_MANIFEST_BYTES = 32 * 1024 * 1024
const MAX_PATH_CHARS = 500
const MB = 1024 * 1024
const NO_FOLLOW = constants.O_NOFOLLOW ?? 0

/** Why a file was not migrated. Fixed words only: they are counted, never printed with a path. */
export type FileCause = 'path' | 'unlisted' | 'missing' | 'unsafe' | 'size' | 'checksum' | 'type'

export type FileOutcome =
  | { ok: true; outcome: 'copied' | 'present'; fileId: string | null }
  | { ok: false; cause: FileCause }

export interface FileRequest {
  /** v2 table of the migrated row, e.g. `banners` (part of the key and of the `files` legacy id). */
  table: string
  /** Staged column that held the path, e.g. `image_path`. */
  column: string
  /** Surrogate primary key of the source row (digits). */
  legacyId: string
  /** The staged value. Never logged. */
  rawPath: string
  purpose: FilePurpose
}

const isInside = (child: string, parent: string): boolean => {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

const realOf = async (p: string): Promise<string> => realpath(p).catch(() => resolve(p))

/**
 * A staged path as a normalised relative path, or null. Refuses an empty value, NUL and other control characters, a
 * backslash, an absolute path (POSIX or drive letter), and any empty, `.` or `..` segment after a leading `./`.
 */
export function normaliseRelativePath(raw: string): string | null {
  const t = raw.trim()
  if (t === '' || t.length > MAX_PATH_CHARS) return null
  if (/[\u0000-\u001f\u007f\\]/.test(t)) return null
  if (t.startsWith('/') || /^[A-Za-z]:/.test(t)) return null
  let p = t
  while (p.startsWith('./')) p = p.slice(2)
  const segments = p.split('/')
  if (segments.some((s) => s === '' || s === '.' || s === '..')) return null
  return segments.join('/')
}

/** `<64 hex>  <path>` or `<64 hex> *<path>` per line. Returns path -> lower-case digest, and the digest of the manifest itself. */
export function parseManifest(bytes: Buffer): Map<string, string> {
  const out = new Map<string, string>()
  const lines = bytes.toString('utf8').split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string
    if (line.trim() === '' || line.startsWith('#')) continue
    const m = /^([0-9a-fA-F]{64}) [ *](.+)$/.exec(line)
    if (!m) throw new ApplyGuardError(`${MANIFEST_NAME} line ${i + 1} is not in sha256sum format ("<sha256>  <path>").`)
    const path = normaliseRelativePath(m[2] as string)
    if (path === null) continue // an unusable entry can never match a row path
    const digest = (m[1] as string).toLowerCase()
    const seen = out.get(path)
    if (seen !== undefined && seen !== digest) {
      throw new ApplyGuardError(`${MANIFEST_NAME} lists one path twice with different checksums (line ${i + 1}).`)
    }
    out.set(path, digest)
  }
  if (out.size === 0) throw new ApplyGuardError(`${MANIFEST_NAME} lists no file.`)
  return out
}

export interface OpenFilesOptions {
  /** `--files-dir` as given. */
  dir: string
  env: Readonly<Record<string, string | undefined>>
  mode: RunMode
  source: LegacySource
  /** Folders that make up "the repository" (default: the working directory and the repository root). */
  repoRoots?: readonly string[]
  /** Test seam: the object store. Default: `LocalDiskStorage(FILE_STORAGE_DIR)`. */
  storage?: FileStorage
}

/** The checked export directory, its manifest and the object store. Created once per run by `openMigrationFiles`. */
export class MigrationFiles {
  /** SHA-256 of the manifest file: part of the run's input hash, so a dry-run does not authorise an apply on other files. */
  readonly manifestHash: string

  constructor(
    private readonly dir: string,
    private readonly manifest: ReadonlyMap<string, string>,
    manifestHash: string,
    private readonly storage: FileStorage | null,
    private readonly env: Readonly<Record<string, string | undefined>>,
    private readonly mode: RunMode,
    private readonly source: LegacySource,
  ) {
    this.manifestHash = manifestHash
  }

  /** The size cap an upload of `purpose` has: its own rule, lowered by `MAX_UPLOAD_MB` (BE-04 `FilesConfig`). */
  private capOf(purpose: FilePurpose): number {
    const own = FILE_PURPOSE_RULES[purpose].maxBytes
    if (purpose === 'audio_kbat') return own
    const n = Number(this.env.MAX_UPLOAD_MB)
    const ceiling = this.env.MAX_UPLOAD_MB !== undefined && this.env.MAX_UPLOAD_MB !== '' && Number.isFinite(n) && n > 0 ? n * MB : 10 * MB
    return Math.min(own, ceiling)
  }

  /** Reads the file below the directory without following a link. A cause when it cannot be used. */
  private async read(rel: string, cap: number): Promise<{ bytes: Buffer } | { cause: FileCause }> {
    let current = this.dir
    const segments = rel.split('/')
    for (let i = 0; i < segments.length; i++) {
      current = join(current, segments[i] as string)
      let st
      try {
        st = await lstat(current)
      } catch (err) {
        return { cause: (err as { code?: string }).code === 'ENOENT' ? 'missing' : 'unsafe' }
      }
      if (st.isSymbolicLink()) return { cause: 'unsafe' }
      if (i < segments.length - 1 ? !st.isDirectory() : !st.isFile()) return { cause: 'unsafe' }
    }
    // O_NOFOLLOW covers only the last component, so a directory swapped for a link after the checks above is caught here:
    // the real path of what was opened must be inside the directory and be the very file (device + inode) we hold open.
    let handle
    try {
      handle = await open(current, constants.O_RDONLY | NO_FOLLOW)
    } catch (err) {
      return { cause: (err as { code?: string }).code === 'ENOENT' ? 'missing' : 'unsafe' }
    }
    try {
      const st = await handle.stat()
      if (!st.isFile()) return { cause: 'unsafe' }
      const real = await realpath(current).catch(() => null)
      if (real === null || !isInside(real, this.dir)) return { cause: 'unsafe' }
      const at = await lstat(real).catch(() => null)
      if (at === null || !at.isFile() || at.dev !== st.dev || at.ino !== st.ino) return { cause: 'unsafe' }
      if (st.size > cap || st.size === 0) return { cause: 'size' }
      const bytes = await handle.readFile()
      if (bytes.length > cap) return { cause: 'size' }
      return { bytes }
    } finally {
      await handle.close()
    }
  }

  /**
   * Verifies one file and, in apply mode, copies it and writes its `files` row on `db` (the batch transaction), returning
   * the id to put on the migrated row. In a dry-run the id is null and nothing is written. A content problem returns a
   * cause; a database or storage failure throws (the batch rolls back).
   */
  async migrate(batch: Pick<BatchContext, 'db' | 'onRollback' | 'afterCommit'>, req: FileRequest): Promise<FileOutcome> {
    if (!/^[0-9]{1,18}$/.test(req.legacyId)) throw new RangeError('A file request needs the surrogate id of the source row.')
    const rel = normaliseRelativePath(req.rawPath)
    if (rel === null) return { ok: false, cause: 'path' }
    const listed = this.manifest.get(rel)
    if (listed === undefined) return { ok: false, cause: 'unlisted' }
    const rule = FILE_PURPOSE_RULES[req.purpose]
    const read = await this.read(rel, this.capOf(req.purpose))
    if ('cause' in read) return { ok: false, cause: read.cause }
    const sourceSha = createHash('sha256').update(read.bytes).digest('hex')
    if (sourceSha !== listed) return { ok: false, cause: 'checksum' }
    const mime = sniffMime(read.bytes)
    if (mime === null || !(rule.mimes as readonly string[]).includes(mime)) return { ok: false, cause: 'type' }

    const db = batch.db
    const legacy = `${req.table}.${req.column}:${req.legacyId}`
    const key = `${req.purpose.replace(/_/g, '-')}/${sourceSha}-${req.table.replace(/_/g, '-')}-${req.legacyId}.${EXTENSION_OF[mime]}`
    const existing = await db.query<{ id: string; storage_key: string }>(
      `SELECT id::text AS id, storage_key FROM files WHERE legacy_source = $1 AND legacy_id = $2`,
      [this.source, legacy],
    )
    const row = existing.rows[0]
    const present = row !== undefined && row.storage_key === key && this.storage !== null && (await this.storage.exists(key))
    if (present) return { ok: true, outcome: 'present', fileId: this.mode === 'apply' ? row.id : null }

    // The content check (and sanitising) that an upload goes through; the stored bytes are the sanitised ones.
    const inspected = inspectUpload(read.bytes)
    if (!inspected || inspected.mime !== mime) return { ok: false, cause: 'type' }
    if (this.mode !== 'apply') return { ok: true, outcome: 'copied', fileId: null }

    if (this.storage === null) throw new ApplyGuardError('FILE_STORAGE_DIR is needed to copy files.')
    // Copy first, then the row. The object has no owner until the batch commits, so it is removed again if the batch
    // fails for any reason (a rollback leaves no object behind); a replaced object (the key changed) is removed after commit.
    const storage = this.storage
    await storage.put(key, inspected.bytes)
    batch.onRollback(() => storage.delete(key))
    if (row !== undefined && row.storage_key !== key) {
      const old = row.storage_key
      batch.afterCommit(() => storage.delete(old))
    }
    const saved = await db.query<{ id: string }>(
      `INSERT INTO files (public_id, owner_user_id, purpose, mime, size_bytes, sha256, storage_key, is_test, legacy_source, legacy_id)
       VALUES ($1, NULL, $2, $3, $4::bigint, $5, $6, false, $7, $8)
       ON CONFLICT (legacy_source, legacy_id) DO UPDATE
         SET purpose = EXCLUDED.purpose, mime = EXCLUDED.mime, size_bytes = EXCLUDED.size_bytes,
             sha256 = EXCLUDED.sha256, storage_key = EXCLUDED.storage_key
       RETURNING id::text AS id`,
      [
        randomBytes(16).toString('base64url'),
        req.purpose,
        inspected.mime,
        String(inspected.bytes.length),
        createHash('sha256').update(inspected.bytes).digest('hex'),
        key,
        this.source,
        legacy,
      ],
    )
    return { ok: true, outcome: 'copied', fileId: (saved.rows[0] as { id: string }).id }
  }
}

/**
 * Checks the `--files-dir` and opens it. Throws `ApplyGuardError` (nothing is read from the rows yet) when the
 * directory is missing, not readable, inside the repository (or holds it), or has no valid `SHA256SUMS`, and, for an
 * apply, when `FILE_STORAGE_DIR` is not an absolute path outside the export. Messages never contain a path.
 */
export async function openMigrationFiles(options: OpenFilesOptions): Promise<MigrationFiles> {
  const wanted = resolve(options.dir)
  let dir: string
  try {
    dir = await realpath(wanted)
    if (!(await stat(dir)).isDirectory()) throw new Error('not a directory')
    await access(dir, constants.R_OK | constants.X_OK)
  } catch {
    throw new ApplyGuardError('--files-dir must be an existing, readable directory.')
  }
  const roots = await Promise.all((options.repoRoots ?? defaultOutputRoots()).map(realOf))
  if (roots.some((root) => isInside(dir, root) || isInside(root, dir))) {
    throw new ApplyGuardError('--files-dir must be outside the repository working tree (and must not contain it): keep the export next to the dump, on an encrypted disk.')
  }

  const manifestPath = join(dir, MANIFEST_NAME)
  let manifestBytes: Buffer
  try {
    if ((await lstat(manifestPath)).isSymbolicLink()) throw new Error('link')
    const handle = await open(manifestPath, constants.O_RDONLY | NO_FOLLOW)
    try {
      const st = await handle.stat()
      if (!st.isFile() || st.size > MAX_MANIFEST_BYTES) throw new Error('unusable')
      manifestBytes = await handle.readFile()
    } finally {
      await handle.close()
    }
  } catch {
    throw new ApplyGuardError(`--files-dir has no usable ${MANIFEST_NAME} (a regular file in sha256sum format, paths relative to the directory). File migration is refused without it.`)
  }
  const manifest = parseManifest(manifestBytes)
  const manifestHash = createHash('sha256').update(manifestBytes).digest('hex')

  let storage: FileStorage | null = options.storage ?? null
  if (storage === null) {
    const storageDir = options.env.FILE_STORAGE_DIR
    if (storageDir !== undefined && storageDir !== '') {
      if (!isAbsolute(storageDir)) throw new ApplyGuardError('FILE_STORAGE_DIR must be an absolute path.')
      const storageReal = await realOf(storageDir)
      if (isInside(storageReal, dir) || isInside(dir, storageReal)) {
        throw new ApplyGuardError('FILE_STORAGE_DIR and --files-dir must be separate directories.')
      }
      storage = new LocalDiskStorage(storageReal)
    } else if (options.mode === 'apply') {
      throw new ApplyGuardError('Refusing to copy files: set FILE_STORAGE_DIR to the absolute path of the v2 file storage.')
    }
  }
  return new MigrationFiles(dir, manifest, manifestHash, storage, options.env, options.mode, options.source)
}
