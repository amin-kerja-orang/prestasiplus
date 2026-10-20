/**
 * Pure helpers for client file names. The name is display text only: it never reaches a storage key, and it
 * is never sent to an AI provider.
 */

// C0 and C1 controls, bidi embeddings/overrides/isolates, zero-width characters and the byte order mark.
const UNSAFE_NAME_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff/\\]/g
const MAX_NAME = 255
export const FALLBACK_NAME = 'fail.pdf'

/**
 * Multer decodes multipart file names as latin1, so a UTF-8 name from a browser arrives as mojibake. When every
 * character is below U+0100 and the bytes read back as valid UTF-8, that is what was sent.
 */
export function decodeUploadName(raw: string | undefined): string | undefined {
  if (!raw || !/^[\u0000-\u00ff]*$/.test(raw) || /^[\u0000-\u007f]*$/.test(raw)) return raw
  const utf8 = Buffer.from(raw, 'latin1').toString('utf8')
  return utf8.includes('\ufffd') ? raw : utf8
}

/** Basename only, control and path-separator characters removed, at most 255 characters; `fail.pdf` when nothing is left. */
export function sanitizeOriginalName(raw: string | undefined): string {
  if (!raw) return FALLBACK_NAME
  const base = raw.split(/[\\/]/).pop() ?? ''
  const cleaned = base.replace(UNSAFE_NAME_CHARS, '').trim()
  if (cleaned === '' || cleaned === '.' || cleaned === '..') return FALLBACK_NAME
  const chars = Array.from(cleaned)
  return chars.length > MAX_NAME ? chars.slice(0, MAX_NAME).join('') : cleaned
}

/** `Content-Disposition` for the original download: ASCII fallback plus RFC 5987 `filename*` when the name is not ASCII. */
export function attachmentDisposition(storedName: string): string {
  const name = sanitizeOriginalName(storedName)
  const withExt = /\.pdf$/i.test(name) ? name : `${name}.pdf`
  const ascii = withExt.replace(/[^\x20-\x7e]/g, '_').replace(/["\;%]/g, '_')
  const isAscii = /^[\x20-\x7e]*$/.test(withExt)
  if (isAscii && !/["\;%]/.test(withExt)) return `attachment; filename="${ascii}"`
  const star = encodeURIComponent(withExt).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
  return `attachment; filename="${ascii}"; filename*=UTF-8''${star}`
}
