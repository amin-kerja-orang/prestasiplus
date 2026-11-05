/**
 * Text comparison for grading (S1-T09a part 5, review F1). exam-core `normaliseText` maps every character outside a-z0-9 to a space, so an
 * Arabic, Jawi or Chinese text normalises to `''` and would equal any other non-Latin text. These helpers keep such text as written (NFC,
 * case-folded only where the script has case, punctuation read as a space) and never let an empty key match anything.
 */
import { normaliseText } from '@pp/exam-core/grading'

/** True when the text holds a letter or digit of a script other than Latin (Arabic, Jawi, Chinese, ...). */
export const hasNonLatin = (s: string): boolean => /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u.test(s.normalize('NFC'))

/** The comparable form of a text for word and phrase matching: M-SHORT normalisation for Latin text, the raw NFC text otherwise. */
export function foldText(s: string): string {
  if (!hasNonLatin(s)) return normaliseText(s)
  return s.normalize('NFC').toLowerCase().replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim()
}

/** The comparable form of a whole answer; `caseSensitive` keeps the case and the punctuation (trimmed only, as before for Latin). */
export function matchKey(s: string, caseSensitive = false): string {
  if (!caseSensitive) return foldText(s)
  return s.normalize('NFC').trim()
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
