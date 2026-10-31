/**
 * `QuestionBankPort` over the real question bank (BE-09). It uses only what `modules/questions`
 * exports (`QuestionsService`, `QuestionsRepository`, `transitionConflict`, types) plus the curriculum
 * repository for names. Two places go beyond that and are marked GAP (a BE-09 method is missing):
 * `readFacts` and `listIdsBySourcePaper` read `question_versions` through Prisma (read only), and
 * `setExplanation` writes `explanation_ms` of one version through Prisma.
 *
 * Backed by BE-09: getStatus, getForGates (parts, tags, chapter), setStatus, deactivate, reactivate,
 * create (admin and Guru imports), describe, listForQuality, getExplanationSource.
 * Defaulted (BE-09 holds no such field): the gate facts "duplicate flag", "low-confidence fields",
 * "media resolved", "AI editor", "required fields" and "marks"; `listDiagramCandidates` (no needs-diagram
 * flag in the bank) and `attachDiagram` (no method to attach a figure).
 */
import { Inject, Injectable } from '@nestjs/common'
import type { QuestionPart, QuestionWorkflowStatus } from '@pp/contract'

import { PrismaService } from '../../../db/prisma.service'
import { CurriculumRepository } from '../../curriculum'
import {
  QuestionsRepository,
  QuestionsService,
  transitionConflict,
  type QuestionCreateInput,
  type QuestionRecord,
} from '../index'
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
} from './ports'

const QUALITY_PAGE = 2000
const bi = (id: string): bigint | null => (/^[1-9]\d{0,18}$/.test(id) ? BigInt(id) : null)

type Leaf = Extract<QuestionPart, { mode: string }>

function leaves(parts: readonly QuestionPart[]): Leaf[] {
  return parts.flatMap((p) => ('mode' in p ? [p] : leaves((p as { children: QuestionPart[] }).children)))
}

/** The wire type BE-10 distinguishes: a single MCQ leaf is `mcq`, everything else is `structured`. */
const briefType = (storeType: string): string => (storeType === 'mcq' ? 'mcq' : 'structured')

/** The flat type the canned explanation knows; other store types fall through to their own code. */
function explanationType(storeType: string): string {
  if (storeType === 'short') return 'short_answer'
  return storeType
}

@Injectable()
export class QuestionBankAdapter implements QuestionBankPort {
  constructor(
    @Inject(QuestionsRepository) private readonly repo: QuestionsRepository,
    @Inject(QuestionsService) private readonly service: QuestionsService,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
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

  /**
   * GAP (BE-09 method wanted: `rightsOf(id, versionNo)`): reads `rights_status` of one version
   * through Prisma, read only. A version with no declaration (null) counts as satisfied (`own`),
   * the documented default; an explicit `unclear` still fails the publish gate.
   */
  private async rightsStatusOf(id: string, versionNo: number): Promise<string> {
    const key = bi(id)
    if (key === null) return 'own'
    const row = await this.prisma.client.questionVersion.findUnique({
      where: { questionId_versionNo: { questionId: key, versionNo } },
      select: { rightsStatus: true },
    })
    return row?.rightsStatus ?? 'own'
  }

  async getForGates(id: string): Promise<QuestionGateData | null> {
    const r = await this.repo.get(id, 'latest')
    if (!r) return null
    const v = r.version
    return {
      id: r.id,
      parts: v.parts,
      // BE-09 has no question-level marks column (only part marks): the marks-total rule has nothing to compare.
      marks: null,
      subjectId: v.subjectId,
      educationLevelId: v.educationLevelId,
      chapterId: v.chapterId,
      unitId: v.unitId,
      spIds: v.spIds,
      tp: v.difficultyTp,
      rightsStatus: await this.rightsStatusOf(r.id, v.versionNo),
      // Satisfied defaults: BE-09 stores no duplicate flag, low-confidence fields, media check or AI editor.
      hasSourceDeclaration: true,
      unconfirmedLowConfidenceFields: [],
      hasOpenDuplicateFlag: false,
      mediaResolved: true,
      missingRequiredFields: [],
      lastEditedByAi: false,
    }
  }

  /**
   * `expectedFrom` is checked under the row lock; a mismatch is the BE-09 CONFLICT error. The normal
   * moves go through `QuestionsService.setStatus` (it applies the transition table, the publish tag
   * gate and the supersede rule). Two moves are outside that table and use the repository directly:
   * `target: 'live'` (archive the live version while a newer draft exists) and a source takedown
   * (`archiveReason: 'source_takedown'`, which also moves review/approved questions to archived).
   */
  async setStatus(id: string, to: QuestionWorkflowStatus, actorId: string, options: SetStatusOptions = {}): Promise<QuestionStatusInfo | null> {
    return this.prisma.transaction(async () => {
      if (!(await this.repo.lock(id))) return null
      const record = await this.repo.get(id, 'latest')
      if (!record) return null
      const target = options.target ?? 'latest'
      const liveNo = record.liveVersionNo

      if (target === 'live') {
        if (liveNo === null) return this.infoOf(record) // nothing live: no-op
        const live = liveNo === record.latestVersionNo ? record : await this.repo.get(id, 'live')
        const current = live?.version.status ?? 'published'
        if (options.expectedFrom !== undefined && current !== options.expectedFrom) throw transitionConflict(current, to)
        await this.repo.setVersionStatus(id, liveNo, to, { archiveReason: options.archiveReason ?? 'withdrawn' })
        await this.repo.setLiveVersion(id, null)
        return this.getStatus(id)
      }

      const current = record.version.status
      if (options.expectedFrom !== undefined && current !== options.expectedFrom) throw transitionConflict(current, to)

      if (options.archiveReason === 'source_takedown' && to === 'archived') {
        if (current === 'archived') return this.infoOf(record)
        await this.repo.setVersionStatus(id, record.version.versionNo, 'archived', { archiveReason: 'source_takedown' })
        if (liveNo !== null) {
          // Taking down the live version (or a question whose live version is older than the latest) ends serving.
          if (liveNo !== record.version.versionNo) await this.repo.setVersionStatus(id, liveNo, 'archived', { archiveReason: 'source_takedown' })
          await this.repo.setLiveVersion(id, null)
        }
        return this.getStatus(id)
      }

      await this.service.setStatus(id, to, actorId, { actor: options.actor ?? 'admin', ...(options.reason === undefined ? {} : { reason: options.reason }) })
      return this.getStatus(id)
    })
  }

  deactivate(id: string): Promise<boolean> {
    return this.repo.deactivate(id)
  }

  reactivate(id: string): Promise<boolean> {
    return this.repo.reactivate(id)
  }

  /**
   * Creates one MCQ through `QuestionsService.create` (the Guru is the owner; role `teacher`, which only
   * matters for image ownership). GAP (BE-09): the service always stores `source_type = 'manual'`, so an
   * imported row is not marked `excel`; a `sourceType` argument on create is wanted.
   */
  async create(input: ImportedQuestionInput): Promise<string> {
    if (input.subjectId === null || input.educationLevelId === null || input.difficultyLevel === null) {
      throw new Error('QuestionBankAdapter.create: subject, level and difficulty are required (the import validates them first)')
    }
    // BE-09 labels options A, B, C, ... in order and needs at least 3 (contract: 3 to 8), so the present
    // options are compacted in order and the correct one is found by its position among them. A row with
    // fewer than 3 options is refused by BE-09 with 422 (GAP: the CSV rules accept 2, the v2 model does not).
    const present = input.options.filter((o) => o.text !== '')
    const correctAnswer = present.findIndex((o) => o.label === input.correctLabel)
    const body = {
      questionType: 'mcq',
      questionText: input.stemMs,
      subjectId: input.subjectId,
      educationLevelId: input.educationLevelId,
      difficultyLevel: input.difficultyLevel,
      options: present.map((o) => o.text),
      correctAnswer: Math.max(0, correctAnswer),
      explanation: input.explanation,
      pointsValue: input.marks ?? 1,
      ...(input.kertas === undefined ? {} : { kertas: input.kertas }),
      status: input.status,
    } as unknown as QuestionCreateInput
    const view = await this.service.create(body, { userId: input.createdById, role: 'teacher' })
    return view.id
  }

  /**
   * GAP (BE-09 method wanted: `idsBySourcePaper(paperId)`): reads `question_versions.source_paper_id`
   * through Prisma, read only; every question with any version from the paper is returned once.
   */
  async listIdsBySourcePaper(sourcePaperId: string): Promise<string[]> {
    const key = bi(sourcePaperId)
    if (key === null) return []
    const rows = await this.prisma.client.questionVersion.findMany({
      where: { sourcePaperId: key },
      select: { questionId: true },
      orderBy: { questionId: 'asc' },
    })
    return [...new Set(rows.map((r) => r.questionId.toString()))]
  }

  private async names(): Promise<{ subjects: Map<string, string>; levels: Map<string, string> }> {
    const [subjects, levels] = await Promise.all([this.curriculum.subjects(), this.curriculum.levels({ includeInactive: true })])
    return {
      subjects: new Map(subjects.map((s) => [s.id.toString(), s.name])),
      levels: new Map(levels.map((l) => [l.id.toString(), l.name])),
    }
  }

  async describe(ids: readonly string[]): Promise<ReadonlyMap<string, QuestionBrief>> {
    const records = await this.repo.getMany(ids, 'latest')
    const out = new Map<string, QuestionBrief>()
    if (records.length === 0) return out
    const { subjects, levels } = await this.names()
    const chapterIds = records.flatMap((r) => (r.version.chapterId === null ? [] : [BigInt(r.version.chapterId)]))
    const chapters = new Map((await this.curriculum.chaptersByIds(chapterIds)).map((c) => [c.id.toString(), c.name]))
    for (const r of records) {
      const v = r.version
      out.set(r.id, {
        id: r.id,
        stemText: v.stemMs ?? v.stemEn ?? '',
        type: briefType(v.type),
        status: v.status,
        subjectId: v.subjectId,
        subjectName: v.subjectId === null ? null : (subjects.get(v.subjectId) ?? null),
        educationLevelId: v.educationLevelId,
        levelName: v.educationLevelId === null ? null : (levels.get(v.educationLevelId) ?? null),
        chapterName: v.chapterId === null ? null : (chapters.get(v.chapterId) ?? null),
      })
    }
    return out
  }

  async forEachQualityBatch(visit: (batch: QualityQuestion[]) => Promise<void>, size = QUALITY_PAGE): Promise<void> {
    const { subjects, levels } = await this.names()
    let after: string | undefined
    for (;;) {
      const rows = await this.repo.qualityBatch(after, size)
      if (rows.length === 0) return
      after = rows[rows.length - 1]?.id
      await visit(
        rows.map((r) => ({
          id: r.id,
          stemText: r.stemMs ?? r.stemEn ?? '',
          explanation: r.explanationMs ?? r.explanationEn,
          untagged: !r.hasSp,
          sourceType: r.sourceType,
          quarantinedOrRejected: false, // v2 has no compliance state; archived is not "rejected"
          isLegacy: false,
          subjectId: r.subjectId,
          subjectName: r.subjectId === null ? null : (subjects.get(r.subjectId) ?? null),
          educationLevelId: r.educationLevelId,
          levelName: r.educationLevelId === null ? null : (levels.get(r.educationLevelId) ?? null),
          sourceSet: r.setLabel,
        })),
      )
      if (rows.length < size) return
    }
  }

  async listForQuality(): Promise<QualityQuestion[]> {
    const out: QualityQuestion[] = []
    await this.forEachQualityBatch(async (batch) => {
      out.push(...batch)
    })
    return out
  }

  /** Defaulted: the bank has no "needs a diagram" flag, so nothing is flagged. */
  async listDiagramCandidates(): Promise<DiagramCandidate[]> {
    return []
  }

  /** Defaulted: BE-09 has no method to attach a figure to a version; unreachable while no candidate is flagged. */
  async attachDiagram(): Promise<boolean> {
    return false
  }

  async getExplanationSource(id: string): Promise<ExplanationSource | null> {
    const r = await this.repo.get(id, 'latest')
    if (!r) return null
    const v = r.version
    const all = leaves(v.parts)
    const first = all[0]
    let options: ExplanationSource['options'] = null
    let answerText: string | null = null
    if (first?.mode === 'mcq') {
      options = first.options.map((o) => ({ label: o.label, text: o.body.ms, isCorrect: o.label === first.key.correct }))
    } else if (first?.mode === 'short_text') {
      answerText = first.key.values.join(' / ')
    } else if (first?.mode === 'numeric') {
      answerText = first.key.values.map((x) => String(x.v)).join(' / ')
    } else if ((first?.mode === 'essay' || first?.mode === 'essay_choice') && first.key.kind === 'points' && first.key.modelText) {
      answerText = first.key.modelText
    }
    return {
      id: r.id,
      type: first?.mode === 'essay_choice' ? 'essay_choice' : explanationType(v.type),
      stemText: v.stemMs ?? v.stemEn ?? '',
      options,
      answerText,
      explanation: v.explanationMs,
      difficultyLevel: v.difficultyTp === null ? null : Math.min(5, v.difficultyTp),
      pointsValue: all.reduce((s, l) => s + l.marks, 0),
    }
  }

  /**
   * GAP (BE-09 method wanted: `setExplanation(id, versionNo, text)`): the stub's canned text is stored by
   * a narrow Prisma write of `explanation_ms` on the latest version (no new version, no status change).
   */
  async setExplanation(id: string, text: string): Promise<boolean> {
    const r = await this.repo.get(id, 'latest')
    const key = bi(id)
    if (!r || key === null) return false
    await this.prisma.client.questionVersion.update({
      where: { questionId_versionNo: { questionId: key, versionNo: r.version.versionNo } },
      data: { explanationMs: text },
    })
    return true
  }
}

