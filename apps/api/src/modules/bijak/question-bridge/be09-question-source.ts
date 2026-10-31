import { Inject, Injectable, Logger } from '@nestjs/common'

import { idFromString, isIdString } from '../../../db/ids'
import { CurriculumRepository } from '../../curriculum'
import { FilesService } from '../../files'
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
  type BridgeMedia,
  type CurriculumLabels,
  infoOf,
  mapBe09Question,
  UnsupportedQuestionError,
} from './be09-mapping'
import type { BridgeRefusal } from './refusals'

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
 * Papers see only a `published` live version; attempts see any live version BE-09 returns (see `load`).
 * A withdrawn question (no live version) is still served to attempts from its last published version
 * while that is the latest version; once a newer draft exists on top it is absent (known gap until
 * BE-09 offers a pinned read, #45 M7) and the attempts holding it fail closed.
 * Media (R1-B08): the bridge puts file TOKEN URLs (`/api/files/<token>`) on the exam-core stimuli and options; the
 * tokens come from `FilesService.publicIdsOf` and the stimuli linked to a version outside its group from the
 * BE-09 repository (`stimulusAssets`). Whether a pupil may load a file is the files read rule, not decided here.
 * `is_active` is NOT checked: a question placed
 * on a published paper stays servable (the placement is what the paper froze). A question the mapper
 * refuses is absent too, and the refusal is logged with its id, part and reason (never its content).
 */
@Injectable()
export class Be09BijakQuestionSource implements AttemptQuestionSource {
  private readonly logger = new Logger(Be09BijakQuestionSource.name)

  constructor(
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(FilesService) private readonly files: Pick<FilesService, 'publicIdsOf'>,
  ) {}

  async loadQuestions(
    questionIds: readonly string[],
  ): Promise<ReadonlyMap<string, BijakQuestionBundle>> {
    const mapped = await this.load(questionIds)
    return new Map([...mapped].map(([id, m]) => [id, m.bundle]))
  }

  /** BE-15 `getMany`: structure only (never content or keys). */
  async getMany(questionIds: readonly string[]): Promise<ReadonlyMap<string, BijakQuestionInfo>> {
    const mapped = await this.load(questionIds, true)
    return new Map([...mapped].map(([id, m]) => [id, infoOf(m.bundle, m.groupId)]))
  }

  /**
   * The questions of `questionIds` that the bridge refuses, with a code and a BM reason (R1-B08, ADR-0030
   * section 4). For the admin "Dilihat murid di" panel: a question that is not listed here and not absent
   * (no live version) is served.
   */
  async refusalsOf(questionIds: readonly string[]): Promise<ReadonlyMap<string, BridgeRefusal>> {
    const refusals = new Map<string, BridgeRefusal>()
    await this.load(questionIds, false, refusals)
    return refusals
  }

  /** Pinned version numbers of the bundles it would serve (tests, logging). */
  async versionsOf(questionIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    const mapped = await this.load(questionIds)
    return new Map([...mapped].map(([id, m]) => [id, m.bundle.versionNo]))
  }

  /**
   * `published: true` (BE-15 eligibility) keeps only a live version whose status is `published`.
   * Attempts pass `false`: a question already placed on a paper keeps being served from whatever live
   * version BE-09 still returns, so a status change does not break running or graded attempts.
   * Groups and curriculum labels are fetched once per distinct key, in parallel.
   */
  private async load(
    questionIds: readonly string[],
    published = false,
    refused?: Map<string, BridgeRefusal>,
  ): Promise<Map<string, { bundle: Be09QuestionBundle; groupId: string | null }>> {
    const ids = [...new Set(questionIds)].filter(isIdString)
    const out = new Map<string, { bundle: Be09QuestionBundle; groupId: string | null }>()
    if (ids.length === 0) return out
    let records = (await this.questions.getMany(ids, 'live')).filter(
      (r) => !published || r.version.status === 'approved',
    )
    if (!published && records.length < ids.length) {
      // Withdrawn since the paper was built (BE-09 clears the live version): keep serving the version
      // that WAS live when it is still the latest one (archived, once published), so the attempts that
      // hold it can still be shown, graded and auto-submitted. A newer draft on top is not served.
      const have = new Set(records.map((r) => r.id))
      const withdrawn = (
        await this.questions.getMany(
          ids.filter((id) => !have.has(id)),
          'latest',
        )
      ).filter((r) => r.version.status === 'archived' && r.version.publishedAt !== null)
      records = [...records, ...withdrawn]
    }
    const groupOwner = new Map<string, string>()
    const labelKeys = new Map<string, QuestionRecord>()
    for (const r of records) {
      if (r.groupId && !groupOwner.has(r.groupId)) groupOwner.set(r.groupId, r.id)
      const k = labelKey(r)
      if (!labelKeys.has(k)) labelKeys.set(k, r)
    }
    const [groups, labels] = await Promise.all([
      Promise.all(
        [...groupOwner].map(
          async ([gid, qid]) => [gid, await this.questions.groupOf(qid)] as const,
        ),
      ).then((e) => new Map(e)),
      Promise.all([...labelKeys].map(async ([k, r]) => [k, await this.labelsOf(r)] as const)).then(
        (e) => new Map(e),
      ),
    ])
    const media = await this.mediaOf(records, groups)
    for (const record of records) {
      try {
        const group = record.groupId ? (groups.get(record.groupId) ?? null) : null
        const bundle = mapBe09Question(
          record,
          group,
          labels.get(labelKey(record)) as CurriculumLabels,
          media,
        )
        out.set(record.id, { bundle, groupId: bundle.question.groupId ?? null })
      } catch (e) {
        if (!(e instanceof UnsupportedQuestionError)) throw e
        this.logger.error(`BE-09 question not served to Bijak (${e.reasonCode}): ${e.message}`)
        refused?.set(record.id, {
          questionId: e.questionId,
          path: e.path,
          code: e.code,
          reasonCode: e.reasonCode,
          reasonMs: e.reasonMs,
        })
      }
    }
    return out
  }

  /**
   * Every file the mapper needs a token for (group stimuli, option pictures, stem pictures) in two reads, and the
   * stimuli linked to a version but not to its group. A file with no token stays absent: the mapper refuses it.
   */
  private async mediaOf(
    records: readonly QuestionRecord[],
    groups: ReadonlyMap<string, StimulusGroupRecord | null>,
  ): Promise<BridgeMedia> {
    const outsideIds = new Set<string>()
    const fileIds = new Set<string>()
    for (const g of groups.values()) for (const st of g?.stimuli ?? []) if (st.assetFileId) fileIds.add(st.assetFileId)
    for (const r of records) {
      const ids = (r.groupId ? (groups.get(r.groupId)?.stimuli ?? []) : []).map((x) => x.id)
      for (const id of r.version.stimulusIds) if (!ids.includes(id)) outsideIds.add(id)
      for (const f of optionImageIds(r.version.parts)) fileIds.add(f)
    }
    const outside = new Map<string, { kind: string; assetFileId: string | null }>()
    if (outsideIds.size > 0) {
      for (const a of await this.questions.stimulusAssets([...outsideIds])) {
        outside.set(a.id, { kind: a.kind, assetFileId: a.assetFileId })
        if (a.assetFileId) fileIds.add(a.assetFileId)
      }
    }
    const tokens = fileIds.size === 0 ? new Map<string, string>() : await this.files.publicIdsOf([...fileIds])
    return { tokens, outside }
  }

  private async labelsOf(record: QuestionRecord): Promise<CurriculumLabels> {
    const v = record.version
    const [subject, unit] = await Promise.all([
      v.subjectId ? this.curriculum.subject(idFromString(v.subjectId)) : null,
      v.unitId ? this.curriculum.nodeById(idFromString(v.unitId)) : null,
    ])
    return {
      subjectCode: subject ? bijakCodeOf(subject.code) : '',
      unitLabel: unit?.title ?? subject?.name ?? '',
      unitCode: unit?.code ?? null,
    }
  }
}

/** Every option picture (file id) of an MCQ leaf in the part tree. */
function optionImageIds(parts: QuestionRecord['version']['parts']): string[] {
  const out: string[] = []
  for (const p of parts) {
    if ('children' in p) out.push(...optionImageIds(p.children as QuestionRecord['version']['parts']))
    else if ((p.mode === 'mcq' || p.mode === 'pksk_choice') && 'options' in p)
      for (const o of p.options) if (o.imageId != null) out.push(o.imageId)
  }
  return out
}

const labelKey = (r: QuestionRecord): string =>
  `${r.version.subjectId ?? ''}:${r.version.unitId ?? ''}`
