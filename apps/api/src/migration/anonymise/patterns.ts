/**
 * The four personal-data patterns of the leak scan, in a file of their own with NO imports. The leak scan (leak-scan.ts), the
 * `redact-pii` rule (redact.ts) and the question screen of QLOAD (transform/question-bank.ts `piiKindsOf`) all import them from
 * here, so the three can never drift and the pure transform does not pull in the anonymiser.
 */

export const EMAIL = /[A-Za-z0-9._%+'-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g
// +60/60/0 then 1x then 7-8 digits; separators (space or dash) allowed between the groups.
export const MOBILE = /(?<![\d+])(?:\+?60|0)[ -]?1\d[ -]?\d{3,4}[ -]?\d{4}(?!\d)/
// Landline: area code 3 to 9, then 7-8 digits.
export const LANDLINE = /(?<![\d+])(?:\+?60|0)[ -]?[3-9][ -]?\d{3,4}[ -]?\d{4}(?!\d)/
// YYMMDD (valid month and day) - place code - serial, separators optional.
export const IC = /(?<!\d)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[ -]?\d{2}[ -]?\d{4}(?!\d)/
