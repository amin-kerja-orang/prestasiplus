import { Inject, Injectable } from '@nestjs/common'
import { CURRICULUM_NOT_FOUND_MESSAGES as NF, type CurriculumLearningMap } from '@pp/contract'

import { idToString } from '../../db/ids'
import type { OfferedLevel } from '../practice/rules'
import { CurriculumRepository, type LearnerChapter } from './curriculum.repository'
import { notFound } from './errors'
import { CurriculumPorts, progressOf } from './providers'
import {
  DEFAULT_MAP_GRADE,
  DEFAULT_MAP_SUBJECT,
  MAP_SUBJECTS,
  GRADE_CODES,
  PRACTICE_CODE,
  islandStates,
  legacySubjectOfPracticeCode,
  mapSubjectLabel,
  subjectLabelOf,
} from './rules'
import type { EducationLevelLookup, GradeCode, LearnerTopicDetail, LegacySubjectCode, SubjectLookup, TopicCard } from './types'
import { parseId } from './validation'

const PREVIEW_MAX = 3

/** Learner reads: lookups, the topic catalogue (S12, S13) and Peta Belajar (S14). Any session. */
@Injectable()
export class CurriculumLearnerService {
  constructor(
    @Inject(CurriculumRepository) private readonly repo: CurriculumRepository,
    @Inject(CurriculumPorts) private readonly ports: CurriculumPorts,
  ) {}

  async educationLevels(): Promise<EducationLevelLookup[]> {
    return (await this.repo.levels({ active: true })).map((l) => ({
      id: idToString(l.id),
      code: l.code,
      name: l.name,
      nameEn: l.nameEn,
      stage: l.stage as EducationLevelLookup['stage'],
      grade: l.grade,
    }))
  }

  /** A non-numeric or unknown `educationLevelId` is ignored (no filter), SRS #28. */
  async subjects(educationLevelId: string | undefined): Promise<SubjectLookup[]> {
    const parsed = educationLevelId === undefined ? null : parseId(educationLevelId)
    const level = parsed === null ? null : await this.repo.level(parsed)
    const rows = await this.repo.subjects({ active: true, ...(level ? { educationLevelId: level.id } : {}) })
    return rows.map((s) => ({
      id: idToString(s.id),
      code: s.code,
      name: s.name,
      nameEn: s.nameEn,
      icon: s.icon,
      color: s.color,
      isCore: s.isCore,
      educationLevelIds: s.educationLevelIds.map(idToString),
    }))
  }

  /**
   * The Topik / Peta Belajar rows are the tree chapters (S4-T06, DM-16): learner topic = chapter, learner subtopic = a topic of the
   * chapter. The offered levels are read per call (`offeredLevels`, DM-20), so Tingkatan 1 to 5 are served on the same rule.
   * `gradeKey` is the grade code; a level whose key is not a known grade code is skipped.
   */
  private async gradeLevels(): Promise<(OfferedLevel & { gradeKey: GradeCode })[]> {
    const offered = await this.repo.offeredLevels()
    return offered.filter((l): l is OfferedLevel & { gradeKey: GradeCode } => (GRADE_CODES as readonly string[]).includes(l.gradeKey))
  }

  /** A chapter whose subject is outside the 8 legacy codes cannot be shown in the unchanged contract (`subject` enum): it is not served. */
  private legacySubject(c: LearnerChapter): LegacySubjectCode | undefined {
    return legacySubjectOfPracticeCode(c.subject.code)
  }

  private card(c: LearnerChapter, grade: GradeCode, subject: LegacySubjectCode, subs: { name: string }[]): TopicCard {
    return {
      id: idToString(c.id),
      gradeLevel: grade,
      subject,
      subjectLabel: subjectLabelOf(subject),
      name: c.name ?? '',
      description: c.description,
      subtopicCount: subs.length,
      subtopicsPreview: subs.slice(0, PREVIEW_MAX).map((s) => s.name),
    }
  }

  /** Chapters of the levels in `levels` (optionally one grade and one subject code), only those with a legacy subject code. */
  private async learnerRows(
    levels: (OfferedLevel & { gradeKey: GradeCode })[],
    subjectCode: string | null,
  ): Promise<{ chapter: LearnerChapter; grade: GradeCode; subject: LegacySubjectCode }[]> {
    let practiceCodes: string[] | undefined
    if (subjectCode) {
      const code = PRACTICE_CODE[subjectCode as LegacySubjectCode]
      if (code === undefined) return [] // an unknown subject code matches nothing (BR-13)
      practiceCodes = [code]
    }
    const chapters = await this.repo.learnerChapters({ levelIds: levels.map((l) => BigInt(l.id)), ...(practiceCodes ? { subjectCodes: practiceCodes } : {}) })
    const gradeOf = new Map(levels.map((l) => [l.id, l.gradeKey]))
    const out: { chapter: LearnerChapter; grade: GradeCode; subject: LegacySubjectCode }[] = []
    for (const chapter of chapters) {
      const subject = this.legacySubject(chapter)
      const grade = gradeOf.get(idToString(chapter.educationLevelId as bigint))
      if (subject && grade) out.push({ chapter, grade, subject })
    }
    return out
  }

  async topics(query: { gradeLevel?: string | undefined; subject?: string | undefined }): Promise<TopicCard[]> {
    const all = await this.gradeLevels()
    // An allow-list: no grade asked is every offered grade; a grade outside it matches nothing (BR-13, case-insensitive).
    const levels = query.gradeLevel ? all.filter((l) => l.gradeKey === query.gradeLevel!.toUpperCase()) : all
    const rows = await this.learnerRows(levels, query.subject ? query.subject.toUpperCase() : null)
    const subs = await this.repo.activeTopicsByChapter(rows.map((r) => r.chapter.id))
    return rows.map((r) => this.card(r.chapter, r.grade, r.subject, subs.get(r.chapter.id) ?? []))
  }

  async topic(rawId: string, userId: string): Promise<LearnerTopicDetail> {
    const id = parseId(rawId)
    const levels = await this.gradeLevels()
    const chapter = id === null ? null : await this.repo.learnerChapter(id, levels.map((l) => BigInt(l.id)))
    const subject = chapter ? this.legacySubject(chapter) : undefined
    const grade = chapter ? levels.find((l) => l.id === idToString(chapter.educationLevelId as bigint))?.gradeKey : undefined
    if (!chapter || !subject || !grade) throw notFound(NF.topic)
    const [subs, map] = await Promise.all([this.repo.activeTopicsByChapter([chapter.id]), this.ports.topicProgress.topicProgress(userId)])
    const p = progressOf(map, idToString(chapter.id))
    return {
      id: idToString(chapter.id),
      gradeLevel: grade,
      subject,
      subjectLabel: subjectLabelOf(subject),
      practiceCode: PRACTICE_CODE[subject],
      name: chapter.name ?? '',
      description: chapter.description,
      icon: null, // chapters have no icon
      sequence: chapter.chapterNumber ?? 0,
      // BR-19: no subtopic tagging exists, so every subtopic bar shows the topic progress.
      subtopics: (subs.get(chapter.id) ?? []).map((s) => ({
        id: idToString(s.id),
        name: s.name,
        description: s.description,
        progress: p.progress,
      })),
      progress: { questionsAnswered: p.questionsAnswered, progress: p.progress },
    }
  }

  /** FR-84 / BR-15: an empty subject is the default, an unknown code is kept as typed; the grade is one of the offered grades (`offeredLevels`), anything else (Darjah included) is TINGKATAN_4 (secondary-only, D72). */
  async learningMap(query: { subject?: string | undefined; grade?: string | undefined }, userId: string): Promise<CurriculumLearningMap> {
    const subject = query.subject || DEFAULT_MAP_SUBJECT
    const levels = await this.gradeLevels()
    const gradeOptions = levels.map((l) => l.gradeKey as string)
    const grade = gradeOptions.includes(query.grade as string) ? (query.grade as string) : DEFAULT_MAP_GRADE
    // The filter is exact (S14 keeps exact codes: a typed lower-case code is unknown).
    const rows = await this.learnerRows(levels.filter((l) => l.gradeKey === grade), subject)
    const map = await this.ports.topicProgress.topicProgress(userId)
    const progress = rows.map((r) => progressOf(map, idToString(r.chapter.id)))
    const states = islandStates(progress)
    const topics = rows.map((r, i) => {
      const p = progress[i]!
      const state = states[i]!
      return {
        id: idToString(r.chapter.id),
        name: r.chapter.name ?? '',
        icon: null, // chapters have no icon
        state,
        progress: p.progress,
        sessions: p.sessions,
        questionsAnswered: p.questionsAnswered,
        practiceUrl: `/practice?topic_id=${idToString(r.chapter.id)}`, // REQ-C-021: no island is locked
      }
    })
    const done = states.filter((s) => s === 'mastered').length
    const average = progress.length ? Math.round(progress.reduce((sum, p) => sum + p.progress, 0) / progress.length) : 0
    return {
      subject,
      subjectLabel: mapSubjectLabel(subject),
      grade,
      gradeOptions,
      subjects: MAP_SUBJECTS.map((s) => ({ ...s })),
      stats: { done, total: rows.length, progress: average },
      topics,
    }
  }
}
