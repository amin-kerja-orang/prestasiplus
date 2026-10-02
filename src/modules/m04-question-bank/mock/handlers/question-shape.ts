/**
 * Response shaping of the M04 question endpoints (SRS v1.16 §7 #1, #2, #4): the S1 row, the API
 * `Question` (the store row without its internal count facets), the S1 tile icons and the lookups of
 * subject and level names (M03), the creator name (M01) and the DSKP chain (M10).
 */

import { users } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'

import type { DskpStore } from './dskp-source'
import type {
  NamedRef,
  Question as ApiQuestion,
  QuestionDetail,
  QuestionRow,
} from '../../api/questions'
import type { Question } from '../repository/types'

/** SRS §6.10: subject → S1 tile icon (live Font Awesome names; 28–31 `fa-book`). */
const TILE_ICONS: Readonly<Record<number, string>> = {
  1: 'fa-book-open',
  2: 'fa-globe',
  3: 'fa-calculator',
  4: 'fa-flask',
  5: 'fa-clock',
  6: 'fa-moon',
  7: 'fa-heart',
  8: 'fa-square-root-alt',
  9: 'fa-bolt',
  10: 'fa-flask',
  11: 'fa-leaf',
  12: 'fa-map',
  13: 'fa-palette',
  14: 'fa-music',
  15: 'fa-heartbeat',
  16: 'fa-wrench',
  17: 'fa-desktop',
  18: 'fa-language',
  19: 'fa-language',
  20: 'fa-language',
  21: 'fa-receipt',
  22: 'fa-chart-line',
  23: 'fa-briefcase',
  24: 'fa-quran',
  25: 'fa-mosque',
  26: 'fa-pen-nib',
  27: 'fa-scale-balanced',
}

export function tileIcon(subjectId: number): string {
  return TILE_ICONS[subjectId] ?? 'fa-book'
}

/** Names of the M03 subjects and levels (every record, active or not). */
export interface NameMaps {
  subject(id: number | null): NamedRef | null
  level(id: number | null): NamedRef | null
}

export function nameMaps(): NameMaps {
  const subjects = new Map(curriculum.subjects().map((s) => [s.id, s.name]))
  const levels = new Map(curriculum.levels().map((l) => [l.id, l.name]))
  const ref = (map: Map<number, string>, id: number | null): NamedRef | null => {
    if (id === null) return null
    const name = map.get(id)
    return name === undefined ? null : { id, name }
  }
  return { subject: (id) => ref(subjects, id), level: (id) => ref(levels, id) }
}

/** #1 row. */
export function toRow(q: Question, names: NameMaps): QuestionRow {
  return {
    id: q.id,
    questionText: q.questionText,
    subject: names.subject(q.subjectId),
    level: names.level(q.educationLevelId),
    difficultyLevel: q.difficultyLevel,
    status: q.status,
    isActive: q.isActive,
    complianceStatus: q.complianceStatus,
    aiVerified: q.aiVerified,
    dskpTagged: q.dskpTagged,
    sourceType: q.sourceType,
    sourceFile: q.sourceFile,
  }
}

/** The API `Question` (#3, #5 `data`): the store row without its count-only facets. */
export function toQuestion(q: Question): ApiQuestion {
  return {
    id: q.id,
    subjectId: q.subjectId,
    educationLevelId: q.educationLevelId,
    difficultyLevel: q.difficultyLevel,
    questionType: q.questionType,
    questionText: q.questionText,
    questionImage: q.questionImage,
    options: q.options,
    optionImages: q.optionImages,
    correctAnswer: q.correctAnswer,
    tfAnswer: q.tfAnswer,
    correctAnswerText: q.correctAnswerText,
    altAnswers: q.altAnswers,
    modelAnswer: q.modelAnswer,
    explanation: q.explanation,
    aiExplanation: q.aiExplanation,
    language: q.language,
    pointsValue: q.pointsValue,
    status: q.status,
    isActive: q.isActive,
    complianceStatus: q.complianceStatus,
    aiVerified: q.aiVerified,
    sourceType: q.sourceType,
    sourceFile: q.sourceFile,
    sourcePage: q.sourcePage,
    sourceSet: q.sourceSet,
    qualityScore: q.qualityScore,
    needsDiagram: q.needsDiagram,
    spmPool: q.spmPool,
    dskpSpId: q.dskpSpId,
    curriculumChapterId: q.curriculumChapterId,
    curriculumTopicId: q.curriculumTopicId,
    chapterLabel: q.chapterLabel,
    scriptType: q.scriptType,
    textDirection: q.textDirection,
    pkskDomainId: q.pkskDomainId,
    pkskTargetLevel: q.pkskTargetLevel,
    pkskOptions: q.pkskOptions,
    createdBy: q.createdBy,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
    usage: q.usage,
  }
}

/** The DSKP chain of a tagged question (M10 store), `null` when untagged or the SP is unknown. */
export function dskpChainOf(
  spId: number | null,
  dskp: Pick<DskpStore, 'spPath'>,
): QuestionDetail['dskp'] {
  if (spId === null) return null
  const path = dskp.spPath(spId)
  if (!path) return null
  return {
    bidang: { id: path.bidang.id, code: path.bidang.code, name: path.bidang.name },
    sk: { id: path.sk.id, code: path.sk.code, description: path.sk.description },
    sp: { id: path.sp.id, code: path.sp.code, description: path.sp.description },
  }
}

/** #4 `data`. */
export function toDetail(
  q: Question,
  names: NameMaps,
  dskp: Pick<DskpStore, 'spPath'>,
): QuestionDetail {
  const { createdBy, ...rest } = toQuestion(q)
  return {
    ...rest,
    subject: names.subject(q.subjectId),
    level: names.level(q.educationLevelId),
    dskp: dskpChainOf(q.dskpSpId, dskp),
    createdBy: { id: createdBy, name: users.get(createdBy)?.name ?? null },
  }
}
