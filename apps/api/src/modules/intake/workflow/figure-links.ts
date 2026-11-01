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
