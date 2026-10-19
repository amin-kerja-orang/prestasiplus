/**
 * Browser helpers shared by S15, S16 and S18 (clipboard, `wa.me` / new-tab navigation, card
 * download). UI code never imports `mock/`.
 *
 * Card download (D25): "Muat Turun" captures the on-screen card to a PNG with html2canvas
 * (`studentb-capture.ts`, loaded on first use). The downloader is injectable for tests.
 */

/** Writes `text` to the clipboard (best effort: a refused write is ignored, the label still changes). */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Clipboard unavailable (insecure context / denied): live has the same dead end.
  }
}

/** `https://wa.me/?text={encoded text}` (FN-M14-6.1.7, 6.2.7). */
export const waUrl = (text: string): string => `https://wa.me/?text=${encodeURIComponent(text)}`

/** The card text + "\n\n" + the viewer's profile URL (FN-M14-6.2.7). */
export const withProfileLink = (text: string, profileUrl: string): string =>
  `${text}\n\n${profileUrl}`

/** Opens an external share target in a new tab. */
export function openShare(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer')
}

export type CardDownloader = (target: HTMLElement | null, fileName: string) => Promise<void>

const defaultDownloader: CardDownloader = (target, fileName) =>
  import('./studentb-capture').then((m) => m.captureCardToPng(target, fileName))

let downloader: CardDownloader = defaultDownloader

/** Installs the card downloader (tests, or the app once image export is decided). */
export function setCardDownloader(next: CardDownloader | null): void {
  downloader = next ?? defaultDownloader
}

/** Saves a card as a PNG named `fileName` through the installed downloader (default: html2canvas capture). */
export function downloadCard(target: HTMLElement | null, fileName: string): Promise<void> {
  return downloader(target, fileName)
}

/** The viewer's public profile link (DV-M14-02; live hard-codes `/pelajar/3`). */
export const profileUrlOf = (userId: number): string =>
  `https://prestasiplus.my/pelajar/${String(userId)}`
