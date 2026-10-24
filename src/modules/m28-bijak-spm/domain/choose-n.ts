/**
 * Choose-N rules of a section ("Jawab N daripada M soalan"), shared by the server (marking) and the
 * attempt screen (counter, hints, locking) so both always agree (FB-048; v2-bijak-spm AC-06.2,
 * AC-06.3, R18). The rule depends on the mode (user decision, ANSWERS.md FB-048).
 *
 * Mod Latihan (answer everything, best N count):
 *  1. The tick "Pilih soalan ini untuk dijawab" is advisory and never changes a score (AC-06.3).
 *  2. Marking counts the best N *attempted* questions by marks (ties: the lower position).
 *  3. When fewer than N were attempted, the remaining slots go to ticked questions that are still
 *     blank, in paper order, so a chosen question is never listed as "Tidak dikira". They score 0,
 *     so the total does not change.
 *  4. Nothing attempted and nothing ticked: no question counts ("Soalan yang dikira: tiada").
 *  5. On the attempt screen, typing in a question below the cap ticks it; above the cap the student
 *     is told that only the best N will count. Nothing is locked.
 *
 * Mod Peperiksaan (the student must choose):
 *  1. Typing in a question ticks it while a slot is free.
 *  2. Once N are ticked, the other questions of the section are locked (inputs disabled).
 *  3. Only ticked questions count (the first N by position if there were ever more), whether or
 *     not they were answered. A ticked blank question counts for 0.
 *  4. Unticking keeps the typed answer, but the question no longer counts and no longer counts as
 *     answered; ticking it again is allowed while a slot is free (and locks another question if
 *     that fills the cap).
 *  5. More answers than N cannot exist, so there is no over-answer note.
 */

export type ChooseMode = 'exam' | 'latihan'

export interface ChooseCandidate {
  id: string
  /** Any answer was entered (text, choice, steps, final or photo). */
  attempted: boolean
  awarded: number
}

/**
 * Ids of the questions that count, in paper order.
 * @param candidates the section's questions in paper order
 * @param n the section's N
 * @param ticked ids the student ticked
 * @param mode Latihan: best N attempted (ticks only fill free slots); Peperiksaan: ticked ones only
 */
export function countedIds(
  candidates: readonly ChooseCandidate[],
  n: number,
  ticked: readonly string[] = [],
  mode: ChooseMode = 'latihan',
): string[] {
  const tickedSet = new Set(ticked)
  if (mode === 'exam')
    return candidates
      .filter((c) => tickedSet.has(c.id))
      .slice(0, n)
      .map((c) => c.id)
  const best = candidates
    .map((c, pos) => ({ c, pos }))
    .filter((x) => x.c.attempted)
    .sort((x, y) => y.c.awarded - x.c.awarded || x.pos - y.pos)
    .slice(0, n)
    .map((x) => x.c.id)
  const counted = new Set(best)
  if (counted.size < n) {
    for (const c of candidates) {
      if (counted.size >= n) break
      if (!c.attempted && tickedSet.has(c.id)) counted.add(c.id)
    }
  }
  return candidates.filter((c) => counted.has(c.id)).map((c) => c.id)
}

export interface ChooseState {
  /** Ticked questions of the section (the counter "{c} / {n} soalan dipilih"). */
  chosen: number
  /** Questions of the section with an answer. */
  answered: number
  /** The cap is reached: further ticks are refused. */
  full: boolean
  /** More questions answered than N: only the best N will count. */
  overflow: boolean
}

export function chooseState(
  n: number,
  questionIds: readonly string[],
  ticked: readonly string[] | undefined,
  answeredIds: ReadonlySet<string>,
): ChooseState {
  const inSection = new Set(questionIds)
  const chosen = (ticked ?? []).filter((id) => inSection.has(id)).length
  const answered = questionIds.filter((id) => answeredIds.has(id)).length
  return { chosen, answered, full: chosen >= n, overflow: answered > n }
}

/** Counter line of a choose section. */
export const chooseCounterLine = (chosen: number, n: number): string =>
  `${chosen} / ${n} soalan dipilih`

/** Shown beside the disabled checkbox once the cap is reached. */
export const chooseFullHint = (n: number): string =>
  `Anda sudah memilih ${n} soalan. Nyahpilih soalan lain untuk menukar pilihan.`

/** Shown when more questions are answered than the section allows. */
export const chooseOverflowHint = (answered: number, n: number): string =>
  `Anda telah menjawab ${answered} soalan. Hanya ${n} soalan dengan markah tertinggi akan dikira.`

/**
 * "Belum dijawab" of a section for the Hantar dialog: every blank question of an "all" section, but
 * only the unfilled slots of a choose-N section (the questions the student skipped on purpose are
 * not unanswered).
 */
export function unansweredIn(
  rule: { type: 'all' } | { type: 'choose'; n: number },
  questionIds: readonly string[],
  answeredIds: ReadonlySet<string>,
): number {
  const answered = questionIds.filter((id) => answeredIds.has(id)).length
  return rule.type === 'all'
    ? questionIds.length - answered
    : Math.max(0, Math.min(rule.n, questionIds.length) - answered)
}

/**
 * Picks after the student typed an answer in `questionId`: the question is ticked when the section
 * still has room (rule 5). Returns the same array when nothing changes.
 */
export function pickOnAnswer(
  picks: readonly string[],
  questionId: string,
  n: number,
): readonly string[] {
  if (picks.includes(questionId) || picks.length >= n) return picks
  return [...picks, questionId]
}

/**
 * Progress of the paper ("Kemajuan menjawab"): answered over what can count. A choose-N section
 * adds at most N to both sides, so skipping the alternatives never holds the bar back and an
 * overflow answer never pushes it past its share.
 */
export function progressOf(
  sections: readonly {
    rule: { type: 'all' } | { type: 'choose'; n: number }
    questionIds: readonly string[]
  }[],
  answeredIds: ReadonlySet<string>,
): { done: number; total: number } {
  let done = 0
  let total = 0
  for (const s of sections) {
    const answered = s.questionIds.filter((id) => answeredIds.has(id)).length
    const cap =
      s.rule.type === 'all' ? s.questionIds.length : Math.min(s.rule.n, s.questionIds.length)
    total += cap
    done += Math.min(answered, cap)
  }
  return { done, total }
}

/** Shown beside the disabled checkbox in Mod Peperiksaan: the question is locked, not just unticked. */
export const chooseLockedHint = (n: number): string =>
  `Anda sudah memilih ${n} soalan. Nyahpilih soalan lain untuk menjawab soalan ini.`

/** In Mod Peperiksaan an unticked question of a full choose section cannot be answered. */
export function isLockedQuestion(mode: ChooseMode, state: ChooseState, ticked: boolean): boolean {
  return mode === 'exam' && state.full && !ticked
}

/**
 * The answered questions that count as answered (map dots, "Belum dijawab", progress). In Mod
 * Peperiksaan an unticked question of a choose section does not count even if it holds an answer.
 */
export function effectiveAnswered(
  sections: readonly {
    id: string
    rule: { type: 'all' } | { type: 'choose'; n: number }
    questionIds: readonly string[]
  }[],
  picks: Readonly<Record<string, readonly string[]>>,
  answeredIds: ReadonlySet<string>,
  mode: ChooseMode,
): Set<string> {
  if (mode !== 'exam') return new Set(answeredIds)
  const out = new Set<string>()
  for (const s of sections) {
    const ticked = new Set(picks[s.id] ?? [])
    for (const id of s.questionIds)
      if (answeredIds.has(id) && (s.rule.type === 'all' || ticked.has(id))) out.add(id)
  }
  return out
}
