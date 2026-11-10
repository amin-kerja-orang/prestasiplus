/**
 * The real-paper segmenter (T-C4): turns the text of a past-year paper (PDF text layer, or Tesseract output for a scanned
 * page; both arrive as plain page text) into draft questions. It replaces the prototype-layout `parsePaper` as the
 * extractor of a deployment that runs real OCR. Deterministic, no network, no key.
 *
 * What it understands, beyond the mock layout:
 *  - question numbers `1.`, `1)`, `1 Stem` (the last form only when the number is the next expected one);
 *  - options `A.`, `A)`, `(A)`, A to E, in order, one per line or several on one line;
 *  - page furniture (SULIT, paper code, "Lihat halaman sebelah", page numbers) is dropped;
 *  - the answer key under `Jawapan:` or `Kunci Jawapan` in `1-B`, `1. B` or `1 B 2 C` form (shared with the mock);
 *  - stimuli (the PO rule: a rajah is a group stimulus, never a question of its own). A line that is only `Rajah n`
 *    (or `Rajah n: caption`) defines one; a mention of `Rajah n` in a stem or option references one; `Gunakan Rajah n
 *    untuk soalan a hingga b` links a range. Every question that refers to a stimulus is linked to it. A stimulus that
 *    is only mentioned (the figure is an image with no caption text) is created as a candidate and flagged for review.
 */
import { type AiExtractRequest, type AiIntakeStimulus } from '@pp/contract'

import type { ExtractedDraftPaper } from '../ai.types'
import { type Draft, finishPaper, type Line } from './mock/mock-parser'

export const SEGMENTER_MODEL_ID = 'segmenter-1'

const WORDS = 'Rajah|Jadual|Petikan|Graf|Carta'
const DEF_RE = new RegExp(`^(${WORDS})\\s+(\\d{1,2})\\s*(?:[:.\\u2013-]\\s*(.*))?$`, 'i')
const REF_RE = new RegExp(`\\b(${WORDS})\\s+(\\d{1,2})\\b`, 'gi')
const LINK_NUMS_RE = /soalan\s+(\d{1,3}(?:\s*(?:,|dan|hingga|sehingga|-|–)\s*\d{1,3})*)/i
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const

const NOISE: RegExp[] = [
  /^sulit$/i,
  /^\d{4}\/\d(?:\s*sulit)?$/i,
  /^\[?\s*lihat\s+(?:halaman\s+)?sebelah\s*\]?$/i,
  /^(?:halaman|page)\s*\d+(?:\s*(?:daripada|of)\s*\d+)?$/i,
  /^\d{1,3}$/,
  /^(?:©|hak\s+cipta).*$/i,
  /^-+\s*\d{1,3}\s*-+$/,
]

function kindOf(word: string): AiIntakeStimulus['kind'] {
  const w = word.toLowerCase()
  return w === 'jadual' ? 'table' : w === 'petikan' ? 'passage' : 'diagram'
}

function labelOf(word: string, n: string): string {
  return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()} ${String(Number(n))}`
}

/** Lines of all pages, trimmed, without page furniture. */
function toLines(input: AiExtractRequest): Line[] {
  const out: Line[] = []
  for (const p of input.pages)
    for (const raw of p.text.split(/\r?\n/)) {
      const text = raw.replace(/\s+/g, ' ').trim()
      if (text && !NOISE.some((re) => re.test(text))) out.push({ page: p.page, text })
    }
  return out
}

/**
 * `A. 3  B. 5  C. 7  D. 9` on one line becomes one entry per option. A line that starts with the expected letter is an option
 * run; when no option has been read yet (expected A) the run may also start in the middle of a line (OCR often joins the
 * stem and the options into one line), but then at least A and B must follow each other. `head` is the text before the run.
 */
function splitInlineOptions(text: string, expected: number): { head: string; options: { id: string; text: string }[] } | null {
  if (!OPTION_LETTERS[expected]) return null
  const marks: { id: string; at: number; end: number }[] = []
  let from = 0
  for (let i = expected; i < OPTION_LETTERS.length; i++) {
    const l = OPTION_LETTERS[i] as string
    const m = new RegExp(`(?:^|\\s)\\(?${l}[.)]\\s*`).exec(text.slice(from))
    if (!m) break
    const at = from + m.index + (/^\s/.test(m[0]) ? 1 : 0)
    marks.push({ id: l, at, end: from + m.index + m[0].length })
    from = from + m.index + m[0].length
  }
  const first = marks[0]
  if (!first) return null
  if (first.at > 0 && !(expected === 0 && marks.length >= 2)) return null
  return {
    head: text.slice(0, first.at).trim(),
    options: marks.map((m, i) => ({ id: m.id, text: text.slice(m.end, marks[i + 1]?.at ?? text.length).trim() })),
  }
}

interface Work extends Draft {
  refs: string[]
}

export function segmentPaper(input: AiExtractRequest): ExtractedDraftPaper {
  const lines = toLines(input)
  const schemeAt = lines.findIndex((l) => /^(skema|jawapan\s*:|kunci\s+jawapan)/i.test(l.text))
  const body = schemeAt === -1 ? lines : lines.slice(0, schemeAt)
  const schemeLines = schemeAt === -1 ? [] : lines.slice(schemeAt)

  const stimuli: AiIntakeStimulus[] = []
  const byLabel = new Map<string, AiIntakeStimulus>()
  const links: { stim: string; from: number; to: number }[] = []
  const works: Work[] = []
  const warnings: string[] = []
  const mentionedOnly = new Set<string>()
  let cur: Work | null = null
  let lastNo = 0
  /** The stimulus whose caption was seen between questions: the next question belongs to it. */
  let pending: AiIntakeStimulus | null = null
  let openStim: AiIntakeStimulus | null = null
  let target: 'stem' | 'option' | 'part' = 'stem'

  const define = (word: string, n: string, caption: string, page: number): AiIntakeStimulus => {
    const label = labelOf(word, n)
    const key = label.toLowerCase()
    const known = byLabel.get(key)
    if (known) {
      if (caption && !known.caption) {
        known.caption = caption
        known.alt = known.alt || caption
      }
      return known
    }
    const kind = kindOf(word)
    const s: AiIntakeStimulus = {
      id: `stim-${String(stimuli.length + 1)}`,
      kind,
      label,
      alt: caption,
      page,
      ...(caption ? { caption } : {}),
      ...(kind === 'passage' ? { text: caption } : {}),
    }
    stimuli.push(s)
    byLabel.set(key, s)
    return s
  }

  const collectRefs = (w: Work, text: string): void => {
    for (const m of text.matchAll(REF_RE)) w.refs.push(labelOf(m[1] as string, m[2] as string).toLowerCase())
  }

  for (const l of body) {
    const t = l.text

    // 1. A link statement: "Gunakan Rajah 1 untuk menjawab soalan 3 dan 4".
    const nums = LINK_NUMS_RE.exec(t)
    const refMatch = new RegExp(`(${WORDS})\\s+(\\d{1,2})`, 'i').exec(t)
    if (nums && refMatch && !/^\d{1,3}\s*[.)]/.test(t)) {
      const stim = define(refMatch[1] as string, refMatch[2] as string, '', l.page)
      const tokens = (nums[1] as string).split(/\s*(,|dan|hingga|sehingga|-|–)\s*/i)
      let prev = Number(tokens[0])
      links.push({ stim: stim.id, from: prev, to: prev })
      for (let i = 1; i + 1 < tokens.length; i += 2) {
        const joiner = (tokens[i] as string).toLowerCase()
        const n = Number(tokens[i + 1])
        const range = joiner === 'hingga' || joiner === 'sehingga' || joiner === '-' || joiner === '–'
        links.push({ stim: stim.id, from: range ? prev : n, to: n })
        prev = n
      }
      cur = null
      openStim = null
      pending = null
      continue
    }

    // 2. A stimulus caption: only a line that IS the caption (a mention inside a stem has no separator and more words).
    const dm = DEF_RE.exec(t)
    if (dm && (dm[3] !== undefined || t.split(/\s+/).length === 2)) {
      const stim = define(dm[1] as string, dm[2] as string, (dm[3] ?? '').trim(), l.page)
      if (cur && cur.options.length === 0 && cur.parts.length === 0) {
        // A figure printed inside the stem of the question being read: it is that question's stimulus.
        cur.stimId ??= stim.id
        openStim = null
      } else {
        // Between questions: the caption heads the next group.
        pending = stim
        openStim = stim
        cur = null
      }
      continue
    }

    // 3. A question number.
    let qm = /^(\d{1,3})\s*[.)]\s*(.*)$/.exec(t)
    if (qm) {
      const n = Number(qm[1])
      if (!(lastNo === 0 ? n <= 5 : n > lastNo && n <= lastNo + 5)) qm = null
    }
    if (!qm) {
      const plain = /^(\d{1,3})\s+([A-ZÀ-Þ].*)$/.exec(t)
      if (plain && Number(plain[1]) === lastNo + 1) qm = plain
    }
    if (qm) {
      lastNo = Number(qm[1])
      cur = { label: qm[1] as string, page: l.page, stem: [qm[2] as string], options: [], parts: [], refs: [] }
      collectRefs(cur, qm[2] as string)
      const inStem = splitInlineOptions(qm[2] as string, 0)
      if (inStem) {
        cur.stem = [inStem.head]
        cur.options.push(...inStem.options)
      }
      if (pending) {
        cur.stimId = pending.id
        pending = null
      }
      openStim = null
      works.push(cur)
      target = cur.options.length > 0 ? 'option' : 'stem'
      continue
    }

    if (!cur) {
      if (openStim?.kind === 'passage') openStim.text = `${openStim.text ?? ''} ${t}`.trim()
      else if (openStim && !openStim.alt) openStim.alt = t
      continue
    }

    // 4. Options, strictly in order A, B, C, ... so a stem line that starts with "B." is not an option.
    if (cur.parts.length === 0) {
      const run = splitInlineOptions(t, cur.options.length)
      if (run) {
        if (run.head) {
          cur.stem.push(run.head)
          collectRefs(cur, run.head)
        }
        for (const o of run.options) {
          cur.options.push(o)
          collectRefs(cur, o.text)
        }
        target = 'option'
        continue
      }
    }
    const pm = /^\(([a-z])\)\s+(.*)$/.exec(t)
    if (pm && !/^\((i|v|x)+\)/.test(t)) {
      cur.parts.push({ label: `(${pm[1] as string})`, prompt: [pm[2] as string] })
      collectRefs(cur, pm[2] as string)
      target = 'part'
      continue
    }
    const rm = /^\(((?:i{1,3}|iv|v|vi{1,3}|ix|x))\)\s+(.*)$/.exec(t)
    if (rm && cur.parts.length > 0) {
      const base = /^\([a-z]\)/.exec((cur.parts[cur.parts.length - 1] as { label: string }).label)?.[0] ?? ''
      cur.parts.push({ label: `${base}(${rm[1] as string})`, prompt: [rm[2] as string] })
      collectRefs(cur, rm[2] as string)
      target = 'part'
      continue
    }

    // 5. Continuation of the stem, the last option or the last part.
    collectRefs(cur, t)
    if (target === 'option' && cur.options.length > 0) {
      const o = cur.options[cur.options.length - 1] as { id: string; text: string }
      o.text = `${o.text} ${t}`
    } else if (target === 'part' && cur.parts.length > 0) (cur.parts[cur.parts.length - 1] as { prompt: string[] }).prompt.push(t)
    else cur.stem.push(t)
  }

  // A mention of a stimulus links the question to it (a caption in the text is not required: the figure is often an image).
  for (const w of works) {
    const labels = [...new Set(w.refs)]
    if (labels.length === 0) continue
    for (const key of labels) {
      if (byLabel.has(key)) continue
      const m = /^(\S+)\s+(\d+)$/.exec(key) as RegExpExecArray
      define(m[1] as string, m[2] as string, '', w.page)
      mentionedOnly.add(key)
    }
    w.stimId ??= (byLabel.get(labels[0] as string) as AiIntakeStimulus).id
    if (labels.length > 1) warnings.push(`Soalan ${w.label} merujuk lebih daripada satu rajah (${labels.join(', ')}). Hanya yang pertama dipautkan; sila semak.`)
  }

  for (const key of mentionedOnly) {
    const s = byLabel.get(key)
    if (s) warnings.push(`${s.label} dirujuk tetapi kapsyennya tidak dijumpai pada teks. Sila semak rajah ini.`)
  }
  return finishPaper(input, { drafts: works, stimuli, links, schemeLines, extraWarnings: warnings }, SEGMENTER_MODEL_ID)
}
