/**
 * Bab to DSKP unit ("Tajuk DSKP") link of a question (G-02). The curriculum has two trees: the chapters (Bab, M03) and the DSKP
 * nodes (units). There is no foreign key between them, so the link is read from the printed numbers, and only where it is certain:
 *
 * 1. the chapter carries a printed DSKP code (`chapters.dskp_code`, e.g. `7.0`): its units are the ones with the same leading number;
 * 2. otherwise, when the subject and level have exactly one unit per chapter number (the chapters ARE the DSKP units, as in Matematik
 *    Tingkatan 4: Bab 7 is unit 7.0), the unit with the chapter's number is the link;
 * 3. anything else (one catch-all chapter for the whole level, more or fewer chapters than units) has no known link: `null`, and
 *    nothing is filtered or refused. No other heuristic.
 *
 * Pure and shared: the Studio uses it to narrow the unit select, the API uses it to refuse a pair that cannot belong together.
 */
export interface ChapterLinkRef {
  chapterNumber: number | null
  dskpCode?: string | null | undefined
}

/** The leading number of a printed code: `7.0` and `7.1.3` are both `7`; text that does not start with a number is `null`. */
export function leadingNumber(code: string | null | undefined): string | null {
  const m = /^\s*(\d+)/.exec(code ?? '')
  return m ? String(Number(m[1])) : null
}

/**
 * The units a chapter may be tagged with, or `null` when the link is not known (do not filter). `chapters` are the active chapters of
 * the same subject and level; `units` are its DSKP units (only `code` is read).
 */
export function unitsOfChapter<U extends { code: string }>(
  chapter: ChapterLinkRef,
  chapters: readonly ChapterLinkRef[],
  units: readonly U[],
): U[] | null {
  const printed = leadingNumber(chapter.dskpCode)
  if (printed !== null) {
    const hit = units.filter((u) => leadingNumber(u.code) === printed)
    return hit.length > 0 ? hit : null
  }
  if (chapter.chapterNumber === null || chapters.length !== units.length) return null
  const numbers = chapters.map((c) => c.chapterNumber)
  if (numbers.some((n) => n === null) || new Set(numbers).size !== numbers.length) return null
  const unitNumbers = units.map((u) => leadingNumber(u.code))
  if (unitNumbers.some((n) => n === null) || new Set(unitNumbers).size !== unitNumbers.length) return null
  // One unit per chapter number, both ways.
  if (!numbers.every((n) => unitNumbers.includes(String(n)))) return null
  const hit = units.filter((u) => leadingNumber(u.code) === String(chapter.chapterNumber))
  return hit.length === 1 ? hit : null
}

export const CHAPTER_UNIT_MISMATCH_MESSAGE = 'Tajuk DSKP tidak sepadan dengan Bab yang dipilih.'
