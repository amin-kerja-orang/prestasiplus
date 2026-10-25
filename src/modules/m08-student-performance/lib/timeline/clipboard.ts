/**
 * Clipboard and share for S16 / S18 (browser APIs only; UI code never imports `mock/`).
 */

import { alertNative } from '@/components/overlay/native-dialogs'

/**
 * Writes `text` to the clipboard and reports whether it worked: `true` on success, `false` when
 * `navigator.clipboard` is missing or the write is refused. It never throws; callers show their
 * "copied" feedback only on `true` (DV-M08-52). No failure message is specified, so none is shown.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Missing clipboard API or no permission: not copied.
    return false
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
  if (await copyText(url)) alertNative('Link disalin!')
}
