/**
 * Text comparison for grading (S1-T09a part 5, review F1). exam-core `normaliseText` maps every character outside a-z0-9 to a space, so an
 * Arabic, Jawi or Chinese text normalises to `''` and would equal any other non-Latin text. These helpers keep such text as written (NFKC, no combining marks, tatweel or format characters, ASCII digits,
 * case-folded only where the script has case, punctuation read as a space) and never let an empty key match anything.
 */
import { normaliseText } from '@pp/exam-core/grading'

/** True when the text holds a letter or digit of a script other than Latin (Arabic, Jawi, Chinese, ...). */
export const hasNonLatin = (s: string): boolean => /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u.test(s.normalize('NFC'))

/** The value 0-9 of the decimal digit `cp`: decimal digits come in contiguous runs of ten that start at a zero. */
const digitValue = (cp: number): number => {
  let n = 0
  while (/\p{Nd}/u.test(String.fromCodePoint(cp - n - 1))) n++
  return n % 10
}

/**
 * Presentation-independent form shared by both branches: NFKC (fullwidth to ASCII, micro sign to mu, ligatures), no format characters
 * (ZWJ, ZWNJ, LRM, RLM), no tatweel (U+0640), and every decimal digit (Arabic-Indic, Extended Arabic-Indic, ...) as its ASCII digit.
 */
const prefold = (s: string): string =>
  s
    .normalize('NFKC')
    .replace(/[\p{Cf}\u0640]/gu, '')
    .replace(/\p{Nd}/gu, (d) => String(digitValue(d.codePointAt(0)!)))

/**
 * The comparable form of a text for word and phrase matching: M-SHORT normalisation for Latin text. For a text with non-Latin letters
 * (Arabic, Jawi, Chinese, ...) the text as written, without combining marks (harakat, shadda), punctuation as a space; Latin runs inside
 * such a mixed text are lower-cased and lose their diacritics like Latin text does. Precomposed letters (alef with hamza) stay distinct letters.
 */
export function foldText(s: string): string {
  const t = prefold(s)
  if (!hasNonLatin(t)) return normaliseText(t)
  return t
    .replace(/\p{Script=Latin}+/gu, (run) => run.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase())
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The comparable form of a whole answer; `caseSensitive` keeps the case and the punctuation (trimmed only, as before for Latin). */
export function matchKey(s: string, caseSensitive = false): string {
  if (!caseSensitive) return foldText(s)
  const t = prefold(s)
  return (hasNonLatin(t) ? t.replace(/\p{M}/gu, '') : t).trim()
}

/** Equal after `matchKey`, and never when either side is empty. */
export const sameText = (a: string, b: string, caseSensitive = false): boolean => {
  const x = matchKey(a, caseSensitive)
  return x !== '' && x === matchKey(b, caseSensitive)
}

/** Whole-word (or whole-phrase) match of `phrase` in an already folded `text`; an empty phrase never matches. */
export function phraseIn(text: string, phrase: string): boolean {
  const p = foldText(phrase)
  return p !== '' && ` ${text} `.includes(` ${p} `)
}

/** Number of words of a text (0 when nothing comparable is in it). */
export function wordsOf(s: string): number {
  const t = foldText(s)
  return t === '' ? 0 : t.split(' ').length
}
