/**
 * Pictures of a reference sheet (`reference[].imageFileId`), shared by the paper builder and the blueprint editor (B3 T34-L1).
 * ONE rule: a picture is named by its PUBLIC file token (never the internal decimal id); the file must be a stored `question_image`;
 * and, when it is written, it must be an image the editing admin uploaded or one already on the same sheet.
 */
import type { PrismaService } from '../../db/prisma.service'

/** The internal decimal file id (a bigint as text): never a valid NEW reference, only a legacy one that is already on the sheet. */
export const isDecimalFileId = (ref: string): boolean => /^[1-9][0-9]{0,17}$/.test(ref)

/** Public token shape: base64url, 8-64 characters, and not the decimal id form. */
export const isFileToken = (ref: string): boolean => /^[A-Za-z0-9_-]{8,64}$/.test(ref) && !isDecimalFileId(ref)

/** The `imageFileId`s of a stored or submitted reference sheet (anything that is not an array of panels yields none). */
export function imageRefsOf(sheet: unknown): string[] {
  if (!Array.isArray(sheet)) return []
  return sheet.flatMap((p) => {
    const ref = typeof p === 'object' && p !== null ? (p as { imageFileId?: unknown }).imageFileId : undefined
    return typeof ref === 'string' && ref !== '' ? [ref] : []
  })
}

/**
 * The rule for a sheet WRITTEN by `ownerUserId` (paper PUT, Kontrak create / new version). Each picture must be a stored `question_image` and
 *  - a public token: uploaded by the editor, or already on the sheet being replaced (`onSheet`);
 *  - a legacy decimal id: only when it is already on `onSheet` (so a list left unchanged never fails); it is rewritten to the public token, which
 *    is the only form the pupil read rule (path C) and the Terbit check accept.
 * Returns the sheet to store (decimal ids replaced), or `null` when any picture is refused.
 */
export async function writableReferenceSheet<P extends { imageFileId?: string | undefined }>(
  db: PrismaService['client'],
  sheet: readonly P[],
  ownerUserId: bigint,
  onSheet: readonly string[],
): Promise<P[] | null> {
  const refs = [...new Set(sheet.flatMap((p) => (p.imageFileId ? [p.imageFileId] : [])))]
  if (refs.length === 0) return [...sheet]
  const onSet = new Set(onSheet)
  const tokens = refs.filter(isFileToken)
  const decimals = refs.filter((r) => isDecimalFileId(r) && onSet.has(r))
  if (tokens.length + decimals.length !== refs.length) return null
  const rows = await db.file.findMany({
    where: {
      purpose: 'question_image',
      OR: [
        { publicId: { in: tokens }, AND: [{ OR: [{ ownerUserId }, { publicId: { in: [...onSheet] } }] }] },
        { id: { in: decimals.map((d) => BigInt(d)) } },
      ],
    },
    select: { id: true, publicId: true },
  })
  const tokenOf = new Map<string, string>()
  for (const r of rows) {
    tokenOf.set(r.publicId, r.publicId)
    tokenOf.set(r.id.toString(), r.publicId)
  }
  // a token ref must be matched by its own public id (an id-shaped hit never rescues a token ref)
  const out: P[] = []
  for (const p of sheet) {
    const ref = p.imageFileId
    if (!ref) {
      out.push(p)
      continue
    }
    const resolved = tokenOf.get(ref)
    if (resolved === undefined) return null
    out.push({ ...p, imageFileId: resolved })
  }
  return out
}

/**
 * The refs that are a token naming a stored question image uploaded by an admin (or by no one): the check of a sheet that is published. It covers a
 * sheet that was stored before the write rule existed (a Kontrak, or a paper copied by Salin set), where the uploader is no longer the editor.
 */
export async function storedReferenceImages(db: PrismaService['client'], refs: readonly string[]): Promise<Set<string>> {
  const unique = [...new Set(refs)].filter(isFileToken)
  if (unique.length === 0) return new Set()
  const rows = await db.file.findMany({
    where: { purpose: 'question_image', publicId: { in: unique }, OR: [{ ownerUserId: null }, { owner: { roles: { some: { role: 'admin' } } } }] },
    select: { publicId: true },
  })
  return new Set(rows.map((r) => r.publicId))
}
