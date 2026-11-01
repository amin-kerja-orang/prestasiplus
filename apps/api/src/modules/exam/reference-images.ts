/**
 * Pictures of a reference sheet (`reference[].imageFileId`), shared by the paper builder and the blueprint editor (B3 T34-L1).
 * ONE rule: a picture is named by its PUBLIC file token (never the internal decimal id); the file must be a stored `question_image`;
 * and, when it is written, it must be an image the editing admin uploaded or one already on the same sheet.
 */
import type { PrismaService } from '../../db/prisma.service'

/** Public token shape: no digits-only internal id passes (`/^[1-9][0-9]{0,17}$/` is the decimal id form). */
export const isFileToken = (ref: string): boolean => /^[A-Za-z0-9_-]{8,64}$/.test(ref) && !/^[0-9]+$/.test(ref)

/** The `imageFileId`s of a stored or submitted reference sheet (anything that is not an array of panels yields none). */
export function imageRefsOf(sheet: unknown): string[] {
  if (!Array.isArray(sheet)) return []
  return sheet.flatMap((p) => {
    const ref = typeof p === 'object' && p !== null ? (p as { imageFileId?: unknown }).imageFileId : undefined
    return typeof ref === 'string' && ref !== '' ? [ref] : []
  })
}

/**
 * The refs that may stay on a sheet WRITTEN by `ownerUserId`: a token naming a stored question image that the editor uploaded, or that is
 * already on the sheet being replaced (`onSheet`).
 */
export async function writableReferenceImages(db: PrismaService['client'], refs: readonly string[], ownerUserId: bigint, onSheet: readonly string[]): Promise<Set<string>> {
  const unique = [...new Set(refs)].filter(isFileToken)
  if (unique.length === 0) return new Set()
  const rows = await db.file.findMany({
    where: { purpose: 'question_image', publicId: { in: unique }, OR: [{ ownerUserId }, { publicId: { in: [...onSheet] } }] },
    select: { publicId: true },
  })
  return new Set(rows.map((r) => r.publicId))
}

/** The refs that are a token naming a stored question image (whoever uploaded it): the check of a sheet that is published. */
export async function storedReferenceImages(db: PrismaService['client'], refs: readonly string[]): Promise<Set<string>> {
  const unique = [...new Set(refs)].filter(isFileToken)
  if (unique.length === 0) return new Set()
  const rows = await db.file.findMany({ where: { purpose: 'question_image', publicId: { in: unique } }, select: { publicId: true } })
  return new Set(rows.map((r) => r.publicId))
}
