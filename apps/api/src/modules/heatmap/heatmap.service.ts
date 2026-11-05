import { Inject, Injectable } from '@nestjs/common'
import type { HeatmapResponse } from '@pp/contract'

import { idFromString, idToString } from '../../db/ids'
import { CurriculumRepository } from '../curriculum'
import type { HeatmapSpNode } from '../curriculum/curriculum.repository'
import { buildHeatmap, levelKey, type HeatmapSpRef } from './heatmap.rules'
import { HeatmapPorts } from './ports'

/** The caller of the heatmap: always the session user (no user parameter exists), in the request's mode. */
export interface HeatmapCaller {
  userId: string
  /** Mod Pelajar is on: the caller's own `is_test` rows are read instead of the real ones. */
  isTest: boolean
}

/**
 * M25 Heatmap Topik Lemah (BE-48, API-DSKP-08 by S10-T05). Computed on every request from the caller's answer
 * counts (port) and the curriculum (`CurriculumRepository`); no table, no cache, no AI call (D12, G-15,
 * BR-M25-12).
 */
@Injectable()
export class HeatmapService {
  constructor(
    @Inject(HeatmapPorts) private readonly ports: HeatmapPorts,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
  ) {}

  async forCaller(who: HeatmapCaller): Promise<HeatmapResponse['data']> {
    const [rows, questionRows] = await Promise.all([
      this.ports.answerCounts.chapterAnswerCounts(who.userId, who.isTest),
      this.ports.answerCounts.questionAnswerCounts(who.userId, who.isTest),
    ])
    if (rows.length === 0 && questionRows.length === 0) return { subjects: [] }
    const [attempted, spByQuestion] = await Promise.all([
      rows.length === 0 ? [] : this.curriculum.chaptersByIds(rows.map((r) => idFromString(r.chapterId))),
      questionRows.length === 0
        ? new Map<bigint, HeatmapSpNode[]>()
        : this.curriculum.spNodesOfQuestions(questionRows.map((r) => idFromString(r.questionId))),
    ])
    const subjectIds = [
      ...new Set([...attempted.map((c) => c.subjectId), ...[...spByQuestion.values()].flat().map((n) => n.subjectId)]),
    ]
    if (subjectIds.length === 0) return { subjects: [] }
    const [chapters, subjects, babLevels, approvedSp] = await Promise.all([
      this.curriculum.chaptersOfSubjectsInForms(subjectIds),
      this.curriculum.subjects({ active: true }),
      this.curriculum.subjectLevelsWithBab(subjectIds),
      this.curriculum.spNodesOfApprovedQuestions(subjectIds),
    ])
    const spRef = (n: HeatmapSpNode): HeatmapSpRef => ({
      id: idToString(n.id),
      subjectId: idToString(n.subjectId),
      code: n.code,
      title: n.title,
      sortOrder: n.sortOrder,
      levelCode: n.levelCode,
      levelOrder: n.levelOrder,
    })
    const nodesByQuestion = new Map<string, HeatmapSpRef[]>()
    for (const [questionId, nodes] of spByQuestion) nodesByQuestion.set(idToString(questionId), nodes.map(spRef))
    return {
      subjects: buildHeatmap(
        rows,
        attempted.map((c) => ({ id: idToString(c.id), subjectId: idToString(c.subjectId) })),
        chapters.map((c) => ({
          id: idToString(c.id),
          name: c.name,
          subjectId: idToString(c.subjectId),
          number: c.chapterNumber,
          levelOrder: c.levelOrder,
          levelCode: c.levelCode,
        })),
        subjects.map((s) => ({ id: idToString(s.id), code: s.code, name: s.name, isCore: s.isCore })),
        {
          babLevels: new Set(babLevels.map((b) => levelKey(idToString(b.subjectId), b.levelCode))),
          nodes: [...approvedSp.map(spRef), ...[...nodesByQuestion.values()].flat()],
          questionRows,
          nodesByQuestion,
        },
      ),
    }
  }
}
