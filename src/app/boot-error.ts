/**
 * Visible boot failure and slow-boot notice. Without this the inline splash (`#pp-splash` in
 * `index.html`) spins forever when the app or the deferred mock fails to start.
 *
 * Plain DOM on purpose: it must work when Vue never mounted. Copy in Bahasa Melayu.
 */

export const BOOT_ERROR_TITLE = 'Aplikasi gagal dimuatkan'
export const BOOT_ERROR_MESSAGE =
  'Sila muat semula halaman. Jika masalah berterusan, cuba lagi sebentar nanti.'
export const BOOT_SLOW_MESSAGE =
  'Mengambil masa lebih lama daripada biasa. Sila tunggu atau muat semula halaman.'
export const BOOT_RELOAD_LABEL = 'Muat semula'
/** After this long the splash shows the slow-boot notice. */
export const BOOT_SLOW_MS = 20_000

const PANEL_ID = 'pp-boot-error'

function reloadButton(): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = BOOT_RELOAD_LABEL
  button.style.cssText =
    'min-height:44px;padding:0 20px;border:0;border-radius:8px;background:#2563eb;color:#fff;font:inherit;cursor:pointer'
  button.addEventListener('click', () => {
    window.location.reload()
  })
  return button
}

function panel(title: string | null, message: string): HTMLElement {
  const el = document.createElement('div')
  el.id = PANEL_ID
  el.setAttribute('role', 'alert')
  el.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;background:#fff;color:#1e293b;font:600 14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif'
  if (title !== null) {
    const h = document.createElement('b')
    h.style.fontSize = '18px'
    h.textContent = title
    el.append(h)
  }
  const p = document.createElement('span')
  p.style.fontWeight = '400'
  p.textContent = message
  el.append(p, reloadButton())
  return el
}

/** Replaces the page with the error panel (idempotent). */
export function showBootError(error?: unknown): void {
  if (typeof document === 'undefined' || document.getElementById(PANEL_ID)) return
  if (error !== undefined) console.error('Boot failed', error)
  document.body.append(panel(BOOT_ERROR_TITLE, BOOT_ERROR_MESSAGE))
}

/** Swaps the splash text for the slow-boot notice and a reload button, if the splash is still up. */
export function showBootSlow(): void {
  const splash = document.getElementById('pp-splash')
  if (!splash || document.getElementById(PANEL_ID)) return
  const text = splash.querySelector('span')
  if (text) text.textContent = BOOT_SLOW_MESSAGE
  if (!splash.querySelector('button')) splash.append(reloadButton())
}

/** Starts the slow-boot timer; the splash disappears when Vue mounts, which makes this a no-op. */
export function watchSlowBoot(ms: number = BOOT_SLOW_MS): () => void {
  const timer = setTimeout(showBootSlow, ms)
  return () => {
    clearTimeout(timer)
  }
}
