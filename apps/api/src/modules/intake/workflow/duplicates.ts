import { INTAKE_DUPLICATE_NEAR_THRESHOLD, type IntakeDuplicateKind, type IntakeQuestion } from '@pp/contract'

/**
 * Duplicate rule of exam schema D11 / v2-question-bank US-06 (pure). A question is reduced to its normalised text (stem,
 * part prompts, option texts); two questions are
 *  - `exact`: the normalised text is identical;
 *  - `variant`: identical once every number is masked (same structure, different figures: allowed, informational);
 *  - `near`: token similarity (Jaccard) at least `INTAKE_DUPLICATE_NEAR_THRESHOLD`, not exact and not a variant.
 * The check never decides anything: it only proposes entries (the state stays generated or needs_review).
 */

/** Texts shorter than this are not compared: "1" or "Pilih" would match everything. */
export const MIN_COMPARABLE_CHARS = 12

export interface Signature {
  /** Normalised text. */
  text: string
  /** Same with numbers masked. */
  shape: string
  tokens: ReadonlySet<string>
}

export function normalise(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\$/g, ' ')
    .replace(/[^\p{L}\p{N}.\s]/gu, ' ')
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function signatureOf(text: string): Signature {
  const norm = normalise(text)
  return {
    text: norm,
    shape: norm.replace(/\d+(?:\.\d+)?/g, '#'),
    tokens: new Set(norm.split(' ').filter((t) => t.length > 0)),
  }
}

/** All the text of an intake question that identifies it. */
export function textOfQuestion(q: Pick<IntakeQuestion, 'stem' | 'options' | 'parts'>): string {
  return [q.stem, ...q.parts.map((p) => p.prompt), ...q.options.map((o) => o.text)].join(' \n ')
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]
  let both = 0
  for (const t of small) if (large.has(t)) both += 1
  return both / (a.size + b.size - both)
}

export interface Comparison {
  kind: IntakeDuplicateKind
  similarity: number
}

/** The finding for one pair, or null when they are unrelated (or too short to compare). */
export function compare(a: Signature, b: Signature): Comparison | null {
  if (a.text.length < MIN_COMPARABLE_CHARS || b.text.length < MIN_COMPARABLE_CHARS) return null
  if (a.text === b.text) return { kind: 'exact', similarity: 1 }
  if (a.shape === b.shape && a.shape.includes('#')) return { kind: 'variant', similarity: round(jaccard(a.tokens, b.tokens)) }
  // Cheap bound before the set walk: sizes too far apart cannot reach the threshold.
  const lo = Math.min(a.tokens.size, b.tokens.size)
  const hi = Math.max(a.tokens.size, b.tokens.size)
  if (hi === 0 || lo / hi < INTAKE_DUPLICATE_NEAR_THRESHOLD) return null
  const s = jaccard(a.tokens, b.tokens)
  return s >= INTAKE_DUPLICATE_NEAR_THRESHOLD ? { kind: 'near', similarity: round(s) } : null
}

const round = (n: number): number => Math.round(n * 1000) / 1000
