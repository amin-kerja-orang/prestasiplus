/**
 * "Ambil gambar jalan kerja": photos of handwritten working are kept on the device only
 * (IndexedDB via idb-keyval). The answer stores just the metadata; the photo is shown back to the
 * student in Semakan and marked by self-mark or staff review (no handwriting recognition).
 */
import { del, get, set } from 'idb-keyval'

import type { PhotoMeta } from '@/modules/m28-bijak-spm/domain/types'

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024
export const MAX_PHOTOS_PER_PART = 3
export const MSG_PHOTO_TYPE = 'Gambar mesti JPG atau PNG, maksimum 5 MB.'
export const MSG_PHOTO_COUNT = 'Maksimum 3 gambar bagi setiap bahagian.'

export type PhotoCheck = { ok: true } | { ok: false; message: string }

export function checkPhoto(file: { type: string; size: number }, existing: number): PhotoCheck {
  if (!/^image\/(jpeg|png)$/.test(file.type) || file.size > MAX_PHOTO_BYTES) {
    return { ok: false, message: MSG_PHOTO_TYPE }
  }
  if (existing >= MAX_PHOTOS_PER_PART) return { ok: false, message: MSG_PHOTO_COUNT }
  return { ok: true }
}

const keyOf = (attemptId: string, partId: string, n: number): string =>
  `pp.bijak.photo.${attemptId}.${partId}.${n}.${Date.now()}`

export async function putPhoto(
  attemptId: string,
  partId: string,
  file: File,
  n: number,
): Promise<PhotoMeta> {
  const key = keyOf(attemptId, partId, n)
  try {
    await set(key, file)
  } catch {
    /* storage blocked: the metadata is still kept so the student sees the attachment */
  }
  return { key, name: file.name, size: file.size }
}

export async function photoUrl(key: string): Promise<string | null> {
  try {
    const blob = await get<Blob>(key)
    return blob ? URL.createObjectURL(blob) : null
  } catch {
    return null
  }
}

export async function removePhoto(key: string): Promise<void> {
  try {
    await del(key)
  } catch {
    /* nothing to remove */
  }
}

/* Position of the pupil in a sitting (FR-X6-10, S8-T04): device-only and per attempt, like the photos above. */
/**
 * Where the pupil is in a sitting (FR-X6-10, FR-MUR-QP-12): the question index and the scroll
 * position of the question area. The live state is held by the page, which does not remount when
 * the layout switches between `phone` and `lg`; this helper adds the reload copy in
 * `sessionStorage` (`pp.qd.pos.{attemptId}`, D115 default). Storage may be blocked or full, so
 * every access is wrapped and a failure just means "no saved position".
 */
export interface AttemptPosition {
  questionIndex: number
  scrollTop: number
}

export const positionKey = (attemptId: string): string => `pp.qd.pos.${attemptId}`

function store(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

const whole = (n: unknown): number | null =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null

export function readPosition(attemptId: string): AttemptPosition | null {
  try {
    const raw = store()?.getItem(positionKey(attemptId))
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<AttemptPosition>
    const questionIndex = whole(v.questionIndex)
    const scrollTop = whole(v.scrollTop)
    return questionIndex === null || scrollTop === null ? null : { questionIndex, scrollTop }
  } catch {
    return null
  }
}

export function writePosition(attemptId: string, pos: AttemptPosition): void {
  try {
    store()?.setItem(positionKey(attemptId), JSON.stringify(pos))
  } catch {
    /* blocked or full: the position is only a convenience */
  }
}

export function clearPosition(attemptId: string): void {
  try {
    store()?.removeItem(positionKey(attemptId))
  } catch {
    /* ignore */
  }
}
