/**
 * The one rule for showing a stored timeline photo (same rule as M04 `lib/image-url.ts`, replicated here
 * because modules do not import each other's internals; candidate for a shared util): the mock may store
 * an upload as a `blob:mock/...` name the browser cannot load, which gets a neutral grey placeholder; a
 * real URL (including a `data:` URL) shows as it is.
 */

export const IMAGE_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160">' +
      '<rect width="240" height="160" rx="12" fill="#f1f5f9"/>' +
      '<rect x="80" y="45" width="80" height="70" rx="8" fill="none" stroke="#94a3b8" stroke-width="4"/>' +
      '<circle cx="104" cy="68" r="7" fill="#94a3b8"/>' +
      '<path d="M84 108l24-22 16 14 12-10 20 18z" fill="#94a3b8"/></svg>',
  )

export const isMockBlob = (value: string): boolean => value.startsWith('blob:mock/')

/** Uploaded image `data:` URLs (jpeg, png, webp) and `blob:` URLs that an `<img>` may load. */
const SAFE_SRC = /^(?:data:image\/(?:jpeg|png|webp);base64,|blob:)/

function sameOrigin(value: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return new URL(value, window.location.origin).origin === window.location.origin
  } catch {
    return false
  }
}

/** The `src` to show: the placeholder for `blob:mock/...` and for any value that is not a safe image source. */
export const photoSrc = (value: string): string =>
  !isMockBlob(value) && (SAFE_SRC.test(value) || sameOrigin(value)) ? value : IMAGE_PLACEHOLDER
