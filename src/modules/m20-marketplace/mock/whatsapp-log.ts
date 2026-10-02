/**
 * The wa.me URLs handed over by #16 (SRS M20 v1.2 §6.13, D14): the e2e tests read them through the
 * hook `m20WhatsappLog` instead of following the external link. Module state, cleared at every seed.
 */

let log: string[] = []

export function resetWhatsappLog(): void {
  log = []
}

export function recordWhatsapp(url: string): void {
  log.push(url)
}

export function whatsappLog(): string[] {
  return [...log]
}
