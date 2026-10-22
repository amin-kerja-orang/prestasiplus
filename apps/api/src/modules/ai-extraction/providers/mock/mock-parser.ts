/**
 * The heuristic paper parser of the `mock` provider: a faithful port of the frontend prototype's `parsePaper`
 * (`admin/intake/ai/mock-extractor.ts` at 9af43134), so the review UI sees the same `ExtractedPaper` from the server mock
 * as from the browser mock (card AC1, golden test). No network, no key, deterministic. It understands this layout
 * (fictional sample papers):
 *
 *   Rajah 1: caption ...            a stimulus (also Jadual / Petikan, text may continue)
 *   Gunakan Rajah 1 untuk menjawab soalan 3 dan 4.     links the stimulus to questions 3-4
 *   1. Stem [2 markah]              question, marks in square brackets
 *   A. option                       MCQ options
 *   (a) part prompt [2 markah]      structured parts, (i) sub-parts
 *   Jawapan: 1-B 2-C                MCQ key
 *   Skema 3(a)                      scheme heading
 *   K1 2x = 14 - 6 [1]              mark point: letter+seq, text (alternatives split by "atau"), marks
 *   Mana-mana 2 x 1 m               "any N of M" group over the scheme's points
 *
 * Differences from the prototype, all deliberate: ids are deterministic (`stim-<n>`, `q-<label>-<n>`, as the contract
 * documents) instead of time based; the result carries the server-only draft fields (`status`, `fieldConfidence`,
 * `warnings`); the candidate units come from the request taxonomy when it has one.
 */
import {
  AI_MESSAGES,
  type AiDraftPart,
  type AiDraftQuestionType,
  type AiExtractRequest,
  type AiIntakeStimulus,
  type AiItemWarning,
  type AiLeafKind,
  type AiPointCode,
  type AiPointDef,
  type AiQuestionDraft,
  type AiSchemeDef,
} from '@pp/contract'

import type { ExtractedDraftPaper } from '../../ai.types'
import { candidateUnits, emptyTag, guessUnit, tagWithUnit } from './mock-units'

export const MOCK_MODEL_ID = 'heuristik-1'

interface Line {
  page: number
  text: string
}

const MARKS_RE = /\[\s*(\d+)\s*(?:markah|m)?\s*\]/i
const POINT_RE = /^([KNPBMFC])(\d)\s+(.+)$/
const STIM_RE = /^(Rajah|Jadual|Petikan)\s+(\d+)\s*[:.-]\s*(.*)$/i
const LINK_RE =
  /(Rajah|Jadual|Petikan)\s+(\d+).*?soalan\s+(\d+)\s*(?:dan|hingga|sehingga|-|–)\s*(\d+)|soalan\s+(\d+)\s*(?:dan|hingga|sehingga|-|–)\s*(\d+).*?(Rajah|Jadual|Petikan)\s+(\d+)/i

function toLines(input: AiExtractRequest): Line[] {
  const out: Line[] = []
  for (const p of input.pages)
    for (const raw of p.text.split(/\r?\n/)) {
      const text = raw.replace(/\s+/g, ' ').trim()
      if (text) out.push({ page: p.page, text })
    }
  return out
}

function takeMarks(text: string): { text: string; marks?: number } {
  const m = MARKS_RE.exec(text)
  if (!m) return { text }
  return { text: text.replace(MARKS_RE, '').trim(), marks: Number(m[1]) }
}

function modeFor(prompt: string, marks: number): AiLeafKind {
  const p = prompt.toLowerCase()
  if (/\blukis\b/.test(p)) return 'drawing'
  if (/\b(jelaskan|huraikan|bincangkan)\b/.test(p)) return marks >= 4 ? 'essay' : 'short_text'
  if (/\b(hitung|cari|selesaikan|tentukan|nilai|ungkapkan)\b/.test(p)) return marks >= 2 ? 'working' : 'numeric'
  if (/\b(nyatakan|namakan|apakah|senaraikan|labelkan)\b/.test(p)) return 'short_text'
  return marks >= 3 ? 'working' : 'short_text'
}

interface Draft {
  label: string
  page: number
  stem: string[]
  options: { id: string; text: string }[]
  parts: { label: string; prompt: string[]; marks?: number }[]
  marks?: number
}

function typeOf(d: Draft): AiDraftQuestionType {
  if (d.options.length >= 2) return 'mcq'
  if (d.parts.length > 0) return 'structured'
  const text = d.stem.join(' ').toLowerCase()
  if ((d.marks ?? 0) >= 8 || /\b(karangan|huraikan|bincangkan)\b/.test(text)) return 'essay'
  return 'short'
}

const MSG_NO_MARKS = 'Markah tidak dijumpai pada kertas.'
const MSG_NO_STEM = 'Soalan tidak dapat dibaca. Sila semak secara manual.'

/** Deterministic confidence per field: low for the fields the heuristics could not settle, high otherwise. */
function confidenceOf(q: AiQuestionDraft): Record<string, number> {
  const low = new Set(q.lowFields)
  const c: Record<string, number> = { stem: q.needsManual ? 0.2 : 0.9, marks: low.has('marks') ? 0.4 : 0.9, 'tag.unit': low.has('tag.unit') ? 0.3 : 0.7 }
  if (q.tag.sp.length > 0 || low.has('tag.sp')) c['tag.sp'] = low.has('tag.sp') ? 0.5 : 0.8
  if (q.scheme || q.parts.some((p) => p.scheme)) c.scheme = 0.8
  return c
}

function warningsOf(q: AiQuestionDraft): AiItemWarning[] {
  const w: AiItemWarning[] = []
  if (q.lowFields.includes('marks')) w.push({ code: 'no_marks', field: 'marks', message: MSG_NO_MARKS })
  if (q.needsManual) w.push({ code: 'no_stem', field: 'stem', message: MSG_NO_STEM })
  return w
}

export function parsePaper(input: AiExtractRequest): ExtractedDraftPaper {
  const units = candidateUnits(input.subject, input.taxonomy)
  let stimSeq = 0
  let questionSeq = 0
  const lines = toLines(input)
  const schemeAt = lines.findIndex((l) => /^(skema|jawapan\s*:)/i.test(l.text))
  const body = schemeAt === -1 ? lines : lines.slice(0, schemeAt)
  const schemeLines = schemeAt === -1 ? [] : lines.slice(schemeAt)

  const stimuli: AiIntakeStimulus[] = []
  const links: { stim: string; from: number; to: number }[] = []
  const drafts: Draft[] = []
  let cur: Draft | null = null
  let stim: AiIntakeStimulus | null = null
  let target: 'stem' | 'option' | 'part' = 'stem'

  for (const l of body) {
    const t = l.text
    const sm = STIM_RE.exec(t)
    if (sm) {
      const kindWord = (sm[1] as string).toLowerCase()
      stimSeq += 1
      stim = {
        id: `stim-${String(stimSeq)}`,
        kind: kindWord === 'rajah' ? 'diagram' : kindWord === 'jadual' ? 'table' : 'passage',
        label: `${(sm[1] as string).charAt(0).toUpperCase()}${(sm[1] as string).slice(1).toLowerCase()} ${sm[2] as string}`,
        alt: sm[3] || '',
        page: l.page,
        ...(sm[3] ? { caption: sm[3] } : {}),
        ...(kindWord === 'petikan' ? { text: sm[3] || '' } : {}),
      }
      stimuli.push(stim)
      cur = null
      continue
    }
    const lm = LINK_RE.exec(t)
    if (lm) {
      const word = (lm[1] ?? lm[7]) as string
      const num = (lm[2] ?? lm[8]) as string
      const from = Number(lm[3] ?? lm[5])
      const to = Number(lm[4] ?? lm[6])
      const linked = stimuli.find((s) => s.label.toLowerCase() === `${word} ${num}`.toLowerCase())
      if (linked) links.push({ stim: linked.id, from, to })
      stim = null
      continue
    }
    const qm = /^(\d{1,3})[.)]\s+(.*)$/.exec(t)
    if (qm) {
      cur = { label: qm[1] as string, page: l.page, stem: [qm[2] as string], options: [], parts: [] }
      drafts.push(cur)
      stim = null
      target = 'stem'
      continue
    }
    if (!cur) {
      if (stim?.kind === 'passage') stim.text = `${stim.text ?? ''} ${t}`.trim()
      else if (stim && !stim.alt) stim.alt = t
      continue
    }
    const om = /^([A-D])[.)]\s+(.*)$/.exec(t)
    if (om && cur.parts.length === 0) {
      cur.options.push({ id: om[1] as string, text: om[2] as string })
      target = 'option'
      continue
    }
    const pm = /^\(([a-z])\)\s+(.*)$/.exec(t)
    if (pm && !/^\((i|v|x)+\)/.test(t)) {
      cur.parts.push({ label: `(${pm[1] as string})`, prompt: [pm[2] as string] })
      target = 'part'
      continue
    }
    const rm = /^\(((?:i{1,3}|iv|v|vi{1,3}|ix|x))\)\s+(.*)$/.exec(t)
    if (rm && cur.parts.length > 0) {
      const base = /^\([a-z]\)/.exec((cur.parts[cur.parts.length - 1] as { label: string }).label)?.[0] ?? ''
      cur.parts.push({ label: `${base}(${rm[1] as string})`, prompt: [rm[2] as string] })
      target = 'part'
      continue
    }
    // continuation
    if (target === 'option' && cur.options.length > 0) {
      const o = cur.options[cur.options.length - 1] as { id: string; text: string }
      o.text = `${o.text} ${t}`
    } else if (target === 'part' && cur.parts.length > 0) (cur.parts[cur.parts.length - 1] as { prompt: string[] }).prompt.push(t)
    else cur.stem.push(t)
  }

  /* ---- build questions */
  const warnings: string[] = []
  const questions: AiQuestionDraft[] = drafts.map((d) => {
    const stemRaw = takeMarks(d.stem.join(' '))
    const parts: AiDraftPart[] = d.parts.map((p, i) => {
      const pm = takeMarks(p.prompt.join(' '))
      const marks = pm.marks ?? 0
      return { id: `${d.label}-p${String(i + 1)}`, label: p.label, prompt: pm.text, marks, mode: modeFor(pm.text, marks) }
    })
    const type = typeOf({ ...d, ...(stemRaw.marks !== undefined ? { marks: stemRaw.marks } : {}) })
    const unit = guessUnit(units, `${stemRaw.text} ${parts.map((p) => p.prompt).join(' ')}`)
    const lowFields: string[] = []
    let tag = tagWithUnit(emptyTag(input.subject), unit)
    if (unit) {
      tag = { ...tag, sp: [`${unit.code.slice(-2)}.1`] }
      lowFields.push('tag.sp')
    } else lowFields.push('tag.unit')
    const marks = type === 'mcq' ? (stemRaw.marks ?? 1) : parts.length > 0 ? 0 : (stemRaw.marks ?? 0)
    if (type !== 'mcq' && parts.length === 0 && stemRaw.marks === undefined) lowFields.push('marks')
    questionSeq += 1
    const q: AiQuestionDraft = {
      status: 'draft',
      id: `q-${d.label}-${String(questionSeq)}`,
      label: d.label,
      type,
      stem: stemRaw.text,
      options: type === 'mcq' ? d.options : [],
      marks,
      mode: type === 'essay' ? 'essay' : modeFor(stemRaw.text, marks),
      parts: type === 'structured' ? parts : [],
      tag,
      page: d.page,
      lowFields,
      confirmed: [],
      fieldConfidence: {},
      warnings: [],
    }
    if (!q.stem && q.parts.length === 0) q.needsManual = true
    return q
  })
  if (questions.length === 0) warnings.push(AI_MESSAGES.noQuestions)

  for (const lk of links)
    for (const q of questions) if (Number(q.label) >= lk.from && Number(q.label) <= lk.to) q.stimulusId = lk.stim

  /* ---- schemes */
  const unmatched: string[] = []
  const byLabel = new Map(questions.map((q) => [q.label, q]))
  let curTarget: { q: AiQuestionDraft; part?: AiDraftPart | undefined } | null = null
  let curPoints: AiPointDef[] = []
  const anyN = { n: 0 }
  const finish = (): void => {
    if (!curTarget || curPoints.length === 0) {
      curPoints = []
      anyN.n = 0
      return
    }
    const sorted = curPoints.map((p) => p.marks).sort((a, b) => b - a)
    const total = (anyN.n > 0 ? sorted.slice(0, anyN.n) : sorted).reduce((n, m) => n + m, 0)
    const scheme: AiSchemeDef = {
      kind: 'points',
      marks: total,
      points: curPoints,
      ...(anyN.n > 0 ? { groups: [{ id: 'g1', anyN: anyN.n, pointIds: curPoints.map((p) => p.id) }] } : {}),
    }
    if (curTarget.part) {
      curTarget.part.scheme = scheme
      if (!curTarget.part.marks) curTarget.part.marks = total
    } else {
      curTarget.q.scheme = scheme
      if (!curTarget.q.marks) curTarget.q.marks = total
    }
    curPoints = []
    anyN.n = 0
  }

  for (const l of schemeLines) {
    const t = l.text
    const key = /^jawapan\s*:\s*(.*)$/i.exec(t)
    if (key) {
      for (const m of (key[1] as string).matchAll(/(\d{1,3})\s*[-:.]?\s*([A-D])\b/g)) {
        const q = byLabel.get(m[1] as string)
        if (q && q.type === 'mcq') q.scheme = { kind: 'option', marks: q.marks || 1, correct: m[2] as string, reason: '' }
        else unmatched.push(`Jawapan ${m[1] as string}-${m[2] as string}`)
      }
      continue
    }
    const head = /^skema\s+(\d{1,3})\s*((?:\([a-z]+\))*)\s*$/i.exec(t)
    if (head) {
      finish()
      const q = byLabel.get(head[1] as string)
      const partLabel = head[2] ?? ''
      const part = partLabel ? q?.parts.find((p) => p.label === partLabel) : undefined
      curTarget = q && (!partLabel || part) ? { q, part } : null
      if (!curTarget) unmatched.push(`Skema ${head[1] as string}${partLabel}`)
      continue
    }
    const any = /^mana-mana\s+(\d+)\s*x\s*(\d+)\s*m/i.exec(t.replace(/[[\]]/g, ''))
    if (any) {
      anyN.n = Number(any[1])
      continue
    }
    const pt = POINT_RE.exec(t)
    if (pt && curTarget) {
      const pm = takeMarks(pt[3] as string)
      const ecf = /\b(ecf|ofc)\b/i.test(pm.text)
      const text = pm.text.replace(/\(?\b(ecf|ofc)\b\)?/i, '').trim()
      const accept = text.split(/\s+atau\s+/i).map((s) => s.trim())
      const prevPart = curTarget.part ? curTarget.q.parts[curTarget.q.parts.indexOf(curTarget.part) - 1] : undefined
      curPoints.push({
        id: `pt${String(curPoints.length + 1)}`,
        code: pt[1] as AiPointCode,
        marks: pm.marks ?? 1,
        label: accept[0] as string,
        match: { type: 'step', accept },
        ...(ecf && prevPart ? { ecf: { fromPart: prevPart.id, rule: { op: 'same' as const }, note: 'Ikut jawapan sendiri' } } : {}),
      })
    }
  }
  finish()

  // Unit/partial marks: a structured question's marks come from its parts.
  for (const q of questions) if (q.parts.length > 0) q.marks = q.parts.reduce((n, p) => n + p.marks, 0)

  // Server-only fields, derived after the heuristics settled.
  for (const q of questions) {
    q.fieldConfidence = confidenceOf(q)
    q.warnings = warningsOf(q)
  }

  return { provider: 'mock', model: MOCK_MODEL_ID, questions, stimuli, unmatched, warnings }
}
