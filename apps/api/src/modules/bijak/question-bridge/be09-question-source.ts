import { Inject, Injectable, Logger } from '@nestjs/common'

import { idFromString, isIdString } from '../../../db/ids'
import { CurriculumRepository } from '../../curriculum'
import { QuestionsRepository } from '../../questions'
import type { QuestionRecord, StimulusGroupRecord } from '../../questions/types'
import type {
  BijakQuestionBundle,
  BijakQuestionSource as AttemptQuestionSource,
} from '../attempts/ports'
import type { BijakQuestionInfo } from '../papers/ports'
import { bijakCodeOf } from '../papers/subject-codes'
import {
  type Be09QuestionBundle,
  type CurriculumLabels,
  infoOf,
  mapBe09Question,
  UnsupportedQuestionError,
} from './be09-mapping'

/**
 * Bijak question source backed by the BE-09 question bank (M04). It reads ONLY through BE-09's
 * exported `QuestionsRepository` (`getMany(ids, 'live')`, `groupOf`) and BE-08's `CurriculumRepository`
 * (subject code, unit title); it never queries the question tables itself (ADR-0014).
 *
 * - Attempts (BE-16 `BijakQuestionSource.loadQuestions`): the bundle of each id's LIVE version, mapped
 *   by `mapBe09Question`. M7 working assumption: BE-09 has no pinned-version read yet, so a paper is
 *   served and graded with the live version; the bundle records `versionNo` (deviations doc).
 * - Papers (BE-15 `BijakQuestionSource.getMany`): marks, group and live `versionNo` of the same mapped
 *   question, so a question the attempt side cannot serve is also not eligible on the paper side.
 *
 * A question without a published live version is absent. `is_active` is NOT checked: a question placed
 * on a published paper stays servable (the placement is what the paper froze). A question the mapper
 * refuses is absent too, and the refusal is logged with its id, part and reason (never its content).
 */
@Injectable()
export class Be09BijakQuestionSource implements AttemptQuestionSource {
  private readonly logger = new Logger(Be09BijakQuestionSource.name)

  constructor(
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
  ) {}

  async loadQuestions(
    questionIds: readonly string[],
  ): Promise<ReadonlyMap<string, BijakQuestionBundle>> {
    const mapped = await this.load(questionIds)
    return new Map([...mapped].map(([id, m]) => [id, m.bundle]))
  }

  /** BE-15 `getMany`: structure only (never content or keys). */
  async getMany(questionIds: readonly string[]): Promise<ReadonlyMap<string, BijakQuestionInfo>> {
    const mapped = await this.load(questionIds)
    return new Map([...mapped].map(([id, m]) => [id, infoOf(m.bundle, m.groupId)]))
  }

  /** Pinned version numbers of the bundles it would serve (tests, logging). */
  async versionsOf(questionIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    const mapped = await this.load(questionIds)
    return new Map([...mapped].map(([id, m]) => [id, m.bundle.versionNo]))
  }

  private async load(
    questionIds: readonly string[],
  ): Promise<Map<string, { bundle: Be09QuestionBundle; groupId: string | null }>> {
    const ids = [...new Set(questionIds)].filter(isIdString)
    const out = new Map<string, { bundle: Be09QuestionBundle; groupId: string | null }>()
    if (ids.length === 0) return out
    const records = await this.questions.getMany(ids, 'live')
    const groups = new Map<string, StimulusGroupRecord | null>()
    const labels = new Map<string, CurriculumLabels>()
    for (const record of records) {
      if (record.version.status !== 'published') continue
      try {
        const group = await this.groupFor(record, groups)
        const bundle = mapBe09Question(record, group, await this.labelsFor(record, labels))
        out.set(record.id, { bundle, groupId: bundle.question.groupId ?? null })
      } catch (e) {
        if (!(e instanceof UnsupportedQuestionError)) throw e
        this.logger.error(`BE-09 question not served to Bijak: ${e.message}`)
      }
    }
    return out
  }

  private async groupFor(
    record: QuestionRecord,
    cache: Map<string, StimulusGroupRecord | null>,
  ): Promise<StimulusGroupRecord | null> {
    if (!record.groupId) return null
    const hit = cache.get(record.groupId)
    if (hit !== undefined) return hit
    const group = await this.questions.groupOf(record.id)
    cache.set(record.groupId, group)
    return group
  }

  private async labelsFor(
    record: QuestionRecord,
    cache: Map<string, CurriculumLabels>,
  ): Promise<CurriculumLabels> {
    const v = record.version
    const key = `${v.subjectId ?? ''}:${v.unitId ?? ''}`
    const hit = cache.get(key)
    if (hit) return hit
    const subject = v.subjectId ? await this.curriculum.subject(idFromString(v.subjectId)) : null
    const unit = v.unitId ? await this.curriculum.nodeById(idFromString(v.unitId)) : null
    const labels: CurriculumLabels = {
      subjectCode: subject ? bijakCodeOf(subject.code) : '',
      unitLabel: unit?.title ?? subject?.name ?? '',
      unitCode: unit?.code ?? null,
    }
    cache.set(key, labels)
    return labels
  }
}
