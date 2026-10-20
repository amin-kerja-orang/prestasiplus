import { Inject, Injectable } from '@nestjs/common'

import { idToString } from '../../../../db/ids'
import { CurriculumRepository, type TopicProgress, type TopicProgressProvider } from '../../../curriculum'
import { gradeOfCode, PRACTICE_CODE } from '../../../curriculum/rules'
import type { LegacySubjectCode } from '../../../curriculum/types'
import { OverviewRepository } from './overview.repository'
import { topicProgressPercent } from './rules'

/**
 * M03 topic progress (BR-19, DATA-M03-07), derived on read from the answer log's dimension columns. Registered
 * with `CurriculumPorts.provideTopicProgress` in `PracticeOverviewReadsModule.onModuleInit`.
 *
 * The k-th learner topic of a subject + grade is the k-th chapter of the matching subject (BR-16 code) and
 * level (BR-17 grade), in BR-08 order. Its figures are every answer row whose `chapter_id` is that chapter:
 * `questionsAnswered` = rows, `sessions` = distinct sessions, `progress` = min(100, round(100 x correct / 20)).
 * No join to `questions`, so a historical row without a question link counts the same (card AC2). The
 * island states (BR-14) are computed by M03 from these numbers.
 */
@Injectable()
export class OverviewTopicProgress implements TopicProgressProvider {
  constructor(
    @Inject(OverviewRepository) private readonly repo: OverviewRepository,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
  ) {}

  async topicProgress(userId: string): Promise<ReadonlyMap<string, TopicProgress>> {
    const totals = await this.repo.chapterTotals(userId)
    const out = new Map<string, TopicProgress>()
    if (totals.size === 0) return out

    const topics = await this.curriculum.legacyTopics()
    const groups = new Map<string, { subject: string; grade: string; ids: string[] }>()
    for (const t of topics) {
      const key = `${t.subject}|${t.gradeLevel}`
      const group = groups.get(key)
      if (group) group.ids.push(idToString(t.id))
      else groups.set(key, { subject: t.subject, grade: t.gradeLevel, ids: [idToString(t.id)] })
    }

    // Every (subject, grade) group is resolved in parallel; subject and level lookups are shared by code and grade.
    const subjects = new Map<string, ReturnType<CurriculumRepository['subjectByCode']>>()
    const levels = new Map<number, ReturnType<CurriculumRepository['levelForGrade']>>()
    const once = <K, V>(cache: Map<K, V>, key: K, load: () => V): V => {
      if (!cache.has(key)) cache.set(key, load())
      return cache.get(key) as V
    }
    await Promise.all(
      [...groups.values()].map(async (g) => {
        const practiceCode = PRACTICE_CODE[g.subject as LegacySubjectCode]
        const grade = gradeOfCode(g.grade)
        if (practiceCode === undefined || grade === null) return
        const [subject, level] = await Promise.all([
          once(subjects, practiceCode, () => this.curriculum.subjectByCode(practiceCode)),
          once(levels, grade, () => this.curriculum.levelForGrade(grade)),
        ])
        if (!subject || !level) return
        const chapters = await this.curriculum.chapters(subject.id, level.id)
        g.ids.forEach((topicId, k) => {
          const chapter = chapters[k]
          const stats = chapter ? totals.get(idToString(chapter.id)) : undefined
          if (!stats) return
          out.set(topicId, { sessions: stats.sessions, questionsAnswered: stats.answered, progress: topicProgressPercent(stats.correct) })
        })
      }),
    )
    return out
  }
}
