import { Inject, Injectable } from '@nestjs/common'
import type { QuestionWorkflowStatus } from '@pp/contract'

import { ApiError } from '../../../../common/errors/api-error'
import { CLOCK, type Clock } from '../../../../db/clock'
import { idFromString, idToString } from '../../../../db/ids'
import { PrismaService } from '../../../../db/prisma.service'
import { CurriculumRepository } from '../../../curriculum'
import { leavesOf } from '../../grading'
import { transitionConflict } from '../../errors'
import { checkKeysGate, checkTagGate } from '../../publish-gate'
import { draftsFromParts } from '../../tree'
import { partsFromFlat } from '../../projection'
import { QuestionsRepository, type VersionDraft } from '../../questions.repository'
import type { QuestionRecord } from '../../types'
import type {
  DiagramCandidate,
  ExplanationSource,
  ImportedQuestionInput,
  QualityQuestion,
  QuestionBankPort,
  QuestionBrief,
  QuestionGateData,
  QuestionStatusInfo,
  SetStatusOptions,
} from '../ports'

const WRITE_TX = { timeout: 20_000, maxWait: 10_000 } as const

/** Plain text of a stem: markup removed, whitespace collapsed. */
function plain(text: string | null | undefined): string {
  return (text ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Source types a person authored here (so the author is the source and the rights are their own). */
const AUTHORED = new Set(['manual', 'excel'])

const asId = (text: string): bigint | null => {
  try {
    return idFromString(text)
  } catch {
    return null
  }
}

const stemOf = (r: QuestionRecord): string => plain(r.version.stemMs ?? r.version.stemEn ?? r.version.parts[0]?.prompt.ms)

/**
 * `QuestionBankPort` over BE-09 (BE-10 wiring). Reads go through `QuestionsRepository` (plus a few
 * read-only queries for columns the repository record does not carry); writes use the repository
 * primitives inside the transaction BE-10 opened (the Prisma transaction is ambient).
 *
 * Why not `QuestionsService.setStatus`: BE-10 has already decided the move (table, role, reason,
 * gates, takedown which is outside the table) and needs `expectedFrom`, `target: 'live'` and the
 * `archiveReason` hint, which the service does not offer; its own transition check would refuse a
 * takedown. The publish semantics are the same as the service: the live version is superseded, the
 * new one gets `published_at` and becomes live, and taking the live version down clears it.
 * `checkTagGate` and `checkKeysGate` run again on publish as a second line of defence.
 */
@Injectable()
export class QuestionBankAdapter implements QuestionBankPort {
  constructor(
    @Inject(QuestionsRepository) private readonly repo: QuestionsRepository,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private infoOf(r: QuestionRecord): QuestionStatusInfo {
    return {
      id: r.id,
      status: r.version.status,
      latestVersionNo: r.latestVersionNo,
      liveVersionNo: r.liveVersionNo,
      isActive: r.isActive,
      createdById: r.createdById,
    }
  }

  async getStatus(id: string): Promise<QuestionStatusInfo | null> {
    const r = await this.repo.get(id, 'latest')
    return r ? this.infoOf(r) : null
  }

  async getForGates(id: string): Promise<QuestionGateData | null> {
    const r = await this.repo.get(id, 'latest')
    if (!r) return null
    const v = r.version
    const extra = await this.prisma.client.questionVersion.findFirst({
      where: { question: { id: BigInt(r.id) }, versionNo: v.versionNo },
      select: { rightsStatus: true, sourceKind: true, contributorId: true, sourcePaperId: true },
    })
    const authored = r.sourceType !== null && AUTHORED.has(r.sourceType)
    const declared = extra?.sourceKind != null || extra?.contributorId != null || extra?.sourcePaperId != null
    return {
      id: r.id,
      parts: v.parts,
      marks: leavesOf(v.parts).reduce((s, { leaf }) => s + leaf.marks, 0),
      subjectId: v.subjectId,
      educationLevelId: v.educationLevelId,
      chapterId: v.chapterId,
      unitId: v.unitId,
      spIds: v.spIds,
      tp: v.difficultyTp,
      // BE-09 has no write path for the rights declaration: a question authored here is the author's own.
      rightsStatus: extra?.rightsStatus ?? (authored ? 'own' : null),
      hasSourceDeclaration: declared || (authored && r.createdById !== null),
      // Intake (BE-38) and duplicate detection (BE-39) are not built: nothing is flagged.
      unconfirmedLowConfidenceFields: [],
      hasOpenDuplicateFlag: false,
      // BE-09 validates every image and stimulus reference when it writes a version.
      mediaResolved: true,
      missingRequiredFields: plain(v.stemMs ?? v.stemEn) === '' && v.parts.length === 0 ? ['questionText'] : [],
      lastEditedByAi: false,
    }
  }

  async setStatus(id: string, to: QuestionWorkflowStatus, _actorId: string, options: SetStatusOptions = {}): Promise<QuestionStatusInfo | null> {
    return this.prisma.transaction(async () => {
      if (!(await this.repo.lock(id))) return null
      const latest = await this.repo.get(id, 'latest')
      if (!latest) return null
      const target = options.target ?? 'latest'
      if (target === 'live' && latest.liveVersionNo === null) return this.infoOf(latest)
      const versionNo = target === 'live' ? (latest.liveVersionNo as number) : latest.latestVersionNo
      const record = versionNo === latest.latestVersionNo ? latest : await this.repo.get(id, 'live')
      if (!record) return null
      const current = record.version.status
      // Lost-update guard: nothing is written when the version moved since BE-10 read it.
      if (options.expectedFrom !== undefined && current !== options.expectedFrom) throw transitionConflict(current, to)

      if (to === 'published') {
        const v = record.version
        const fields = checkTagGate({ subjectId: v.subjectId, educationLevelId: v.educationLevelId, unitId: v.unitId, spIds: v.spIds, tp: v.difficultyTp })
        Object.assign(fields, checkKeysGate(v.parts))
        if (Object.keys(fields).length > 0) throw ApiError.of('VALIDATION_ERROR', { fields })
        // The version that served until now is superseded in the same transaction (BE-FR-35).
        if (latest.liveVersionNo !== null && latest.liveVersionNo !== versionNo) {
          await this.repo.setVersionStatus(id, latest.liveVersionNo, 'archived', { archiveReason: 'superseded' })
        }
        await this.repo.setVersionStatus(id, versionNo, 'published', { publishedAt: this.clock.now() })
        await this.repo.setLiveVersion(id, versionNo)
      } else if (to === 'archived') {
        const reason = options.archiveReason ?? 'withdrawn'
        if (current === 'published') {
          await this.repo.setVersionStatus(id, versionNo, 'archived', { archiveReason: reason })
        } else {
          await this.repo.setVersionStatus(id, versionNo, 'archived', options.archiveReason ? { archiveReason: options.archiveReason } : {})
        }
        // Withdrawing a question whose latest edit is a draft also ends the live version.
        if (latest.liveVersionNo !== null) {
          if (latest.liveVersionNo !== versionNo) await this.repo.setVersionStatus(id, latest.liveVersionNo, 'archived', { archiveReason: reason })
          await this.repo.setLiveVersion(id, null)
        }
      } else {
        await this.repo.setVersionStatus(id, versionNo, to)
        if (current === 'published' && latest.liveVersionNo === versionNo) await this.repo.setLiveVersion(id, null)
      }
      const after = await this.repo.get(id, 'latest')
      return after ? this.infoOf(after) : null
    }, WRITE_TX)
  }

  deactivate(id: string): Promise<boolean> {
    return this.repo.deactivate(id)
  }

  reactivate(id: string): Promise<boolean> {
    return this.repo.reactivate(id)
  }

  async create(input: ImportedQuestionInput): Promise<string> {
    const index = Math.max(0, input.options.findIndex((o) => o.label === input.correctLabel))
    const parts = partsFromFlat({
      questionType: 'mcq',
      questionText: input.stemMs,
      options: input.options.map((o) => o.text),
      correctAnswer: index,
      pointsValue: input.marks ?? 1,
    })
    const subjectId = input.subjectId === null ? null : asId(input.subjectId)
    const levelId = input.educationLevelId === null ? null : asId(input.educationLevelId)
    const level = levelId === null ? null : await this.curriculum.level(levelId)
    const draft: VersionDraft = {
      status: input.status,
      type: 'mcq',
      stemMs: input.stemMs,
      stemEn: null,
      numberLabel: null,
      language: 'ms',
      explanationMs: input.explanation?.trim() || null,
      explanationEn: null,
      subjectId,
      educationLevelId: levelId,
      unitNodeId: null,
      chapterId: null,
      topicId: null,
      formOrigin: level?.code === 'T5' ? 't5' : level?.code === 'T4' ? 't4' : 't1_t3',
      cognitiveLevel: null,
      // OQ-DM-20: the legacy 1 to 5 scale maps to TP 1 to 5 one to one.
      difficultyTp: input.difficultyLevel === null ? null : Math.min(6, Math.max(1, Math.trunc(input.difficultyLevel))),
      sourcePage: null,
      setLabel: input.sourceSet,
      spNodeIds: [],
      stimulusIds: [],
      parts: draftsFromParts(parts),
    }
    return this.prisma.transaction(
      () =>
        this.repo.create({
          sourceType: 'excel',
          createdById: BigInt(input.createdById),
          groupId: null,
          groupPosition: null,
          spmPool: false,
          now: this.clock.now(),
          version: draft,
        }),
      WRITE_TX,
    )
  }

  async listIdsBySourcePaper(sourcePaperId: string): Promise<string[]> {
    const paper = asId(sourcePaperId)
    if (paper === null) return []
    const rows = await this.prisma.client.$queryRaw<{ id: bigint }[]>`
      SELECT q.id FROM questions q
      JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
      WHERE v.source_paper_id = ${paper} ORDER BY q.id ASC`
    return rows.map((r) => idToString(r.id))
  }

  async describe(ids: readonly string[]): Promise<ReadonlyMap<string, QuestionBrief>> {
    const records = await this.repo.getMany(ids, 'latest')
    const out = new Map<string, QuestionBrief>()
    if (records.length === 0) return out
    const names = await this.names()
    const chapters = new Map<string, string | null>()
    for (const r of records) {
      const cid = r.version.chapterId
      if (cid !== null && !chapters.has(cid)) {
        const key = asId(cid)
        chapters.set(cid, key === null ? null : ((await this.curriculum.chapter(key))?.name ?? null))
      }
    }
    for (const r of records) {
      const v = r.version
      out.set(r.id, {
        id: r.id,
        stemText: stemOf(r),
        type: v.type,
        status: v.status,
        subjectId: v.subjectId,
        subjectName: v.subjectId === null ? null : (names.subjects.get(v.subjectId) ?? null),
        educationLevelId: v.educationLevelId,
        levelName: v.educationLevelId === null ? null : (names.levels.get(v.educationLevelId) ?? null),
        chapterName: v.chapterId === null ? null : (chapters.get(v.chapterId) ?? null),
      })
    }
    return out
  }

  async listForQuality(): Promise<QualityQuestion[]> {
    const rows = await this.prisma.client.$queryRaw<
      {
        id: bigint
        source_type: string | null
        archive_reason: string | null
        status: string
        stem: string | null
        explanation: string | null
        subject_id: bigint | null
        level_id: bigint | null
        set_label: string | null
        tagged: boolean
      }[]
    >`
      SELECT q.id, q.source_type, v.archive_reason, v.status,
             COALESCE(v.stem_ms, v.stem_en, (SELECT p.prompt_ms FROM question_parts p
               WHERE p.question_version_id = v.id AND p.parent_part_id IS NULL ORDER BY p.position LIMIT 1)) AS stem,
             v.explanation_ms AS explanation, v.subject_id, v.education_level_id AS level_id, v.set_label,
             EXISTS (SELECT 1 FROM question_version_sp_nodes s WHERE s.question_version_id = v.id) AS tagged
      FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
      ORDER BY q.id ASC`
    const names = await this.names()
    return rows.map((r) => {
      const subjectId = r.subject_id === null ? null : idToString(r.subject_id)
      const levelId = r.level_id === null ? null : idToString(r.level_id)
      return {
        id: idToString(r.id),
        stemText: plain(r.stem),
        explanation: r.explanation,
        untagged: !r.tagged,
        sourceType: r.source_type,
        quarantinedOrRejected: r.status === 'archived' && r.archive_reason === 'source_takedown',
        isLegacy: false,
        subjectId,
        subjectName: subjectId === null ? null : (names.subjects.get(subjectId) ?? null),
        educationLevelId: levelId,
        levelName: levelId === null ? null : (names.levels.get(levelId) ?? null),
        sourceSet: r.set_label,
      }
    })
  }

  async listDiagramCandidates(kind: 'mcq' | 'structured'): Promise<DiagramCandidate[]> {
    void kind
    // BE-09 stores no "needs a diagram" flag (the intake that raises it is BE-38).
    return []
  }

  async attachDiagram(id: string, fileId: string): Promise<boolean> {
    const file = asId(fileId)
    const r = await this.repo.get(id, 'latest')
    if (!r || file === null) return false
    return this.prisma.transaction(async () => {
      const stimulusId = await this.repo.createStimulus({ kind: 'diagram', label: null, bodyMs: null, bodyEn: null, altText: null, assetFileId: file })
      const version = await this.prisma.client.questionVersion.findFirst({
        where: { question: { id: BigInt(id) }, versionNo: r.version.versionNo },
        select: { id: true },
      })
      if (!version) return false
      const last = await this.prisma.client.questionVersionStimulus.aggregate({ where: { questionVersionId: version.id }, _max: { position: true } })
      await this.prisma.client.questionVersionStimulus.create({
        data: { questionVersionId: version.id, stimulusId: BigInt(stimulusId), position: (last._max.position ?? 0) + 1 },
      })
      return true
    }, WRITE_TX)
  }

  async getExplanationSource(id: string): Promise<ExplanationSource | null> {
    const r = await this.repo.get(id, 'latest')
    if (!r) return null
    const v = r.version
    const leaves = leavesOf(v.parts)
    const first = leaves[0]?.leaf
    let options: ExplanationSource['options'] = null
    let answerText: string | null = null
    if (first?.mode === 'mcq') {
      options = first.options.map((o) => ({ label: o.label, text: o.body.ms, isCorrect: o.label === first.key.correct }))
    } else if (first?.mode === 'short_text') {
      answerText = first.key.values.join(' / ')
    } else if (first?.mode === 'essay' && first.key.kind === 'points') {
      answerText = first.key.modelText ?? null
    }
    return {
      id: r.id,
      type: v.type,
      stemText: stemOf(r),
      options,
      answerText,
      explanation: v.explanationMs,
      difficultyLevel: v.difficultyTp === null ? null : Math.min(5, v.difficultyTp),
      pointsValue: leaves.reduce((s, { leaf }) => s + leaf.marks, 0),
    }
  }

  async setExplanation(id: string, text: string): Promise<boolean> {
    const r = await this.repo.get(id, 'latest')
    if (!r) return false
    await this.prisma.client.questionVersion.updateMany({
      where: { question: { id: BigInt(id) }, versionNo: r.version.versionNo },
      data: { explanationMs: text },
    })
    return true
  }

  private async names(): Promise<{ subjects: Map<string, string>; levels: Map<string, string> }> {
    const [subjects, levels] = await Promise.all([this.curriculum.subjects(), this.curriculum.levels()])
    return {
      subjects: new Map(subjects.map((s) => [idToString(s.id), s.name])),
      levels: new Map(levels.map((l) => [idToString(l.id), l.name])),
    }
  }
}
