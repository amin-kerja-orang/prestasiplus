/**
 * The simulated e-mail notices of sponsor status changes (SRS M21 v1.2 BR-M21-07, §6.13, D14): no
 * e-mail leaves the prototype. M21-T3 records the notices; the hook `m21MailLog` reads them. Module
 * state, cleared at every seed.
 */

export interface MailNotice {
  to: string
  sponsorId: number
  status: string
  at: string
}

let log: MailNotice[] = []

export function resetMailLog(): void {
  log = []
}

export function recordMail(notice: MailNotice): void {
  log.push({ ...notice })
}

export function mailLog(): MailNotice[] {
  return log.map((n) => ({ ...n }))
}
