/**
 * Pure selection of the questions of the K1 draft papers (slug `bijak-k1-papers`, LEAD decision D-6 = B2). No I/O, no clock,
 * no randomness: the same eligible stock gives the same papers on UAT and on production after the cutover.
 *
 * Rules:
 *  - candidates are ordered by `legacy_id` (numeric ids by value, numeric before non-numeric, then by code point);
 *  - a candidate whose `dedupeKey` was already seen is dropped (the first in order wins), so one stem appears once;
 *  - the stock is split into strata (the school level of the question: `t1_t3`, `t4`, `t5`). Each stratum has a quota per
 *    paper; a stratum that cannot give its share passes the shortfall to the strata that still have stock;
 *  - inside a stratum the picks are spread evenly over the ordered list (centred positions, no randomness) and dealt to the
 *    papers in turn, so every paper covers the whole range and no question is in two papers;
 *  - when the stock is too small for the requested number of papers, fewer (full) papers are built, never a short paper.
 */

export interface Candidate {
  /** v2 question id (decimal string). Never printed. */
  id: string
  /** `questions.legacy_id` of the archived .cloud question: the ordering key. */
  legacyId: string
  /** School level of the question: `t1_t3`, `t4` or `t5`. */
  stratum: string
  /** Equal keys mean "the same question text"; the first in order is kept. Optional. */
  dedupeKey?: string | null
}

export interface SelectInput {
  candidates: readonly Candidate[]
  /** Questions per paper. */
  perPaper: number
  /** Papers wanted (the result may hold fewer). */
  sets: number
  /** Questions per paper from each stratum; the values add up to `perPaper`. Strata that are not listed are ignored. */
  quota: Readonly<Record<string, number>>
}

export interface SelectResult {
  /** The questions of each paper, in `legacy_id` order. `papers.length` is the number of full papers that the stock allows. */
  papers: Candidate[][]
  /** Candidates of the listed strata after the duplicate drop. */
  stock: number
  /** Candidates dropped as duplicates of an earlier one. */
  duplicatesDropped: number
  /** Stock per stratum (after the duplicate drop). */
  stockByStratum: Record<string, number>
  /** Picked per stratum over all papers. */
  pickedByStratum: Record<string, number>
}

const NUMERIC = /^\d+$/

/** Total order on legacy ids: numeric ids by value (before the others), the others by code point. */
export function compareLegacy(a: string, b: string): number {
  const an = NUMERIC.test(a)
  const bn = NUMERIC.test(b)
  if (an && bn) {
    const x = BigInt(a)
    const y = BigInt(b)
    return x < y ? -1 : x > y ? 1 : 0
  }
  if (an) return -1
  if (bn) return 1
  return a < b ? -1 : a > b ? 1 : 0
}

const byLegacy = (a: Candidate, b: Candidate): number => compareLegacy(a.legacyId, b.legacyId) || compareLegacy(a.id, b.id)

/** `k` distinct, centred, evenly spread positions in `0..m-1` (requires `0 <= k <= m`). */
export function spreadPositions(m: number, k: number): number[] {
  const out: number[] = []
  for (let j = 0; j < k; j++) out.push(Math.floor(((2 * j + 1) * m) / (2 * k)))
  return out
}

export function selectPapers(input: SelectInput): SelectResult {
  const { perPaper, sets, quota } = input
  if (!Number.isInteger(perPaper) || perPaper < 1) throw new RangeError('perPaper must be a positive integer')
  if (!Number.isInteger(sets) || sets < 1) throw new RangeError('sets must be a positive integer')
  const quotaSum = Object.values(quota).reduce((n, v) => n + v, 0)
  if (quotaSum !== perPaper || Object.values(quota).some((v) => !Number.isInteger(v) || v < 0)) {
    throw new RangeError('the quota must add up to perPaper')
  }
  const strata = Object.keys(quota).sort()

  const ordered = input.candidates.filter((c) => strata.includes(c.stratum)).sort(byLegacy)
  const seenKeys = new Set<string>()
  const seenIds = new Set<string>()
  const kept: Candidate[] = []
  let duplicatesDropped = 0
  for (const c of ordered) {
    if (seenIds.has(c.id) || (c.dedupeKey != null && seenKeys.has(c.dedupeKey))) {
      duplicatesDropped++
      continue
    }
    seenIds.add(c.id)
    if (c.dedupeKey != null) seenKeys.add(c.dedupeKey)
    kept.push(c)
  }

  const lists = new Map<string, Candidate[]>(strata.map((s) => [s, []]))
  for (const c of kept) lists.get(c.stratum)?.push(c)
  const stockByStratum = Object.fromEntries(strata.map((s) => [s, lists.get(s)?.length ?? 0]))
  const pickedByStratum = Object.fromEntries(strata.map((s) => [s, 0]))

  const built = Math.min(sets, Math.floor(kept.length / perPaper))
  const result: SelectResult = { papers: [], stock: kept.length, duplicatesDropped, stockByStratum, pickedByStratum }
  if (built < 1) return result

  // How many to take from each stratum over all papers: the quota times the papers, capped by the stock; the shortfall goes to
  // the strata with stock left (largest remainder first, then by name), one question at a time.
  const take: Record<string, number> = {}
  let deficit = 0
  for (const s of strata) {
    const want = (quota[s] ?? 0) * built
    const have = stockByStratum[s] ?? 0
    take[s] = Math.min(want, have)
    deficit += want - take[s]!
  }
  while (deficit > 0) {
    const open = strata
      .map((s) => ({ s, room: (stockByStratum[s] ?? 0) - (take[s] ?? 0) }))
      .filter((x) => x.room > 0)
      .sort((x, y) => y.room - x.room || (x.s < y.s ? -1 : 1))
    const next = open[0]
    if (!next) break // cannot happen: built * perPaper <= kept.length
    take[next.s] = (take[next.s] ?? 0) + 1
    deficit--
  }

  // Deal the picks to the papers in turn, the counter running on from one stratum to the next, so that every paper ends with
  // exactly `perPaper` questions.
  const papers: Candidate[][] = Array.from({ length: built }, () => [])
  let counter = 0
  for (const s of strata) {
    const list = lists.get(s) ?? []
    const k = take[s] ?? 0
    for (const pos of spreadPositions(list.length, k)) {
      const pick = list[pos]
      if (!pick) continue
      papers[counter % built]?.push(pick)
      counter++
      pickedByStratum[s] = (pickedByStratum[s] ?? 0) + 1
    }
  }
  result.papers = papers.map((p) => p.sort(byLegacy))
  return result
}
