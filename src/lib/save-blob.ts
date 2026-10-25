/**
 * Saves a fetched file the way a live download link would (M04 S5 template / S10 file links, M08 S22 / S23
 * "Export CSV"). The object URL is released well after the click: Safari and Firefox resolve a blob link
 * asynchronously, and a URL revoked in the next task makes the download fail ("Failed - Network error")
 * or save an empty file (UAT G-47).
 */

/** Time the object URL stays valid after the click. */
export const REVOKE_DELAY_MS = 60_000

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}
