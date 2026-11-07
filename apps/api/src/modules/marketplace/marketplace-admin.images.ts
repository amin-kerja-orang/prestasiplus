/** `FileRef.url` of a stored file: `/api/files/{22-character token}` (packages/contract files/schema.ts). */
const FILE_URL = /^\/api\/files\/([A-Za-z0-9_-]{22})$/

/**
 * The public token inside the `url` of a stored product image, or null for anything else (a seeded asset path such as
 * `/images/marketplace/...` has no stored file). The ONE place that derives the token: the write path uses it to check the
 * uploaded file, the delete paths use it to remove the file (decision 5 on issue #506).
 */
export function fileTokenOfImageUrl(url: string): string | null {
  return FILE_URL.exec(url.trim())?.[1] ?? null
}

/** The stored form of an image url (always the relative download path). */
export const imageUrlOfToken = (token: string): string => `/api/files/${token}`

/** Purpose of the files product images are made of. */
export const MARKETPLACE_IMAGE_PURPOSE = 'marketplace_image' as const
