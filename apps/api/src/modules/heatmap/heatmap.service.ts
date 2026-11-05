import { Inject, Injectable } from '@nestjs/common'
import type { HeatmapResponse } from '@pp/contract'

import { idFromString, idToString } from '../../db/ids'
import { CurriculumRepository } from '../curriculum'
import { buildHeatmap } from './heatmap.rules'
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
    const rows = await this.ports.answerCounts.chapterAnswerCounts(who.userId, who.isTest)
    if (rows.length === 0) return { subjects: [] }
    const attempted = await this.curriculum.chaptersByIds(
      rows.map((r) => idFromString(r.chapterId)),
    )
    if (attempted.length === 0) return { subjects: [] }
    const subjectIds = [...new Set(attempted.map((c) => c.subjectId))]
    const [chapters, subjects] = await Promise.all([
      this.curriculum.chaptersOfSubjectsInForms(subjectIds),
      this.curriculum.subjects(),
    ])
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
        })),
        subjects.map((s) => ({ id: idToString(s.id), name: s.name, isCore: s.isCore })),
      ),
    }
  }
}
