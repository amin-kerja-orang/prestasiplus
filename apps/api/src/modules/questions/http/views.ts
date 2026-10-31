/**
 * Record to wire mappers of the question routes (BE-09 Part C). Each result is parsed with the
 * contract schema before it is returned, so a drift between the store and the contract fails in the
 * API (500) and never reaches a client. Admin and owner views carry the key by design; there is no
 * student view in this file (learners go through `QuestionsService.getPublicForLearner`).
 */
import {
  QUESTION_WORKFLOW_STATUS_LABELS,
  QuestionDetailSchema,
  QuestionGuruDetailSchema,
  QuestionGuruSummarySchema,
  QuestionRowSchema,
  QuestionSchema,
  QuestionStimulusGroupSchema,
  QuestionStimulusTableSchema,
  QuestionStructuredDetailSchema,
  QuestionStructuredRowSchema,
  type QuestionPart,
  type QuestionStatus,
} from '@pp/contract'
import type { z } from 'zod'

import { toMytTimestamp } from '../../../common/time/myt'
import { isLeaf, type QuestionLeaf } from '../grading'
import { constantFields, difficultyLabelOf, flatFromVersion, kertasOfPaperCode, wireSourceType } from '../projection'
import { dskpCompleteness } from '../dskp-gate'
import { stimulusTableOf } from '../stimulus-table'
import type { QuestionDetailView, QuestionView, StimulusGroupRecord } from '../types'

export type QuestionRow = z.output<typeof QuestionRowSchema>
export type QuestionWire = z.output<typeof QuestionSchema>
export type QuestionDetailWire = z.output<typeof QuestionDetailSchema>

/** BM label of a lifecycle code (Draf, Semakan, Diterbitkan, Diarkib). */
export const statusLabel = (status: QuestionStatus): string => QUESTION_WORKFLOW_STATUS_LABELS[status]

/** Id of a row whose creator account was removed: the wire needs an id, so a fixed placeholder. */
const NO_CREATOR = '0'

const flatOf = (q: QuestionView) => flatFromVersion(q.version)

/** Public token of an image file (what `POST /files` returned); the internal id when no token is known. */
const imageOf = (q: QuestionView, id: string | null | undefined): string | null => (id ? (q.imageTokens?.[id] ?? id) : null)
const imagesOf = (q: QuestionView, f: ReturnType<typeof flatOf>): (string | null)[] => (f.options === null ? [] : f.optionImageIds.map((id) => imageOf(q, id)))

/** The part tree with each option picture named by its public token (what `POST /files` returned), like the flat `optionImages`. */
function partsOf(q: QuestionView): QuestionPart[] {
  const tokens = q.imageTokens
  if (!tokens || Object.keys(tokens).length === 0) return q.version.parts
  const swap = (list: readonly QuestionPart[]): QuestionPart[] =>
    list.map((part) => {
      if (!isLeaf(part)) return { ...part, children: swap(part.children as QuestionPart[]) } as QuestionPart
      if (part.mode !== 'mcq' && part.mode !== 'pksk_choice') return part
      return { ...part, options: part.options.map((o) => (o.imageId ? { ...o, imageId: tokens[o.imageId] ?? o.imageId } : o)) } as QuestionPart
    })
  return swap(q.version.parts)
}

/** The flat objective shape both the admin and the Guru views build on. */
function flatBase(q: QuestionView) {
  const v = q.version
  const f = flatOf(q)
  const c = constantFields(q)
  return {
    id: q.id,
    subjectId: v.subjectId,
    educationLevelId: v.educationLevelId,
    difficultyLevel: f.difficultyLevel,
    questionType: f.questionType,
    questionText: f.questionText,
    // The stem image is the version's first image stimulus (file id); option images are ids on the options.
    questionImage: imageOf(q, q.version.stemImageId),
    options: f.options,
    optionImages: imagesOf(q, f),
    correctAnswer: f.correctAnswer,
    tfAnswer: f.tfAnswer,
    correctAnswerText: f.correctAnswerText,
    altAnswers: f.altAnswers,
    modelAnswer: f.modelAnswer,
    explanation: f.explanation,
    kertas: kertasOfPaperCode(q.version.paperCode),
    aiExplanation: c.aiExplanation,
    language: f.language,
    pointsValue: f.pointsValue,
    status: v.status,
    isActive: q.isActive,
    complianceStatus: c.complianceStatus,
    aiVerified: c.aiVerified,
    sourceType: wireSourceType(q.sourceType),
    sourceFile: v.sourceFile,
    sourcePage: v.sourcePage,
    sourceSet: v.setLabel,
    qualityScore: c.qualityScore,
    needsDiagram: c.needsDiagram,
    spmPool: q.spmPool,
    dskpSpId: v.spIds[0] ?? null,
    curriculumChapterId: v.chapterId,
    curriculumTopicId: v.topicId,
    chapterLabel: q.chapterName ?? c.chapterLabel,
    scriptType: f.scriptType,
    textDirection: f.textDirection,
    createdAt: toMytTimestamp(q.createdAt),
    updatedAt: toMytTimestamp(q.updatedAt),
    usage: c.usage,
    parts: partsOf(q),
    numberLabel: v.numberLabel,
    tag: { unitId: v.unitId, spIds: v.spIds, tp: v.difficultyTp },
    kbat: v.kbat,
    tagReview: v.tagReview,
    catalogueVersion: v.catalogueVersion,
  }
}

/**
 * `tokens` maps an internal file id to its public token (the wire names a file by the token `POST /files` returned, the same
 * form the stimulus routes answer with). An id with no token stays as stored.
 */
export function stimulusGroupView(g: StimulusGroupRecord, tokens: Record<string, string> = {}): z.output<typeof QuestionStimulusGroupSchema> {
  return QuestionStimulusGroupSchema.parse({
    id: g.id,
    stimuli: g.stimuli.map((s) => ({
      id: s.id,
      kind: s.kind,
      label: s.label,
      body: s.bodyMs === null && s.bodyEn === null ? null : { ms: s.bodyMs ?? s.bodyEn ?? '', ...(s.bodyEn === null || s.bodyMs === null ? {} : { en: s.bodyEn }) },
      imageId: s.assetFileId === null ? null : (tokens[s.assetFileId] ?? s.assetFileId),
      alt: s.alt,
      ...(s.caption ? { caption: s.caption } : {}),
      ...(s.sourceCitation ? { sourceCitation: s.sourceCitation } : {}),
      ...(s.kind === 'table' && stimulusTableOf(s.tableData) ? { tableData: QuestionStimulusTableSchema.parse(stimulusTableOf(s.tableData)) } : {}),
    })),
    ...(g.optionBank.length === 0
      ? {}
      : { optionBank: g.optionBank.map((o) => ({ label: o.label, body: { ms: o.bodyMs ?? o.bodyEn ?? o.label, ...(o.bodyEn === null || o.bodyMs === null ? {} : { en: o.bodyEn }) } })) }),
    questionIds: g.questionIds,
  })
}

// --- admin ---------------------------------------------------------------------------------------

/** R1-B05: DSKP completeness of the question as the admin sees it (the latest version): unit, SP and a TP and cognitive level on every leaf. */
const dskpOf = (q: QuestionView) =>
  dskpCompleteness({ parts: q.version.parts, tp: q.version.difficultyTp, unitId: q.version.unitId, spIds: q.version.spIds })

export function rowView(q: QuestionView): QuestionRow {
  const f = flatOf(q)
  const c = constantFields(q)
  return QuestionRowSchema.parse({
    id: q.id,
    questionText: f.questionText,
    subject: q.subject,
    level: q.level,
    difficultyLevel: f.difficultyLevel,
    status: q.version.status,
    isActive: q.isActive,
    complianceStatus: c.complianceStatus,
    aiVerified: c.aiVerified,
    dskpTagged: q.version.spIds.length > 0,
    dskpComplete: dskpOf(q).complete,
    sourceType: wireSourceType(q.sourceType),
    sourceFile: q.version.sourceFile,
  })
}

export function questionView(q: QuestionView): QuestionWire {
  return QuestionSchema.parse({ ...flatBase(q), createdBy: q.createdById ?? NO_CREATOR })
}

export function detailView(d: QuestionDetailView): QuestionDetailWire {
  const { parts: _parts, ...base } = flatBase(d)
  void _parts
  return QuestionDetailSchema.parse({
    ...base,
    parts: partsOf(d),
    ...(d.stimulusGroup === null ? { stimulusGroup: null } : { stimulusGroup: stimulusGroupView(d.stimulusGroup, d.imageTokens) }),
    subject: d.subject,
    level: d.level,
    dskp: d.dskp,
    dskpStatus: dskpOf(d),
    createdBy: { id: d.createdById ?? NO_CREATOR, name: d.createdByName },
  })
}

// --- Guru (owner) --------------------------------------------------------------------------------

export function guruSummaryView(q: QuestionView): z.output<typeof QuestionGuruSummarySchema> {
  const f = flatOf(q)
  const v = q.version
  return QuestionGuruSummarySchema.parse({
    id: q.id,
    questionType: f.questionType,
    questionText: f.questionText,
    subjectId: v.subjectId,
    subjectName: q.subject?.name ?? '',
    educationLevelId: v.educationLevelId,
    levelName: q.level?.name ?? '',
    difficultyLevel: f.difficultyLevel,
    difficultyLabel: difficultyLabelOf(f.difficultyLevel),
    dskpTagged: v.spIds.length > 0,
    status: v.status,
    statusLabel: statusLabel(v.status),
    isActive: q.isActive,
    options: f.options,
    correctAnswer: f.correctAnswer,
    explanation: f.explanation,
    source: v.sourceFile,
    createdAt: toMytTimestamp(q.createdAt),
  })
}

export function guruDetailView(q: QuestionView): z.output<typeof QuestionGuruDetailSchema> {
  const f = flatOf(q)
  const v = q.version
  const c = constantFields(q)
  return QuestionGuruDetailSchema.parse({
    ...guruSummaryView(q),
    questionImage: imageOf(q, q.version.stemImageId),
    optionImages: imagesOf(q, f),
    tfAnswer: f.tfAnswer,
    correctAnswerText: f.correctAnswerText,
    altAnswers: f.altAnswers,
    modelAnswer: f.modelAnswer,
    language: f.language,
    scriptType: f.scriptType,
    textDirection: f.textDirection,
    curriculumChapterId: v.chapterId,
    curriculumTopicId: v.topicId,
    dskpSpId: v.spIds[0] ?? null,
    usage: { attempts: c.usage.attempts, correct: c.usage.correct, accuracy: 0 },
  })
}

// --- structured ----------------------------------------------------------------------------------

/** `kbatLevel` is the cognitive level when it is 4 or more, else 0 (plan Q-12e). */
const kbatOf = (q: QuestionView): number => {
  const level = q.version.cognitiveLevel
  return level !== null && level >= 4 ? level : 0
}

const countLeaves = (parts: readonly QuestionPart[]): number =>
  parts.reduce((n, p) => n + (isLeaf(p) ? 1 : countLeaves(p.children as QuestionPart[])), 0)

const marksOf = (parts: readonly QuestionPart[]): number =>
  parts.reduce((n, p) => n + (isLeaf(p) ? p.marks : marksOf(p.children as QuestionPart[])), 0)

const EXCERPT = 120
const excerpt = (text: string): string => (text.length <= EXCERPT ? text : `${text.slice(0, EXCERPT - 1)}…`)

export function structuredRowView(q: QuestionView): z.output<typeof QuestionStructuredRowSchema> {
  const parts = q.version.parts
  return QuestionStructuredRowSchema.parse({
    id: q.id,
    stimulusExcerpt: excerpt(q.version.stemMs ?? parts[0]?.prompt.ms ?? ''),
    subject: q.subject,
    level: q.level,
    kbatLevel: kbatOf(q),
    totalMarks: marksOf(parts),
    subCount: countLeaves(parts),
  })
}

function modelAnswerOf(leaf: QuestionLeaf): string {
  const key = leaf.key as { kind: string; correct?: string; values?: unknown[]; modelText?: string; points?: { text?: { ms: string } }[] }
  if (key.kind === 'option') return key.correct ?? ''
  if (key.kind === 'accepted') {
    const [first] = key.values ?? []
    return typeof first === 'string' ? first : typeof first === 'object' && first !== null ? String((first as { v?: unknown }).v ?? '') : ''
  }
  if (key.kind === 'points') return key.modelText ?? key.points?.[0]?.text?.ms ?? ''
  return ''
}

interface Sub {
  id: string
  structuredQuestionId: string
  partLabel: string
  questionText: string
  marks: number
  answerType: 'text' | 'numeric'
  expectedNumeric: number | null
  numericTolerance: number | null
  rubrics: { konstruk: string; keyword: string; marks: number }[]
  modelAnswer: string
  parentSubId: string | null
  order: number
}

/** The part tree flattened depth first: one entry per part, branches included (marks 0). */
function flatten(questionId: string, parts: readonly QuestionPart[]): Sub[] {
  const out: Sub[] = []
  const walk = (list: readonly QuestionPart[], parent: Sub | null, path: readonly string[]): void => {
    for (const part of list) {
      const labels = [...path, part.label]
      const sub: Sub = {
        id: `${questionId}-${labels.join('.')}`,
        structuredQuestionId: questionId,
        partLabel: labels.join('.'),
        questionText: part.prompt.ms,
        marks: 0,
        answerType: 'text',
        expectedNumeric: null,
        numericTolerance: null,
        rubrics: [],
        modelAnswer: '',
        parentSubId: parent?.id ?? null,
        order: out.length + 1,
      }
      out.push(sub)
      if (isLeaf(part)) {
        sub.marks = part.marks
        sub.modelAnswer = modelAnswerOf(part)
        if (part.mode === 'numeric') {
          const first = part.key.values[0]
          sub.answerType = 'numeric'
          sub.expectedNumeric = first?.v ?? null
          sub.numericTolerance = first?.tol ?? null
        }
        if (part.key.kind === 'points') {
          sub.rubrics = part.key.points.map((p) => ({ konstruk: p.code, keyword: p.label, marks: p.marks }))
        }
      } else {
        walk(part.children as QuestionPart[], sub, labels)
      }
    }
  }
  walk(parts, null, [])
  return out
}

export function structuredDetailView(d: QuestionDetailView): z.output<typeof QuestionStructuredDetailSchema> {
  const v = d.version
  const c = constantFields(d)
  const number = v.numberLabel !== null && /^\d{1,9}$/.test(v.numberLabel) ? Number(v.numberLabel) : null
  return QuestionStructuredDetailSchema.parse({
    id: d.id,
    subjectId: v.subjectId ?? '0',
    educationLevelId: v.educationLevelId ?? '0',
    subject: d.subject,
    level: d.level,
    kbatLevel: kbatOf(d),
    status: v.status,
    isActive: d.isActive,
    needsDiagram: c.needsDiagram,
    estimatedMinutes: marksOf(v.parts),
    isTrial: false,
    topic: null,
    questionNumber: number,
    stimulus: v.stemMs ?? '',
    stimulusImage: null,
    totalMarks: marksOf(v.parts),
    visibility: 'public',
    complianceStatus: c.complianceStatus,
    sourceFile: v.sourceFile,
    sourcePage: v.sourcePage,
    sourceSet: v.setLabel,
    curriculumChapterId: v.chapterId,
    curriculumTopicId: v.topicId,
    dskpSpId: v.spIds[0] ?? null,
    scriptType: flatOf(d).scriptType,
    textDirection: flatOf(d).textDirection,
    questionTemplate: null,
    subQuestions: flatten(d.id, v.parts),
    createdBy: { id: d.createdById ?? NO_CREATOR, name: d.createdByName },
    createdAt: toMytTimestamp(d.createdAt),
    updatedAt: toMytTimestamp(d.updatedAt),
  })
}
