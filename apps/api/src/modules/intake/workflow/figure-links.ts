/**
 * One figure, every question that refers to it (D90). A page shows "Rajah 1" once and several questions say "Berdasarkan
 * Rajah 1": S1 and S2 are members of ONE group around that figure, not two standalone questions and not two copies of it.
 * The extractor links an item to a stimulus only when it noticed the link; this pure pass adds the links it missed, from the
 * text of the item and the label of the stimulus. It never moves an item the extractor (or a person) already linked.
 */

/** Words that name a figure, mapped to one canonical BM word (English test papers say Figure / Diagram / Table). */
const WORDS: Readonly<Record<string, string>> = {
  rajah: 'rajah',
  figure: 'rajah',
  diagram: 'rajah',
  gambar: 'rajah',
  jadual: 'jadual',
  table: 'jadual',
  graf: 'graf',
  graph: 'graf',
  petikan: 'petikan',
  passage: 'petikan',
  peta: 'peta',
  map: 'peta',
  carta: 'carta',
  chart: 'carta',
}

// "Rajah 1", "rajah1", "Rajah 2.1", "Figure 3". A trailing letter or dot after the number is not part of the number.
const REF = /(?<![\p{L}\p{N}])(rajah|figure|diagram|gambar|jadual|table|graf|graph|petikan|passage|peta|map|carta|chart)\s*(\d{1,3}(?:\.\d{1,2})?)(?![\p{N}])/giu

/** Canonical key of every figure a text refers to, in order of first mention, without repeats. "Gambar rajah 1" is "rajah1". */
export function figureKeys(text: string): string[] {
  const keys: string[] = []
  for (const m of text.matchAll(REF)) {
    const word = WORDS[(m[1] as string).toLowerCase()]
    if (word === undefined) continue
    const key = `${word}${(m[2] as string).replace(/\.$/, '')}`
    if (!keys.includes(key)) keys.push(key)
  }
  return keys
}

/**
 * THE one canonical stimulus-reference keyword set (45 section 6.6.1, D113-continued; PO decision 2026-11-05 supersedes the D115 default).
 * A change in 45 6.6.1 is a change here only. `figure` words take a number (the numbered form); `source` words only flag in the unnumbered
 * form. The frontend twin (`src/modules/m28-bijak-spm/admin/intake/domain/figure-links.ts`) is outside S1 and does not cite this set yet: it should (45 6.6.1); owners S2/S3, follow-up on #503.
 */
export const STIMULUS_REFERENCE_WORDS = {
  figure: ['rajah', 'figure', 'diagram', 'gambar rajah', 'gambar', 'jadual', 'table', 'graf', 'graph', 'carta', 'chart', 'peta', 'map', 'petikan', 'passage'],
  source: ['sumber', 'teks', 'text', 'maklumat', 'pernyataan', 'situasi', 'bahan'],
  /** A positional phrase within `STIMULUS_REFERENCE_WINDOW` words of a figure or source word. */
  positional: ['di atas', 'di bawah', 'berikut', 'above', 'below', 'following'],
  /** A figure or source word used as the subject of one of these. */
  subjectVerbs: ['menunjukkan', 'shows'],
} as const

/** "within 3 words" (45 6.6.1 b). */
export const STIMULUS_REFERENCE_WINDOW = 3

/** Lower case, diacritics removed, runs of whitespace collapsed to one space (45 6.6.1 "normalised text"). */
export function normaliseReferenceText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ')
}

const alt = (list: readonly string[]): string => list.map((w) => w.replace(' ', '\\s+')).join('|')
const NUMBERED_REF = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alt(STIMULUS_REFERENCE_WORDS.figure)})\\s*\\d{1,3}(?:\\.\\d{1,2})?(?![\\p{N}])`, 'iu')
const WORD_SET: ReadonlySet<string> = new Set([...STIMULUS_REFERENCE_WORDS.figure, ...STIMULUS_REFERENCE_WORDS.source].flatMap((w) => w.split(' ')))
const POSITIONAL = STIMULUS_REFERENCE_WORDS.positional.map((p) => p.split(' '))
const VERBS: ReadonlySet<string> = new Set(STIMULUS_REFERENCE_WORDS.subjectVerbs)

export interface StimulusReference {
  /** `numbered` = "Rajah 14" (a figure word followed by a number); `unnumbered` = a word with a positional phrase or as subject (DM-53 `stimulus_flag_ref`). */
  kind: 'numbered' | 'unnumbered'
  /** The text as written (normalised), e.g. "Rajah 14" or "Graf". */
  text: string
}

/** The first unnumbered reference in the text (words only, no sentence barrier: 45 6.6.1 states just the window), or null: a keyword with a positional phrase within the window, or as subject of the verb. */
function unnumberedIn(sentence: string): string | null {
  const tokens = sentence.match(/[\p{L}\p{N}]+/gu) ?? []
  const lower = tokens.map((t) => t.toLowerCase())
  const phraseAt = (i: number): number => POSITIONAL.find((ph) => ph.every((w, k) => lower[i + k] === w))?.length ?? 0
  for (let i = 0; i < lower.length; i += 1) {
    if (!WORD_SET.has(lower[i] as string)) continue
    for (let d = 1; d <= STIMULUS_REFERENCE_WINDOW; d += 1) {
      const after = i + d
      if (after < lower.length && (VERBS.has(lower[after] as string) || phraseAt(after) > 0)) return tokens[i] as string
      // A phrase before the word: the phrase's last word is `d` words before it.
      for (const ph of POSITIONAL) {
        const start = i - d - ph.length + 1
        if (start >= 0 && ph.every((w, k) => lower[start + k] === w)) return tokens[i] as string
      }
    }
  }
  return null
}

/** The first reference to a figure in `text` (the numbered form wins), or null. Pure; case-insensitive on normalised text (45 6.6.1). */
export function stimulusReferenceOf(text: string): StimulusReference | null {
  const norm = normaliseReferenceText(text)
  const numbered = NUMBERED_REF.exec(norm)
  if (numbered !== null) return { kind: 'numbered', text: numbered[0] }
  const found = unnumberedIn(norm)
  if (found !== null) return { kind: 'unnumbered', text: found }
  return null
}

/** The key a stimulus label stands for ("Rajah 1" gives "rajah1"); null when the label names no numbered figure. */
export function stimulusKey(label: string): string | null {
  return figureKeys(label)[0] ?? null
}

export interface LinkableStimulus {
  ref: string
  label: string
}

export interface LinkableItem {
  /** Any stable index of the item in the caller's list. */
  index: number
  /** The stimulus the item is already linked to, or null. */
  stimulusRef: string | null
  /** Stem, options and part prompts. */
  text: string
}

export interface FigureLinks {
  /** item index -> stimulus ref added by this pass. */
  links: Map<number, string>
  /** Items that refer to more than one stimulus and were linked to the first one mentioned: a reviewer should look. */
  several: number[]
}

/**
 * Links every unlinked item to the stimulus it names. Two stimuli with the same key (a figure listed twice) are one: the
 * first wins, so the items never split over copies of the same figure.
 */
export function linkReferencingItems(stimuli: readonly LinkableStimulus[], items: readonly LinkableItem[]): FigureLinks {
  const byKey = new Map<string, string>()
  for (const s of stimuli) {
    const key = stimulusKey(s.label)
    if (key !== null && !byKey.has(key)) byKey.set(key, s.ref)
  }
  const links = new Map<number, string>()
  const several: number[] = []
  if (byKey.size === 0) return { links, several }
  for (const item of items) {
    if (item.stimulusRef !== null) continue
    const refs = [...new Set(figureKeys(item.text).flatMap((k) => (byKey.has(k) ? [byKey.get(k) as string] : [])))]
    const first = refs[0]
    if (first === undefined) continue
    links.set(item.index, first)
    if (refs.length > 1) several.push(item.index)
  }
  return { links, several }
}
