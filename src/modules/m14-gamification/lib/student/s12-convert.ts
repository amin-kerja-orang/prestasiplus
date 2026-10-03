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

/** Parses the number input value; empty or invalid text is `null`. */
export function s12ParseAmount(text: string): number | null {
  if (text.trim() === '') return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}
