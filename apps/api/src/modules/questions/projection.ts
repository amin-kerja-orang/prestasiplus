/**
 * Pure mapping between the flat mock shape of the contract (`Question`, `QuestionGuruDetail`) and the
 * v2 part tree (LEAD decision Q-4), plus the learner projection (Q-3).
 *
 * Rules:
 * - A flat question is ONE leaf. mcq -> `mcq` (options A.., key `option`); true_false -> `short_text`
 *   accepted exactly `["Benar"]` or `["Salah"]`; short_answer / fill_blank -> `short_text` (fill_blank
 *   has `blankCount >= 1`); essay -> `essay` with a `points` key built from `modelAnswer`.
 * - Reading back: `short_text` with accepted exactly one of Benar / Salah and no blank is
 *   `true_false`; `blankCount >= 1` is `fill_blank`; other `short_text` is `short_answer`; any other
 *   mode or a tree reads as `essay` with null options.
 * - `difficultyLevel` is stored in `difficulty_tp`; TP 6 reads back as 5.
 * - Constants of the 7 "not carried" fields live in `constantFields` (data model Appendix B).
 */
import {
  QuestionPublicPartSchema,
  QuestionPublicSchema,
  type QuestionPart,
} from '@pp/contract'

import { isLeaf, type QuestionLeaf } from './grading'
import { totalMarks } from './tree'
import type {
  PublicQuestion,
  QuestionRecord,
  QuestionVersionRecord,
  StoreSourceType,
} from './types'

export type FlatType = 'mcq' | 'true_false' | 'short_answer' | 'fill_blank' | 'essay'
export const TRUE_VALUE = 'Benar'
export const FALSE_VALUE = 'Salah'

const LETTERS = 'ABCDEFGH'

/** The text of an option as sent: a string, `{ text }` or `{ optionText }` (contract `optText`). */
export function optionTextOf(v: unknown): string {
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'object' && v !== null) {
    const o = v as { text?: unknown; optionText?: unknown }
    const t = typeof o.optionText === 'string' ? o.optionText : typeof o.text === 'string' ? o.text : ''
    return t.trim()
  }
  return ''
}

/** MCQ key as the mock reads it: index 0..3, a digit string or a letter A to D. */
export function keyIndexOf(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 && v <= 3 ? v : undefined
  if (typeof v !== 'string') return undefined
  const t = v.trim().toUpperCase()
  if (/^\d+$/.test(t)) return Number(t) <= 3 ? Number(t) : undefined
  return /^[A-D]$/.test(t) ? t.charCodeAt(0) - 65 : undefined
}

/** Guru difficulty: easy / medium / hard are TP 2 / 3 / 4; a number is used as is. */
export function difficultyOf(v: unknown): number {
  if (v === 'easy') return 2
  if (v === 'medium') return 3
  if (v === 'hard') return 4
  return typeof v === 'number' ? v : Number(v)
}

/**
 * Kertas ('1' to '3') of a paper code: the trailing digit after the last slash (`1449/2`, `MATH/2`). This is the same
 * rule the paper builder applies (`kertasOf` / `candidates`); null when the code has none or the digit is not 1 to 3.
 */
export function kertasOfPaperCode(paperCode: string | null | undefined): '1' | '2' | '3' | null {
  const m = paperCode ? /\/([0-9])\s*$/.exec(paperCode) : null
  return m && (m[1] === '1' || m[1] === '2' || m[1] === '3') ? m[1] : null
}

/**
 * The paper code that carries `kertas` for a question: the stored code with its trailing digit replaced when it already
 * ends in `/<digit>`, else `<subjectCode>/<kertas>` (the subject's own curriculum code: no mapping to bijak subject codes
 * is needed because the builder only reads the trailing digit).
 *
 * `null` clears the kertas by removing ONLY a valid trailing `/1` to `/3`; any other code (`1449/4`, `SPM2023`) is kept, so an
 * unrelated edit that sends no kertas never erases a real paper code. Without a subject code and without a trailing digit to
 * replace, no code is invented: the stored value is returned unchanged (the form requires a subject, so the `subjectId` 422
 * comes first and this case does not occur on the API).
 */
export function paperCodeWithKertas(stored: string | null | undefined, kertas: '1' | '2' | '3' | null, subjectCode: string | null): string | null {
  const keep = stored ?? null
  if (kertas === null) {
    const m = stored ? /^(.*)\/[1-3]\s*$/.exec(stored) : null
    if (!m) return keep
    return m[1] === '' ? null : (m[1] as string)
  }
  const m = stored ? /^(.*\/)[0-9]\s*$/.exec(stored) : null
  if (m) return `${m[1]}${kertas}`
  return subjectCode ? `${subjectCode}/${kertas}` : keep
}

export const difficultyLabelOf = (level: number): string => (level <= 2 ? 'Mudah' : level === 3 ? 'Sederhana' : 'Sukar')

const altList = (v: string | readonly string[] | undefined): string[] =>
  (typeof v === 'string' ? v.split(/[\n;]/) : [...(v ?? [])]).map((s) => s.trim()).filter((s) => s !== '')

export interface FlatSource {
  questionType: FlatType
  questionText: string
  options?: readonly unknown[]
  correctAnswer?: number | string
  tfAnswer?: boolean | string | number | null
  correctAnswerText?: string | null
  altAnswers?: string | readonly string[]
  modelAnswer?: string | null
  pointsValue?: number
  /** One per option, file ids (decimal strings) or null. */
  optionImageIds?: readonly (string | null)[]
}

const asBool = (v: unknown): boolean | undefined =>
  v === true || v === 'true' || v === '1' || v === 1 ? true : v === false || v === 'false' || v === '0' || v === 0 ? false : undefined

/** The single-leaf tree of a flat question. Caller guarantees the contract superRefine already held. */
export function partsFromFlat(src: FlatSource): QuestionPart[] {
  const marks = Math.max(1, src.pointsValue ?? 1)
  const base = { label: '1', prompt: { ms: src.questionText }, marks }
  let leaf: QuestionLeaf
  switch (src.questionType) {
    case 'mcq': {
      const texts = (src.options ?? []).map(optionTextOf)
      const index = keyIndexOf(src.correctAnswer) ?? 0
      leaf = {
        ...base,
        mode: 'mcq',
        options: texts.map((t, i) => ({
          label: LETTERS.charAt(i),
          body: { ms: t },
          ...(src.optionImageIds?.[i] ? { imageId: src.optionImageIds[i] } : {}),
        })),
        key: { kind: 'option', correct: LETTERS.charAt(index) },
      }
      break
    }
    case 'true_false':
      leaf = { ...base, mode: 'short_text', key: { kind: 'accepted', values: [asBool(src.tfAnswer) === false ? FALSE_VALUE : TRUE_VALUE] } }
      break
    case 'short_answer':
    case 'fill_blank': {
      const answer = (typeof src.correctAnswerText === 'string' && src.correctAnswerText.trim() !== '' ? src.correctAnswerText : typeof src.correctAnswer === 'string' ? src.correctAnswer : '').trim()
      leaf = {
        ...base,
        mode: 'short_text',
        ...(src.questionType === 'fill_blank' ? { blankCount: 1 } : {}),
        key: { kind: 'accepted', values: [answer, ...altList(src.altAnswers)] },
      }
      break
    }
    case 'essay': {
      const model = src.modelAnswer?.trim() ?? ''
      leaf = {
        ...base,
        mode: 'essay',
        key: {
          kind: 'points',
          marks,
          points: [{ id: 'p1', code: 'P', label: 'Jawapan model', marks, ...(model === '' ? {} : { text: { ms: model } }) }],
          ...(model === '' ? {} : { modelText: model }),
        },
      }
      break
    }
  }
  return [leaf]
}

export interface FlatFields {
  questionType: FlatType
  questionText: string
  options: string[] | null
  /** Option file ids in order (decimal strings); the service turns them into URLs. */
  optionImageIds: (string | null)[]
  correctAnswer: number | null
  tfAnswer: boolean | null
  correctAnswerText: string | null
  altAnswers: string[]
  modelAnswer: string | null
  explanation: string | null
  language: 'bm' | 'en'
  scriptType: 'rumi' | 'arab' | 'jawi' | 'mixed'
  textDirection: 'ltr' | 'rtl'
  pointsValue: number
  difficultyLevel: number
}

export function languageToStore(language: 'bm' | 'en' | undefined, script: 'rumi' | 'arab' | 'jawi' | 'mixed' | undefined): QuestionVersionRecord['language'] {
  if (script === 'jawi') return 'jawi'
  if (script === 'arab') return 'ar'
  if (script === 'mixed') return 'ms_en'
  return language === 'en' ? 'en' : 'ms'
}

export const scriptOf = (l: QuestionVersionRecord['language']): FlatFields['scriptType'] =>
  l === 'jawi' ? 'jawi' : l === 'ar' ? 'arab' : l === 'ms_en' ? 'mixed' : 'rumi'

export const flatLanguageOf = (l: QuestionVersionRecord['language']): 'bm' | 'en' => (l === 'en' ? 'en' : 'bm')
export const directionOf = (l: QuestionVersionRecord['language']): 'ltr' | 'rtl' => (l === 'ar' || l === 'jawi' ? 'rtl' : 'ltr')

const firstText = (parts: readonly QuestionPart[]): string => {
  const [p] = parts
  return p === undefined ? '' : p.prompt.ms
}

/** The flat fields of a stored version (admin / owner view: carries the key). */
export function flatFromVersion(v: QuestionVersionRecord): FlatFields {
  const parts = v.parts
  const only = parts.length === 1 ? parts[0] : undefined
  const leaf = only !== undefined && isLeaf(only) ? only : undefined
  const out: FlatFields = {
    questionType: 'essay',
    questionText: v.stemMs ?? firstText(parts),
    options: null,
    optionImageIds: [],
    correctAnswer: null,
    tfAnswer: null,
    correctAnswerText: null,
    altAnswers: [],
    modelAnswer: null,
    explanation: v.explanationMs,
    language: flatLanguageOf(v.language),
    scriptType: scriptOf(v.language),
    textDirection: directionOf(v.language),
    pointsValue: Math.max(1, totalMarks(parts)),
    difficultyLevel: Math.min(5, Math.max(1, v.difficultyTp ?? 1)),
  }
  if (!leaf) return out
  if (leaf.mode === 'mcq') {
    out.questionType = 'mcq'
    out.options = leaf.options.map((o) => o.body.ms)
    out.optionImageIds = leaf.options.map((o) => o.imageId ?? null)
    const i = leaf.options.findIndex((o) => o.label === leaf.key.correct)
    out.correctAnswer = i >= 0 && i <= 3 ? i : null
  } else if (leaf.mode === 'short_text') {
    const values = leaf.key.values
    const [first = ''] = values
    if (values.length === 1 && leaf.blankCount === undefined && (first === TRUE_VALUE || first === FALSE_VALUE)) {
      out.questionType = 'true_false'
      out.tfAnswer = first === TRUE_VALUE
    } else {
      out.questionType = leaf.blankCount !== undefined && leaf.blankCount >= 1 ? 'fill_blank' : 'short_answer'
      out.correctAnswerText = first
      out.altAnswers = values.slice(1)
    }
  } else if (leaf.mode === 'essay') {
    out.questionType = 'essay'
    const key = leaf.key
    out.modelAnswer = key.kind === 'points' ? (key.modelText ?? key.points[0]?.text?.ms ?? null) : null
  }
  return out
}

/** Wire `sourceType` of the flat shape from the store value (textbook, dskp ... have no v2 source). */
export function wireSourceType(s: StoreSourceType | null): 'textbook' | 'dskp' | 'trial' | 'marking_scheme' | 'ai_generated' | null {
  return s === 'ai_variant' ? 'ai_generated' : null
}

/** Constants for the 7 fields the v2 store does not carry (Appendix B, section 2.2 of the plan). */
export function constantFields(record: QuestionRecord): {
  complianceStatus: 'verified' | 'draft'
  aiVerified: false
  qualityScore: null
  needsDiagram: false
  chapterLabel: null
  aiExplanation: null
  usage: { attempts: 0; correct: 0 }
} {
  return {
    complianceStatus: record.version.status === 'approved' ? 'verified' : 'draft',
    aiVerified: false,
    qualityScore: null,
    needsDiagram: false,
    chapterLabel: null,
    aiExplanation: null,
    usage: { attempts: 0, correct: 0 },
  }
}

// --- learner projection (Q-3) -----------------------------------------------------------------------

/**
 * What a learner may receive. Built field by field (never by spreading the record) and then parsed
 * with `QuestionPublicSchema`, whose part schemas drop `key`. The flat answer fields, explanation,
 * model answer and source never enter the object.
 */
export function toPublic(record: QuestionRecord): PublicQuestion {
  const v = record.version
  const flat = flatFromVersion(v)
  const parts = v.parts.map((p) => QuestionPublicPartSchema.parse(p))
  return QuestionPublicSchema.parse({
    id: record.id,
    questionText: flat.questionText,
    questionType: flat.questionType,
    options: flat.options,
    language: flat.language,
    textDirection: flat.textDirection,
    scriptType: flat.scriptType,
    pointsValue: flat.pointsValue,
    parts,
  })
}

