/**
 * The one rule for showing a stored image (S3 detail now, the S2/S4 form later): the mock stores an
 * upload as a `blob:mock/...` name, which the browser cannot load, so it gets a grey placeholder; a
 * real URL shows as it is.
 */

/** Neutral placeholder: a grey box with a picture outline. */
export const IMAGE_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160">' +
      '<rect width="240" height="160" rx="12" fill="#f1f5f9"/>' +
      '<rect x="80" y="45" width="80" height="70" rx="8" fill="none" stroke="#94a3b8" stroke-width="4"/>' +
      '<circle cx="104" cy="68" r="7" fill="#94a3b8"/>' +
      '<path d="M84 108l24-22 16 14 12-10 20 18z" fill="#94a3b8"/></svg>',
  )

/** True for the mock's `blob:mock/...` names. */
export const isMockBlob = (value: string): boolean => value.startsWith('blob:mock/')

/** The `src` to render for a stored image value: the placeholder for `blob:mock/...`, else the value. */
export function imageSrc(value: string): string {
  if (isMockBlob(value)) return IMAGE_PLACEHOLDER
  // A v2 public file token (22 URL-safe characters) is served by `/api/files/<token>`.
  return /^[A-Za-z0-9_-]{22}$/.test(value) ? `/api/files/${value}` : value
}
