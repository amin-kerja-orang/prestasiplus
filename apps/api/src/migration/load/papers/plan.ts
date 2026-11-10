/**
 * Pure helpers of the blueprint and paper loaders (T-B10-2, T-B10-3, design 10.3 and 10.4). No I/O.
 */
import { text } from '../../transform/common'

export const PAPERS_RULES_VERSION = 'papers-3'

/** V2 `kertas` text (`2`, `K2`, `Kertas 2`) to a V3 kertas 1..4; null when it holds no digit in range. */
export function kertasOf(raw: string | null | undefined): number | null {
  const m = /(\d)/.exec(text(raw) ?? '')
  if (m === null) return null
  const n = Number(m[1])
  return n >= 1 && n <= 4 ? n : null
}

/** What the kertas inference reads about one V2 paper (T-B13b, design 10.4a). All of it is V2 data or V3 reference data; nothing is guessed. */
export interface KertasEvidence {
  /** V2 `exam_papers.kertas` text. */
  raw: string | null
  /** V2 `exam_papers.cover_code` (the printed paper code, e.g. `1449/2`). */
  coverCode: string | null
  title: string
  /** Answer-mode slug of every leaf part of the paper's questions (V2 `question_parts`, parts with children excluded). */
  leafModes: readonly string[]
  /** True when a section of the paper points to a Kertas Subjektif document (`paper_sections.paper_document_id`). */
  hasDocumentSection: boolean
  /** The subject's Kertas 1 is an objective paper (V3 `spm_subject_configs.target_type = 'spm'`, or a V2 `derived` auto-markable Kertas 1 Kontrak). */
  objectiveK1: boolean
  /** Kertas numbers 2 to 4 for which the subject has a Kontrak (V3 active blueprint, or a V2 non-draft `paper_blueprints` row). */
  structuredKertas: readonly number[]
}

export type KertasVia =
  | 'v2' | 'cover_code' | 'title' | 'structure'
  | 'conflict' | 'composite_document' | 'no_questions' | 'mixed_modes' | 'objective_k1_not_known' | 'structured_kertas_unclear'

export interface KertasInference {
  kertas: number | null
  /** The rule that decided it (`v2`, `cover_code`, `title`, `structure`), or the reason it stays undecided. */
  via: KertasVia
}

/** `1449/2` -> 2: the last digit of a printed paper code. */
export function kertasOfCode(code: string | null | undefined): number | null {
  const m = /\/\s*([1-4])\s*$/.exec(text(code) ?? '')
  return m === null ? null : Number(m[1])
}

/**
 * The kertas a title names: `Kertas 2`, `Paper 1`, `K1`, `P2` (keyword and digit, case-insensitive). Null when it names none; `'many'` when it
 * names two (`Kertas 1 dan 2`, `K1/K2`, two different digits), which is never guessed.
 */
export function kertasOfTitle(title: string | null | undefined): number | 'many' | null {
  const t = text(title) ?? ''
  const found = new Set<number>()
  const re = /(?:^|[^a-z0-9])(?:kertas|paper|k|p)\s*-?\s*([1-4])(?![0-9])((?:\s*(?:&|\+|\/|,|dan|and|-)\s*(?:kertas|paper|k|p)?\s*[1-4](?![0-9]))*)/gi
  for (let m = re.exec(t); m !== null; m = re.exec(t)) {
    found.add(Number(m[1]))
    if ((m[2] ?? '') !== '') return 'many'
  }
  if (found.size === 0) return null
  return found.size === 1 ? (([...found][0] as number)) : 'many'
}

/**
 * Deterministic kertas of a V2 paper (T-B13b); the first rule that decides wins:
 *  1. `exam_papers.kertas` holds a digit 1 to 4 (V2's own value);
 *  2. `cover_code` ends in `/1` to `/4` (a title that names another kertas is a conflict);
 *  3. the title names exactly one kertas (`Kertas 2`, `Paper 1`, `K1`, `P2`);
 *  4. the structure: a section with a Kertas Subjektif document makes a composite (undecided); every leaf part MCQ and the subject's Kertas 1
 *     objective gives 1; every leaf part structured/essay and the subject has exactly one Kontrak kertas among 2 to 4 gives that kertas.
 * Anything else stays undecided (`kertas: null`, reason in `via`): the paper is held and listed, never guessed.
 */
export function inferKertas(e: KertasEvidence): KertasInference {
  const own = kertasOf(e.raw)
  if (own !== null) return { kertas: own, via: 'v2' }
  const code = kertasOfCode(e.coverCode)
  const title = kertasOfTitle(e.title)
  if (title === 'many') return { kertas: null, via: 'conflict' }
  if (code !== null) return title !== null && title !== code ? { kertas: null, via: 'conflict' } : { kertas: code, via: 'cover_code' }
  if (title !== null) return { kertas: title, via: 'title' }
  if (e.hasDocumentSection) return { kertas: null, via: 'composite_document' }
  if (e.leafModes.length === 0) return { kertas: null, via: 'no_questions' }
  const mcq = e.leafModes.filter((m) => m === 'mcq').length
  if (mcq === e.leafModes.length) return e.objectiveK1 ? { kertas: 1, via: 'structure' } : { kertas: null, via: 'objective_k1_not_known' }
  if (mcq > 0) return { kertas: null, via: 'mixed_modes' }
  return e.structuredKertas.length === 1 ? { kertas: e.structuredKertas[0] as number, via: 'structure' } : { kertas: null, via: 'structured_kertas_unclear' }
}

/** `all` or `choose` from a V2 selection rule slug (`answer_all`, `choose_n`, `all`, `choose`); null for any other slug. */
export function ruleTypeOf(slug: string | null | undefined): 'all' | 'choose' | null {
  const s = (text(slug) ?? '').toLowerCase()
  if (s === 'all' || s === 'answer_all') return 'all'
  if (s === 'choose' || s === 'choose_n' || s === 'answer_n') return 'choose'
  return null
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? (s[mid] as number) : Math.round(((s[mid - 1] as number) + (s[mid] as number)) / 2)
}

export const intOf = (v: string | null | undefined, min = 0): number | null => {
  const t = text(v)
  if (t === null || !/^\d{1,6}$/.test(t)) return null
  const n = Number(t)
  return n >= min ? n : null
}

/** A V2 json array of strings to the V3 `text[]` (anything else is empty). */
export function instructionsOf(raw: string | null | undefined): string[] {
  const t = text(raw)
  if (t === null) return []
  try {
    const v: unknown = JSON.parse(t)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : []
  } catch {
    return []
  }
}

/** `reference_assets` kept only when it is the `[{ title, items[] }]` shape of V3 `reference_sheets`; else `[]`. */
export function referenceSheetsOf(raw: string | null | undefined): { title: string; items: string[] }[] {
  const t = text(raw)
  if (t === null) return []
  try {
    const v: unknown = JSON.parse(t)
    if (!Array.isArray(v)) return []
    const out: { title: string; items: string[] }[] = []
    for (const x of v) {
      const o = x as { title?: unknown; items?: unknown }
      if (typeof o?.title !== 'string' || o.title.trim() === '' || !Array.isArray(o.items) || !o.items.every((i) => typeof i === 'string')) return []
      out.push({ title: o.title.trim(), items: o.items as string[] })
    }
    return out
  } catch {
    return []
  }
}

/** V2 answer-mode slugs to the V3 leaf modes (unknown slugs are dropped by the caller). */
export function allowedModesOf(raw: string | null | undefined): { modes: string[]; dropped: number } {
  const t = text(raw)
  if (t === null) return { modes: [], dropped: 0 }
  let list: unknown
  try {
    list = JSON.parse(t)
  } catch {
    return { modes: [], dropped: 0 }
  }
  if (!Array.isArray(list)) return { modes: [], dropped: 0 }
  const map: Record<string, string> = {
    mcq: 'mcq', short_text: 'short_text', numeric: 'numeric', essay: 'essay', extended_essay: 'essay', working: 'working', working_shown: 'working',
    drawing: 'drawing', draw_on_diagram: 'drawing', graph_plot: 'drawing', table_fill: 'table_fill', match_letter: 'match_letter', essay_choice: 'essay_choice',
  }
  const modes: string[] = []
  let dropped = 0
  for (const x of list) {
    const m = typeof x === 'string' ? map[x.trim().toLowerCase()] : undefined
    if (m === undefined) dropped += 1
    else if (!modes.includes(m)) modes.push(m)
  }
  return { modes, dropped }
}
