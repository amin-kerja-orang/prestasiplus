import { Inject, Injectable } from '@nestjs/common'
import { HEATMAP_MIN_ATTEMPTS, type HeatmapResponse } from '@pp/contract'

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
 * M25 Heatmap Topik Lemah (BE-48). Computed on every request from the caller's answer counts (port, BE-12 /
 * BE-13) and the curriculum (BE-08 `CurriculumRepository`); no table, no cache, no AI call (D12, G-15,
 * BR-M25-12).
 */
@Injectable()
export class HeatmapService {
  constructor(
    @Inject(HeatmapPorts) private readonly ports: HeatmapPorts,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
  ) {}

  async forCaller(who: HeatmapCaller): Promise<HeatmapResponse['data']> {
    const rows = await this.ports.answerCounts.chapterAnswerCounts(who.userId, HEATMAP_MIN_ATTEMPTS, who.isTest)
    if (rows.length === 0) return { subjects: [] }
    const chapters = await this.curriculum.chaptersByIds(rows.map((r) => idFromString(r.chapterId)))
    if (chapters.length === 0) return { subjects: [] }
    const subjects = await this.curriculum.subjects()
    return {
      subjects: buildHeatmap(
        rows,
        chapters.map((c) => ({ id: idToString(c.id), name: c.name, subjectId: idToString(c.subjectId) })),
        subjects.map((s) => ({ id: idToString(s.id), name: s.name, sortOrder: s.sortOrder })),
      ),
    }
  }
}
