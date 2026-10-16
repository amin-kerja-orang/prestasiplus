/**
 * "Ambil gambar jalan kerja": photos of handwritten working are kept on the device only
 * (IndexedDB via idb-keyval). The answer stores just the metadata; the photo is shown back to the
 * student in Semakan and marked by self-mark or staff review (no handwriting recognition).
 */
import { del, get, set } from 'idb-keyval'

import type { PhotoMeta } from '../domain/types'

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

export async function putPhoto(attemptId: string, partId: string, file: File, n: number): Promise<PhotoMeta> {
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
