/**
 * The mock extractor's DSKP tag suggestion (v2-dskp-integration 5.3, AC-04.9, AC-05.2). Deterministic,
 * no network: it asks the M03 catalogue (`view.search`) which units and SP the words of a question
 * hit, and maps the evidence to a catalogue node and a confidence. A real provider replaces all of
 * this (ADR-0019); these constants are a heuristic of the mock only.
 *
 * Rules:
 * - A unit or SP is only ever a catalogue node. Below the threshold the field stays empty (never
 *   `rendah`-filled, never a guessed code).
 * - The TP comes from the leading command word, always with confidence `rendah`.
 * - KBAT is not suggested by the mock in v2.0.
 */
import type { TagSuggestion } from '../../../domain/admin-types'
import type { Confidence } from '../../../domain/admin-types'
import type { DskpSpId, DskpUnitId, TpLevel } from '../../../domain/types'
import type { dskpSource } from '../../../lib/dskp-source'

type Catalogue = ReturnType<typeof dskpSource>
/** The loaded view of one subject (what `catalogue.load(code)` resolves to). */
export type DskpView = NonNullable<ReturnType<Catalogue['loaded']>>

/* ---------------------------------------------------------------------------------- constants */

/** Words shorter than this carry no topic (and a one-letter token matches inside any word). */
export const MIN_TOKEN_LENGTH = 4
/** A word that starts more than this many catalogue nodes of the subject is too common to say anything. */
export const GENERIC_NODE_LIMIT = 40
/** A suggestion needs at least this many distinct question words in the node. */
export const MIN_MATCHED_TOKENS = 2
/** The score is out of 1000 like the catalogue's own word-start score, with the denominator capped here. */
export const COVERAGE_CAP = 6
/** Score at which a unit or SP is suggested at all (confidence `sederhana`). */
export const SUGGEST_THRESHOLD = 500
/** Score at which a unit / SP counts as `tinggi` (also needs `HIGH_MIN_MATCHED_TOKENS` words). */
export const HIGH_THRESHOLD = 750
export const HIGH_MIN_MATCHED_TOKENS = 3

/**
 * Leading command word to TP (architecture 5.3). A heuristic of the mock only; the TP is always
 * confirmed by a person.
 */
export const COMMAND_WORD_TP: Readonly<Record<string, TpLevel>> = Object.freeze({
  nyatakan: 1,
  namakan: 1,
  terangkan: 2,
  jelaskan: 2,
  hitung: 3,
  selesaikan: 3,
  bandingkan: 4,
  analisis: 4,
  nilaikan: 5,
  justifikasikan: 5,
  reka: 6,
  cipta: 6,
})

/** Function words and exam boilerplate that never name a topic. */
const STOP_WORDS: ReadonlySet<string> = new Set([
  'yang', 'dengan', 'untuk', 'dalam', 'daripada', 'dari', 'pada', 'adalah', 'atau', 'dan', 'itu',
  'ini', 'antara', 'berikut', 'manakah', 'apakah', 'berapakah', 'bagaimanakah', 'soalan', 'markah',
  'rajah', 'jadual', 'petikan', 'berdasarkan', 'bagi', 'kepada', 'oleh', 'boleh', 'akan', 'jika',
  'apabila', 'sebagai', 'setiap', 'semua', 'tersebut', 'seperti', 'dapat', 'tidak', 'juga', 'serta',
  'telah', 'ialah', 'bahagian', 'jawapan', 'dua', 'tiga', 'empat', 'lima', 'satu',
  // command words (the TP table above reads them instead)
  'nyatakan', 'namakan', 'terangkan', 'jelaskan', 'hitung', 'selesaikan', 'bandingkan', 'nilaikan',
  'justifikasikan', 'reka', 'cipta', 'huraikan', 'senaraikan', 'tentukan', 'tunjukkan', 'lukis',
  'cari', 'labelkan', 'bincangkan',
])

/* ------------------------------------------------------------------------------------ helpers */

/** The same normalisation the catalogue search applies (NFKD, marks removed, lower case). */
const norm = (s: string): string =>
  s
    .normalize('NFKD')
    .replace(/[\p{M}ـ]/gu, '')
    .toLowerCase()

/** Distinct topic words of a question text, in order of first appearance. */
export function topicTokens(text: string): string[] {
  const seen = new Set<string>()
  for (const w of norm(text).match(/\p{L}+/gu) ?? [])
    if (w.length >= MIN_TOKEN_LENGTH && !STOP_WORDS.has(w)) seen.add(w)
  return [...seen]
}

/** First word of a text (letters only), normalised; '' when there is none. */
function firstWord(text: string): string {
  return norm(text).match(/\p{L}+/u)?.[0] ?? ''
}

/** TP from the leading command word of the stem, else of the first part (a lead-in stem has none). */
export function tpFromCommandWord(stem: string, partPrompts: readonly string[]): TpLevel | null {
  for (const t of [stem, ...partPrompts.slice(0, 1)]) {
    const tp = COMMAND_WORD_TP[firstWord(t)]
    if (tp !== undefined) return tp
  }
  return null
}

const scoreOf = (matched: number, tokens: number): number =>
  Math.round((1000 * Math.min(matched, COVERAGE_CAP)) / Math.min(tokens, COVERAGE_CAP))

/** Confidence of one node from its score alone (the unit/SP pair is joined in `suggestTag`). */
export function confidenceFor(score: number, matched: number): Confidence | null {
  if (matched < MIN_MATCHED_TOKENS || score < SUGGEST_THRESHOLD) return null
  return score >= HIGH_THRESHOLD && matched >= HIGH_MIN_MATCHED_TOKENS ? 'tinggi' : 'sederhana'
}

interface Ranked {
  id: string
  score: number
  matched: number
}

/** Best entry; `null` when the top score is shared (an ambiguous match is no match). */
function best(items: readonly Ranked[]): Ranked | null {
  const top = items.reduce<Ranked | null>(
    (a, b) => (a === null || b.score > a.score || (b.score === a.score && b.matched > a.matched) ? b : a),
    null,
  )
  if (!top) return null
  return items.filter((i) => i.score === top.score && i.matched === top.matched).length > 1 ? null : top
}

/* ------------------------------------------------------------------------------- suggestion */

export interface SuggestOptions {
  providerId: string
  model: string
  /** Narrow the search to one tingkatan when the batch declares it; otherwise T4 and T5 are both searched. */
  tingkatan?: 'T4' | 'T5'
}

export interface QuestionText {
  stem: string
  partPrompts: readonly string[]
}

/**
 * The AI suggestion for one question, or `undefined` when the AI has nothing to say (no catalogue node
 * above the threshold and no command word). `view` is the catalogue of the batch subject, or
 * `undefined` when it could not be loaded (then only the TP can be suggested).
 */
export function suggestTag(
  q: QuestionText,
  view: DskpView | undefined,
  o: SuggestOptions,
): TagSuggestion | undefined {
  const s: TagSuggestion = { providerId: o.providerId, model: o.model, confidence: {} }

  if (view) {
    const tokens = topicTokens([q.stem, ...q.partPrompts].join(' '))
    // Words per node: a word is kept only while it is specific (few nodes start with it).
    const byUnit = new Map<string, Set<string>>()
    const bySp = new Map<string, Set<string>>()
    const spUnit = new Map<string, string>()
    const specific: string[] = []
    for (const tok of tokens) {
      const hits = view
        .search(tok, { kinds: ['u', 'sk', 'sp'], limit: 5000, ...(o.tingkatan ? { tingkatan: o.tingkatan } : {}) })
        .filter((h) => h.score > 0)
      if (hits.length === 0 || hits.length > GENERIC_NODE_LIMIT) continue
      specific.push(tok)
      for (const h of hits) {
        const unitId = h.kind === 'u' ? h.node.id : h.node.unitId
        add(byUnit, unitId, tok)
        if (h.kind === 'sp') {
          add(bySp, h.node.id, tok)
          spUnit.set(h.node.id, unitId)
        }
      }
    }
    if (specific.length >= MIN_MATCHED_TOKENS) {
      const unit = best(
        [...byUnit].map(([id, set]) => ({ id, matched: set.size, score: scoreOf(set.size, specific.length) })),
      )
      const unitConf = unit ? confidenceFor(unit.score, unit.matched) : null
      const unitNode = unit && unitConf ? view.unit(unit.id as DskpUnitId) : undefined
      if (unit && unitNode) {
        s.unitId = unitNode.id
        s.formOrigin = unitNode.tingkatan
        // The SP must score on its own text, inside the chosen unit.
        const sp = best(
          [...bySp]
            .filter(([id]) => spUnit.get(id) === unit.id)
            .map(([id, set]) => ({ id, matched: set.size, score: scoreOf(set.size, specific.length) })),
        )
        const spConf = sp ? confidenceFor(sp.score, sp.matched) : null
        if (sp && spConf) {
          s.spIds = [sp.id as DskpSpId]
          const both: Confidence = unitConf === 'tinggi' && spConf === 'tinggi' ? 'tinggi' : 'sederhana'
          s.confidence.unit = both
          s.confidence.sp = both
        } else {
          // "tinggi" needs both the unit and the SP to clear the high threshold.
          s.confidence.unit = 'sederhana'
        }
      }
    }
  }

  const tp = tpFromCommandWord(q.stem, q.partPrompts)
  if (tp !== null) {
    s.tp = tp
    s.confidence.tp = 'rendah'
  }
  return s.unitId || s.tp != null ? s : undefined
}

function add(m: Map<string, Set<string>>, key: string, tok: string): void {
  const set = m.get(key)
  if (set) set.add(tok)
  else m.set(key, new Set([tok]))
}
