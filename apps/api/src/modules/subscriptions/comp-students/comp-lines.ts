import { COMP_IC_MIN_DIGITS, COMP_STUDENT_MESSAGES, STUDENT_IMPORT_MESSAGES, STUDENT_IMPORT_NAME_MAX } from '@pp/contract'

export interface CompLine {
  /** 1-based over the raw text, blank lines counted. */
  line: number
  name: string
  /** Digits only, as typed after the last comma. */
  ic: string
  comma: boolean
}

/** Mock BR-18: `NAMA, NOKP` lines; the IC follows the LAST comma, non-digits stripped. */
export function parseCompLines(text: string): CompLine[] {
  const out: CompLine[] = []
  text.split(/\r\n|\r|\n/).forEach((raw, index) => {
    if (raw.trim() === '') return
    const cut = raw.lastIndexOf(',')
    out.push(
      cut < 0
        ? { line: index + 1, name: raw.trim(), ic: '', comma: false }
        : { line: index + 1, name: raw.slice(0, cut).trim(), ic: raw.slice(cut + 1).replace(/\D/g, ''), comma: true },
    )
  })
  return out
}

/** The BM message of a line that cannot be registered, or null when it is well formed. */
export function compLineError(l: CompLine): string | null {
  if (!l.comma || l.name === '') return COMP_STUDENT_MESSAGES.badLine
  if ([...l.name].length > STUDENT_IMPORT_NAME_MAX) return STUDENT_IMPORT_MESSAGES.nameLong
  if (l.ic.length < COMP_IC_MIN_DIGITS) return COMP_STUDENT_MESSAGES.shortIc
  return null
}
