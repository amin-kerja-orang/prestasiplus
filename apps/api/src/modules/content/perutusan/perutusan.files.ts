import { createHash, randomBytes, randomUUID } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'

import { idFromString, idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { inspectUpload, MAX_PIXELS } from '../../files/content-inspect'
import { FILE_STORAGE, type FileStorage } from '../../files'
import { FILE_PURPOSE_OF, PERUTUSAN_MAX_DOCUMENT_BYTES, PERUTUSAN_MAX_IMAGE_BYTES } from './perutusan.constants'

export type AttachmentKind = 'image' | 'document'

/** An attachment that passed the checks: its type was decided from the bytes and the bytes are the sanitised copy. */
export interface InspectedAttachment {
  kind: AttachmentKind
  mime: 'image/jpeg' | 'image/png' | 'image/gif' | 'application/pdf'
  ext: 'jpg' | 'png' | 'gif' | 'pdf'
  bytes: Buffer
}

/** A stored object waiting to be linked to its post. */
export interface StoredAttachment {
  fileId: string
  storageKey: string
}

// ---- GIF ----------------------------------------------------------------------------------------
// BE-04's inspector has no GIF. Same stance as there: rebuild from an ALLOW-LIST, so comments, plain
// text blocks, unknown application blocks and anything after the trailer are dropped.

const GIF_MAX_FRAMES = 1000

/** The offset after the data sub-blocks that start at `pos`, or -1 when the chain runs past the end. */
function skipSubBlocks(b: Buffer, start: number): number {
  let pos = start
  for (;;) {
    const size = b[pos]
    if (size === undefined) return -1
    pos += 1 + size
    if (size === 0) return pos <= b.length ? pos : -1
  }
}

/** GIF87a/89a rebuilt from header, palette, graphic-control blocks, the NETSCAPE loop block, image data and the trailer. */
export function sanitizeGif(b: Buffer): Buffer | null {
  if (b.length < 14) return null
  const sig = b.toString('latin1', 0, 6)
  if (sig !== 'GIF87a' && sig !== 'GIF89a') return null
  const width = b.readUInt16LE(6)
  const height = b.readUInt16LE(8)
  if (width === 0 || height === 0 || width * height > MAX_PIXELS) return null
  const flags = b[10] ?? 0
  let pos = 13 + (flags & 0x80 ? 3 * 2 ** ((flags & 7) + 1) : 0)
  if (pos > b.length) return null
  const out: Buffer[] = [b.subarray(0, pos)]
  let frames = 0
  let area = 0
  for (;;) {
    const code = b[pos]
    if (code === undefined) return null
    if (code === 0x3b) {
      if (frames === 0) return null
      out.push(Buffer.from([0x3b]))
      return Buffer.concat(out)
    }
    if (code === 0x21) {
      const label = b[pos + 1]
      if (label === undefined) return null
      const end = skipSubBlocks(b, pos + 2)
      if (end < 0) return null
      const isLoop = label === 0xff && b[pos + 2] === 11 && b.toString('latin1', pos + 3, pos + 14) === 'NETSCAPE2.0'
      if (label === 0xf9 || isLoop) out.push(b.subarray(pos, end))
      pos = end
      continue
    }
    if (code === 0x2c) {
      if (pos + 10 > b.length) return null
      const f = b[pos + 9] ?? 0
      const p = pos + 10 + (f & 0x80 ? 3 * 2 ** ((f & 7) + 1) : 0) + 1 // + the LZW minimum code size byte
      if (p > b.length) return null
      const end = skipSubBlocks(b, p)
      if (end < 0) return null
      area += b.readUInt16LE(pos + 5) * b.readUInt16LE(pos + 7)
      frames += 1
      if (frames > GIF_MAX_FRAMES || area > 4 * MAX_PIXELS) return null
      out.push(b.subarray(pos, end))
      pos = end
      continue
    }
    return null
  }
}

/**
 * The size and the content decide, never the file name or the declared type (BE-04's rule). Images are JPG, PNG or GIF
 * of at most 2 MB; documents are PDF of at most 5 MB. Anything else (including WebP, which BE-04 accepts for other
 * purposes) is refused, as the contract lists only these types for a perutusan.
 */
export function inspectAttachment(kind: AttachmentKind, buffer: Buffer): InspectedAttachment | null {
  if (buffer.length === 0) return null
  if (kind === 'image') {
    if (buffer.length > PERUTUSAN_MAX_IMAGE_BYTES) return null
    const gif = sanitizeGif(buffer)
    if (gif) return { kind, mime: 'image/gif', ext: 'gif', bytes: gif }
    const inspected = inspectUpload(buffer)
    if (inspected?.mime === 'image/jpeg') return { kind, mime: 'image/jpeg', ext: 'jpg', bytes: inspected.bytes }
    if (inspected?.mime === 'image/png') return { kind, mime: 'image/png', ext: 'png', bytes: inspected.bytes }
    return null
  }
  if (buffer.length > PERUTUSAN_MAX_DOCUMENT_BYTES) return null
  const inspected = inspectUpload(buffer)
  return inspected?.mime === 'application/pdf' ? { kind, mime: 'application/pdf', ext: 'pdf', bytes: inspected.bytes } : null
}

/**
 * Stores the attachments of a post: the bytes go to the BE-04 `FILE_STORAGE` under a server-made key (the client file
 * name never reaches it) and one `files` row is written per object, like `FilesService` does. BE-04 has no purpose for
 * these files and no GIF support, so this class does the same steps with the perutusan purposes. TODO(BE-04): move to
 * `FilesService` once it offers `perutusan_image` and `perutusan_document`.
 */
@Injectable()
export class PerutusanFileStore {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  /** Writes the object. Call before the transaction; `discard` it when the transaction fails. */
  async putObject(file: InspectedAttachment): Promise<string> {
    const storageKey = `${FILE_PURPOSE_OF[file.kind].replace(/_/g, '-')}/${randomUUID()}.${file.ext}`
    await this.storage.put(storageKey, file.bytes)
    return storageKey
  }

  /** The `files` row of a stored object (joins the caller's transaction). */
  async createRow(ownerUserId: string, file: InspectedAttachment, storageKey: string, isTest: boolean): Promise<StoredAttachment> {
    const row = await this.prisma.client.file.create({
      data: {
        publicId: randomBytes(16).toString('base64url'),
        ownerUserId: idFromString(ownerUserId),
        purpose: FILE_PURPOSE_OF[file.kind],
        mime: file.mime,
        sizeBytes: BigInt(file.bytes.length),
        sha256: createHash('sha256').update(file.bytes).digest('hex'),
        storageKey,
        isTest,
      },
    })
    return { fileId: idToString(row.id), storageKey }
  }

  /** Best-effort removal of objects whose post was not saved. */
  async discard(keys: readonly string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.storage.delete(key).catch(() => undefined)))
  }
}
