/**
 * Clipboard and share for S16 / S18 (browser APIs only; UI code never imports `mock/`).
 */

import { alertNative } from '@/components/overlay/native-dialogs'

/** Writes `text` to the clipboard (best effort: a refused write is ignored). */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // No clipboard permission: live has the same dead end.
  }
}

/** S18 "Kongsi" (FR-M08-104): `navigator.share({title, url})` when available, else copy + alert. */
export async function shareProfile(title: string, url: string): Promise<void> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url })
    } catch {
      // A dismissed share sheet is not an error.
    }
    return
  }
  await copyText(url)
  alertNative('Pautan disalin!')
}
