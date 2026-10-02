/**
 * Saves a fetched file the way a live download link would (M04 S5 template / S10 file links, M08 S22 / S23
 * "Export CSV"). The object URL is released in a later task so the browser has started the download.
 */

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
