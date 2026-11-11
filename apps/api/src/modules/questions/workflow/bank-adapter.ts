/**
 * `QuestionBankPort` over the real question bank (BE-09). It uses only what `modules/questions`
 * exports (`QuestionsService`, `QuestionsRepository`, `transitionConflict`, types) plus the curriculum
 * repository for names. Two places go beyond that and are marked GAP (a BE-09 method is missing):
 * `readFacts` and `listIdsBySourcePaper` read `question_versions` through Prisma (read only), and
 * `setExplanation` writes `explanation_ms` of one version through Prisma.
 *
 * Backed by BE-09: getStatus, getForGates (parts, tags, chapter), setStatus, deactivate, reactivate,
 * create (admin and Guru imports), describe, listForQuality, getExplanationSource.
 * The gate facts (rights, open duplicate, low-confidence fields, media, AI editor, declared marks) come from
 * `QuestionsRepository.gateFacts` through `gateDataOf` (R1-H-A18).
 * Nothing is defaulted any more: `listDiagramCandidates` and `attachDiagram` read and write the bank (flags, held pictures, empty image stimuli).
 */
import { Inject, Injectable } from '@nestjs/common'
import { IMAGE_STIMULUS_KINDS, type QuestionPart, type QuestionWorkflowStatus } from '@pp/contract'

import { Prisma } from '../../../db/generated/client'
import { PrismaService } from '../../../db/prisma.service'
import { CurriculumRepository } from '../../curriculum'
import {
  isStructuredVisible,
  BANK_ONLY,
  QuestionsRepository,
  QuestionsService,
  STRUCTURED_LEVEL_CODES,
  transitionConflict,
  type QuestionCreateInput,
  type QuestionRecord,
} from '../index'
import { refreshStimulusFlagsOf } from '../effective-leaf'
import { gateDataOf } from '../gate-data'
import { BANK_VISIBLE_SQL, NOT_PKSK_SQL, NOT_PRIMARY_LEVEL_SQL } from '../learner-visibility'
import { partsFromFlat } from '../projection'
import type {
  DiagramCandidate,
  ExplanationSource,
  ImportedQuestionInput,
  QualityAggregate,
  QualityQuestion,
  QuestionBankPort,
  QuestionBrief,
  QuestionGateData,
  QuestionStatusInfo,
  QuestionVersionBrief,
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
    const r = await this.repo.get(id, 'latest', BANK_ONLY)
    return r ? this.infoOf(r) : null
  }

  /** The same facts and the same builder as `QuestionsService.setStatus` (R1-H-A18): no path has its own defaults. */
  async getForGates(id: string): Promise<QuestionGateData | null> {
    const r = await this.repo.get(id, 'latest', BANK_ONLY)
    if (!r) return null
    const facts = await this.repo.gateFacts(r.id, r.version.versionNo)
    return gateDataOf(r, facts, await this.repo.isSpmBound(r.version.subjectId, r.version.educationLevelId))
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
      const record = await this.repo.get(id, 'latest', BANK_ONLY)
      if (!record) return null
      const target = options.target ?? 'latest'
      const liveNo = record.liveVersionNo

      if (target === 'live') {
        if (liveNo === null) return this.infoOf(record) // nothing live: no-op
        const live = liveNo === record.latestVersionNo ? record : await this.repo.get(id, 'live', BANK_ONLY)
        const current = live?.version.status ?? 'approved'
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

      await this.service.setStatus(id, to, actorId, {
        actor: options.actor ?? 'admin',
        ...(options.reason === undefined ? {} : { reason: options.reason }),
        ...(options.rejectionReason === undefined ? {} : { rejectionReason: options.rejectionReason }),
      })
      return this.getStatus(id)
    })
  }

  // DM-42: a report resolution (admin) never acts on a personal question: it is unknown here, so the call is a no-op that answers false.
  async deactivate(id: string): Promise<boolean> {
    return (await this.repo.get(id, 'latest', BANK_ONLY)) !== null && this.repo.deactivate(id)
  }

  async reactivate(id: string): Promise<boolean> {
    return (await this.repo.get(id, 'latest', BANK_ONLY)) !== null && this.repo.reactivate(id)
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
    // BE-09 labels options A, B, C, ... in order and needs at least 2 (contract: 2 to 8, S1-T09a), so the present
    // options are compacted in order and the correct one is found by its position among them. A row with
    // fewer than 2 options is a failed row of the CSV import (csv.ts MIN_OPTIONS).
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
      // S1-T05: the DSKP and curriculum fields go through the same create as the wizard (no second path), so the gate reads real data.
      ...(input.unitId === undefined && input.spIds === undefined && input.tp === undefined
        ? {}
        : { tag: { unitId: input.unitId ?? null, spIds: input.spIds ?? [], tp: input.tp ?? null } }),
      ...(input.cognitiveLevel === undefined ? {} : { cognitiveLevel: input.cognitiveLevel }),
      ...(input.chapterId === undefined ? {} : { curriculumChapterId: input.chapterId }),
      ...(input.topicId === undefined ? {} : { curriculumTopicId: input.topicId }),
      ...(input.numberLabel === undefined ? {} : { numberLabel: input.numberLabel }),
      ...(input.language === undefined ? {} : { language: input.language }),
      status: input.status,
    } as unknown as QuestionCreateInput
    if (input.parts !== undefined) {
      // S1-T05 part 5a: a `true_false` / `mcq_multi` row arrives as the V3 leaf the importer already validated; it goes through the same create.
      ;(body as unknown as { parts: unknown[] }).parts = input.parts
    } else if (input.kbat !== undefined || input.partStimulusId !== undefined) {
      // An explicit KBAT value and a part stimulus live on the leaf and the flat body has no field for them: the one leaf is built here and sent as `parts`.
      const parts = partsFromFlat({
        questionType: 'mcq',
        questionText: input.stemMs,
        options: present.map((o) => o.text),
        correctAnswer: Math.max(0, correctAnswer),
        pointsValue: input.marks ?? 1,
        ...(input.cognitiveLevel === undefined ? {} : { cognitiveLevel: input.cognitiveLevel }),
      })
      if (input.kbat !== undefined) (parts[0] as { kbat?: string }).kbat = input.kbat
      if (input.partStimulusId !== undefined) (parts[0] as { stimulusId?: string }).stimulusId = input.partStimulusId
      ;(body as unknown as { parts: QuestionPart[] }).parts = parts
    }
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

  async liveType(id: string): Promise<'mcq' | 'structured' | null> {
    const record = await this.repo.get(id, 'live', BANK_ONLY)
    return record ? (record.version.type === 'mcq' ? 'mcq' : 'structured') : null
  }

  async structuredVisible(id: string): Promise<boolean> {
    const record = await this.repo.get(id, 'live', BANK_ONLY)
    if (!record) return false
    const levels = new Set((await this.curriculum.levels()).filter((l) => STRUCTURED_LEVEL_CODES.includes(l.code)).map((l) => l.id.toString()))
    return isStructuredVisible(record, levels)
  }

  async describe(ids: readonly string[]): Promise<ReadonlyMap<string, QuestionBrief>> {
    const records = await this.repo.getMany(ids, 'latest', 'exclude', BANK_ONLY)
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

  async describeVersions(refs: readonly { questionId: string; versionNo: number }[]): Promise<ReadonlyMap<string, QuestionVersionBrief>> {
    const out = new Map<string, QuestionVersionBrief>()
    const records = await this.repo.getVersions(refs)
    if (records.length === 0) return out
    const { subjects } = await this.names()
    for (const r of records) {
      const v = r.version
      out.set(`${r.id}:${v.versionNo}`, {
        stemText: v.stemMs ?? v.stemEn ?? '',
        subjectId: v.subjectId,
        subjectName: v.subjectId === null ? null : (subjects.get(v.subjectId) ?? null),
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

  async qualityAggregate(actionMax: number, limit: number): Promise<QualityAggregate> {
    const [{ subjects, levels }, { groups, action }] = await Promise.all([this.names(), this.repo.qualityAggregate(actionMax, limit)])
    return {
      groups: groups.map((g) => ({
        ...g,
        subjectName: g.subjectId === null ? null : (subjects.get(g.subjectId) ?? null),
        levelName: g.educationLevelId === null ? null : (levels.get(g.educationLevelId) ?? null),
      })),
      action: action.map((r) => ({
        score: r.score,
        q: {
          id: r.id,
          stemText: r.stemMs ?? r.stemEn ?? '',
          explanation: r.explanationMs ?? r.explanationEn,
          untagged: !r.hasSp,
          sourceType: r.sourceType,
          quarantinedOrRejected: false,
          isLegacy: false,
          subjectId: r.subjectId,
          subjectName: r.subjectId === null ? null : (subjects.get(r.subjectId) ?? null),
          educationLevelId: r.educationLevelId,
          levelName: r.educationLevelId === null ? null : (levels.get(r.educationLevelId) ?? null),
          sourceSet: r.setLabel,
        },
      })),
    }
  }

  async listForQuality(): Promise<QualityQuestion[]> {
    const out: QualityQuestion[] = []
    await this.forEachQualityBatch(async (batch) => {
      out.push(...batch)
    })
    return out
  }

  /**
   * The questions that need a picture (Audit Rajah, V2 `soalan-gambar`): the live (else latest) version of a bank question, not archived, that
   *  - carries an OPEN `stimulus_missing` / `figure_only` flag (the rajah the stem refers to was never stored: the Regroup work-list rows), or
   *  - is held for a V2 picture that could not be copied (`legacy_image_unresolved` in `import_issues`), or
   *  - shows an image-kind stimulus (own or group) that has no file yet.
   * `mcq` = a single-choice question, `structured` = any other type. Text is cut for the list; the page size and filters are the service's.
   */
  async listDiagramCandidates(kind: 'mcq' | 'structured'): Promise<DiagramCandidate[]> {
    const type = kind === 'mcq' ? Prisma.sql`v.type = 'mcq'` : Prisma.sql`v.type <> 'mcq'`
    const images = Prisma.join([...IMAGE_STIMULUS_KINDS])
    const rows = await this.prisma.client.$queryRaw<
      { id: bigint; text: string | null; subject_id: bigint | null; subject_name: string | null; creator_id: bigint | null; creator_name: string | null; creator_school: bigint | null; page: number | null }[]
    >`SELECT q.id, left(coalesce(v.stem_ms, v.stem_en, ''), 600) AS text, v.subject_id, sj.name AS subject_name,
             q.created_by_id AS creator_id, cu.name AS creator_name, cu.school_id AS creator_school, v.source_page AS page
        FROM questions q
        JOIN question_versions v ON v.question_id = q.id AND v.version_no = coalesce(q.live_version_no, q.latest_version_no)
        LEFT JOIN subjects sj ON sj.id = v.subject_id
        LEFT JOIN users cu ON cu.id = q.created_by_id
       WHERE ${NOT_PKSK_SQL} AND ${NOT_PRIMARY_LEVEL_SQL} AND ${BANK_VISIBLE_SQL} AND v.status <> 'archived' AND ${type}
         AND (
           (v.stimulus_flag IN ('stimulus_missing', 'figure_only') AND v.flag_dismissed_at IS NULL)
           OR coalesce(v.import_issues, '[]'::jsonb) @> '[{"code": "legacy_image_unresolved"}]'::jsonb
           OR EXISTS (SELECT 1 FROM question_version_stimuli qvs JOIN stimuli s ON s.id = qvs.stimulus_id
                       WHERE qvs.question_version_id = v.id AND s.asset_file_id IS NULL AND s.kind IN (${images}))
           OR EXISTS (SELECT 1 FROM stimulus_group_stimuli gs JOIN stimuli s ON s.id = gs.stimulus_id
                       WHERE gs.group_id = q.group_id AND s.asset_file_id IS NULL AND s.kind IN (${images}))
         )
       ORDER BY q.id DESC`
    return rows.map((r) => ({
      id: r.id.toString(),
      kind,
      text: r.text ?? '',
      subjectId: r.subject_id === null ? null : r.subject_id.toString(),
      subjectName: r.subject_name,
      createdBy: { id: (r.creator_id ?? 0n).toString(), name: r.creator_name, schoolId: r.creator_school === null ? null : r.creator_school.toString() },
      sourceFile: null,
      sourcePage: r.page,
    }))
  }

  /**
   * Attaches an uploaded picture to the question's rajah. An image-kind stimulus of the question or its group that has no file yet takes it
   * (a held V2 picture, an empty group image); otherwise a new `diagram` stimulus is made: on the GROUP when the question is in one (every
   * member shows it, D90/D105), else on the live and latest version. The `legacy_image_unresolved` hold is lifted (the question is re-activated
   * when no other hold remains) and the stimulus flags of the question or of its whole group are decided again. False when the question is gone.
   */
  async attachDiagram(id: string, fileId: string): Promise<boolean> {
    const key = bi(id)
    const file = bi(fileId)
    if (key === null || file === null) return false
    const db = this.prisma.client
    const q = await db.question.findUnique({ where: { id: key }, select: { latestVersionNo: true, liveVersionNo: true, groupId: true } })
    if (q === null) return false
    const numbers = [...new Set([q.latestVersionNo, ...(q.liveVersionNo === null ? [] : [q.liveVersionNo])])]
    const images = Prisma.join([...IMAGE_STIMULUS_KINDS])
    const open = await db.$queryRaw<{ id: bigint }[]>`
      SELECT s.id FROM stimuli s
       WHERE s.asset_file_id IS NULL AND s.kind IN (${images}) AND s.id IN (
         SELECT qvs.stimulus_id FROM question_version_stimuli qvs JOIN question_versions v ON v.id = qvs.question_version_id
          WHERE v.question_id = ${key} AND v.version_no = ANY(${numbers}::int[])
         UNION
         SELECT gs.stimulus_id FROM stimulus_group_stimuli gs WHERE gs.group_id = ${q.groupId}::bigint)
       ORDER BY s.id LIMIT 1`
    const first = open[0]
    if (first !== undefined) {
      await db.stimulus.update({ where: { id: first.id }, data: { assetFileId: file } })
    } else {
      const made = await db.stimulus.create({ data: { kind: 'diagram', label: 'Rajah', altText: 'Rajah', assetFileId: file }, select: { id: true } })
      if (q.groupId !== null) {
        const last = await db.stimulusGroupStimulus.aggregate({ where: { groupId: q.groupId }, _max: { position: true } })
        await db.stimulusGroupStimulus.create({ data: { groupId: q.groupId, stimulusId: made.id, position: (last._max.position ?? 0) + 1 } })
      } else {
        const versions = await db.questionVersion.findMany({ where: { questionId: key, versionNo: { in: numbers } }, select: { id: true } })
        for (const v of versions) {
          const last = await db.questionVersionStimulus.aggregate({ where: { questionVersionId: v.id }, _max: { position: true } })
          await db.questionVersionStimulus.create({ data: { questionVersionId: v.id, stimulusId: made.id, position: (last._max.position ?? 0) + 1 } })
        }
      }
    }
    // The hold is lifted; the question comes back when nothing else holds it (markup, personal data, another picture).
    await db.$executeRaw`
      UPDATE question_versions v SET import_issues = NULLIF(coalesce((
          SELECT jsonb_agg(i) FROM jsonb_array_elements(v.import_issues) i WHERE i->>'code' <> 'legacy_image_unresolved'), '[]'::jsonb), '[]'::jsonb)
       WHERE v.question_id = ${key} AND v.version_no = ANY(${numbers}::int[]) AND jsonb_typeof(v.import_issues) = 'array'`
    await db.$executeRaw`
      UPDATE questions qq SET is_active = true
       WHERE qq.id = ${key} AND NOT EXISTS (
         SELECT 1 FROM question_versions v, jsonb_array_elements(CASE WHEN jsonb_typeof(v.import_issues) = 'array' THEN v.import_issues ELSE '[]'::jsonb END) i
          WHERE v.question_id = qq.id AND i->>'code' IN ('legacy_image_unresolved', 'html_image', 'html_math', 'html_residual', 'pii_suspect'))`
    const members = q.groupId === null ? [key] : (await db.question.findMany({ where: { groupId: q.groupId }, select: { id: true } })).map((m) => m.id)
    await refreshStimulusFlagsOf(db, members, new Date())
    return true
  }

  async getExplanationSource(id: string): Promise<ExplanationSource | null> {
    const r = await this.repo.get(id, 'latest', BANK_ONLY)
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
   * The AI explanation write goes through the question service, which applies the one edit rule (REQ-B-052): an approved, archived or pinned
   * version is never rewritten in place; the text goes to a new draft version marked as the AI's (see `QuestionsService.setExplanation`).
   */
  setExplanation(id: string, text: string): Promise<boolean> {
    return this.service.setExplanation(id, text)
  }
}
