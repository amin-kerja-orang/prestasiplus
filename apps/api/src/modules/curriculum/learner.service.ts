import { Inject, Injectable } from '@nestjs/common'
import { CURRICULUM_NOT_FOUND_MESSAGES as NF, type CurriculumLearningMap } from '@pp/contract'

import { idToString } from '../../db/ids'
import { CurriculumRepository, type LegacyTopic } from './curriculum.repository'
import { notFound } from './errors'
import { CurriculumPorts, progressOf } from './providers'
import {
  DEFAULT_MAP_GRADE,
  DEFAULT_MAP_SUBJECT,
  MAP_GRADES,
  MAP_SUBJECTS,
  PRACTICE_CODE,
  islandStates,
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

  private card(t: LegacyTopic, subtopics: { name: string }[]): TopicCard {
    return {
      id: idToString(t.id),
      gradeLevel: t.gradeLevel as GradeCode,
      subject: t.subject as LegacySubjectCode,
      subjectLabel: subjectLabelOf(t.subject),
      name: t.name,
      description: t.description,
      subtopicCount: subtopics.length,
      subtopicsPreview: subtopics.slice(0, PREVIEW_MAX).map((s) => s.name),
    }
  }

  async topics(query: { gradeLevel?: string | undefined; subject?: string | undefined }): Promise<TopicCard[]> {
    const rows = await this.repo.legacyTopics({ gradeLevel: query.gradeLevel ?? null, subject: query.subject ?? null })
    const subs = await this.repo.legacySubtopicsByTopic(rows.map((r) => r.id))
    return rows.map((t) => this.card(t, subs.get(t.id) ?? []))
  }

  async topic(rawId: string, userId: string): Promise<LearnerTopicDetail> {
    const id = parseId(rawId)
    const topic = id === null ? null : await this.repo.legacyTopic(id)
    if (!topic) throw notFound(NF.topic)
    const [subs, map] = await Promise.all([this.repo.legacySubtopicsByTopic([topic.id]), this.ports.topicProgress.topicProgress(userId)])
    const p = progressOf(map, idToString(topic.id))
    return {
      id: idToString(topic.id),
      gradeLevel: topic.gradeLevel as GradeCode,
      subject: topic.subject as LegacySubjectCode,
      subjectLabel: subjectLabelOf(topic.subject),
      practiceCode: PRACTICE_CODE[topic.subject as LegacySubjectCode],
      name: topic.name,
      description: topic.description,
      icon: topic.icon,
      sequence: topic.sequence,
      // BR-19: no subtopic tagging exists, so every subtopic bar shows the topic progress.
      subtopics: (subs.get(topic.id) ?? []).map((s) => ({
        id: idToString(s.id),
        name: s.name,
        description: s.description,
        progress: p.progress,
      })),
      progress: { questionsAnswered: p.questionsAnswered, progress: p.progress },
    }
  }

  /** FR-84 / BR-15: an empty subject is the default, an unknown code is kept as typed; the grade is DARJAH_1..4 or DARJAH_4. */
  async learningMap(query: { subject?: string | undefined; grade?: string | undefined }, userId: string): Promise<CurriculumLearningMap> {
    const subject = query.subject || DEFAULT_MAP_SUBJECT
    const grade = (MAP_GRADES as readonly (string | undefined)[]).includes(query.grade) ? (query.grade as string) : DEFAULT_MAP_GRADE
    const [found, map] = await Promise.all([
      this.repo.legacyTopics({ gradeLevel: grade, subject }),
      this.ports.topicProgress.topicProgress(userId),
    ])
    // The filter is case-insensitive (BR-13); S14 keeps exact codes (a typed lower-case code is unknown).
    const rows = found.filter((t) => t.subject === subject)
    const progress = rows.map((t) => progressOf(map, idToString(t.id)))
    const states = islandStates(progress)
    const topics = rows.map((t, i) => {
      const p = progress[i]!
      const state = states[i]!
      return {
        id: idToString(t.id),
        name: t.name,
        icon: t.icon,
        state,
        progress: p.progress,
        sessions: p.sessions,
        questionsAnswered: p.questionsAnswered,
        practiceUrl: state === 'locked' ? null : `/practice?topic_id=${idToString(t.id)}`,
      }
    })
    const done = states.filter((s) => s === 'mastered').length
    const average = progress.length ? Math.round(progress.reduce((sum, p) => sum + p.progress, 0) / progress.length) : 0
    return {
      subject,
      subjectLabel: mapSubjectLabel(subject),
      grade,
      gradeOptions: [...MAP_GRADES],
      subjects: MAP_SUBJECTS.map((s) => ({ ...s })),
      stats: { done, total: rows.length, progress: average },
      topics,
    }
  }
}
