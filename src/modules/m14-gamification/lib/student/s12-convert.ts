/** S12 conversion rules (SRS M14 BR-M14-10, FN-M14-3.1.4 / 3.1.5), client side. */

/** floor(amount ÷ rate); 0 for an empty, negative or non-numeric amount. */
export function s12Tokens(amount: number, rate: number): number {
  if (!Number.isFinite(amount) || rate <= 0 || amount <= 0) return 0
  return Math.floor(amount / rate)
}

/** The button is disabled when amount < rate or amount > currentSyiling (or empty / not an integer). */
export function s12CanConvert(amount: number | null, rate: number, balance: number): boolean {
  if (amount === null || !Number.isInteger(amount)) return false
  return amount >= rate && amount <= balance
}

/** FR-GM-18.1: what a conversion really debits, tokens x rate; the remainder stays with the pupil. */
export function s12Debit(amount: number, rate: number): number {
  return s12Tokens(amount, rate) * rate
}

/**
 * One key per press (`clientUuid`, DM-79, FR-ERR-9). A v4 UUID from `crypto.getRandomValues`, because
 * `crypto.randomUUID` exists in secure contexts only and an environment may run over plain HTTP.
 */
export function s12NewClientUuid(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Parses the number input value; empty or invalid text is `null`. */
export function s12ParseAmount(text: string): number | null {
  if (text.trim() === '') return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}
