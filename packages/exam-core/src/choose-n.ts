/**
 * Choose-N rules of a section ("Jawab N daripada M soalan"), shared by the server (marking) and the
 * attempt screen (counter, hints) so both always agree (FB-048; v2-bijak-spm AC-06.2, AC-06.3, R18).
 *
 * The rule, in one place:
 *  1. The tick "Pilih soalan ini untuk dijawab" is advisory and never changes a score (AC-06.3).
 *  2. Marking counts the best N *attempted* questions by marks (ties: the lower position).
 *  3. When fewer than N were attempted, the remaining slots go to ticked questions that are still
 *     blank, in paper order, until N slots are filled. They score 0, so the total does not change.
 *     A ticked blank question can still be "Tidak dikira" when the free slots run out first
 *     (e.g. N=2, Q1 and Q2 ticked and blank, Q3 answered: Q3 and Q1 count, Q2 does not).
 *  4. Nothing attempted and nothing ticked: no question counts ("Soalan yang dikira: tiada").
 *  5. A stimulus group is ONE choice unit (45 section 5.4 rule 4, FR-QA-41): it counts 1 toward N, its awarded
 *     marks are the sum of its members, it is attempted when any member is, and it is ticked when any member is.
 *     Every member of a counted unit counts. A question with no `groupId` is its own unit (nothing changes).
 *  6. On the attempt screen, typing in a question below the cap ticks it (the counter then equals
 *     the number of questions the student is working on); above the cap the student is told that
 *     only the best N will count.
 */

export interface ChooseCandidate {
  id: string
  /** Any answer was entered (text, choice, steps, final or photo). */
  attempted: boolean
  awarded: number
  /** Stimulus group of the question: members of one group are one choice unit. */
  groupId?: string | undefined
}

interface ChooseUnit {
  ids: string[]
  attempted: boolean
  awarded: number
  ticked: boolean
}

/** Candidates folded into choice units, in paper order (a group sits at its first member). */
function unitsOf(candidates: readonly ChooseCandidate[], tickedSet: ReadonlySet<string>): ChooseUnit[] {
  const units: ChooseUnit[] = []
  const byGroup = new Map<string, ChooseUnit>()
  for (const c of candidates) {
    let u = c.groupId === undefined ? undefined : byGroup.get(c.groupId)
    if (!u) {
      u = { ids: [], attempted: false, awarded: 0, ticked: false }
      units.push(u)
      if (c.groupId !== undefined) byGroup.set(c.groupId, u)
    }
    u.ids.push(c.id)
    u.attempted ||= c.attempted
    u.awarded += c.awarded
    u.ticked ||= tickedSet.has(c.id)
  }
  return units
}

/**
 * Ids of the questions that count, in paper order.
 * @param candidates the section's questions in paper order
 * @param n the section's N
 * @param ticked ids the student ticked (advisory)
 */
export function countedIds(
  candidates: readonly ChooseCandidate[],
  n: number,
  ticked: readonly string[] = [],
): string[] {
  const units = unitsOf(candidates, new Set(ticked))
  const counted = new Set<ChooseUnit>(
    units
      .map((u, pos) => ({ u, pos }))
      .filter((x) => x.u.attempted)
      .sort((x, y) => y.u.awarded - x.u.awarded || x.pos - y.pos)
      .slice(0, n)
      .map((x) => x.u),
  )
  for (const u of units) {
    if (counted.size >= n) break
    if (!u.attempted && u.ticked) counted.add(u)
  }
  const ids = new Set(units.filter((u) => counted.has(u)).flatMap((u) => u.ids))
  return candidates.filter((c) => ids.has(c.id)).map((c) => c.id)
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
  `Anda hanya boleh memilih ${n} soalan dalam bahagian ini.`

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
