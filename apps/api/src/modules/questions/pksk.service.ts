import { Inject, Injectable } from '@nestjs/common'
import { QuestionLeafPartSchema, type QuestionPart, type QuestionStatus } from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'
import { CLOCK, type Clock } from '../../db/clock'
import { idFromString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { questionNotFound } from './errors'
import { QuestionsRepository, type VersionDraft } from './questions.repository'
import { draftsFromParts, versionTypeOf } from './tree'
import type { QuestionRecord } from './types'

/**
 * PKSK question bank (BE-42, M07). A PKSK question is an ordinary question of the one bank (D12) carrying the tags
 * `pksk_domain` (the domain code) and `pksk_level` (`T1` or `T4`). It has one leaf of mode `pksk_choice` (0 or 2 to 6
 * options, any number of correct labels) and no curriculum tag: the curriculum publish gate does not apply to it, but a
 * valid answer key does (the leaf schema). The M04 lists, counts, sources and generic writes never see it.
 *
 * PKSK status (wire `pending | approved | rejected`) maps to the v2 lifecycle: `pending` is `review`, `approved` is
 * `published` (the only status that serves learners, live version set), `rejected` is `archived` (kept, not live).
 * Any status may follow any other (BR-M07-02), so these methods write the status directly instead of walking the
 * workflow table. Content is edited in place (no version history for PKSK).
 */

export type PkskStatus = 'pending' | 'approved' | 'rejected'
export type PkskLevelCode = 'T1' | 'T4'

export interface PkskServedQuestion {
  id: string
  domainCode: string
  questionText: string
  options: { text: string }[]
}

export interface PkskAnswerKeyRecord {
  id: string
  domainCode: string
  optionCount: number
  correctIndexes: number[]
}

export interface PkskQuestionRow {
  id: string
  questionText: string
  domainCode: string
  targetLevel: PkskLevelCode
  status: PkskStatus
}

export interface PkskQuestionRecord extends PkskQuestionRow {
  difficultyLevel: number | null
  explanation: string | null
  options: { text: string; isCorrect: boolean }[]
}

export interface PkskQuestionWrite {
  domainCode: string
  targetLevel: PkskLevelCode
  status: PkskStatus
  questionText: string
  difficultyLevel: number | null
  explanation: string | null
  options: { text: string; isCorrect: boolean }[]
}

export interface PkskListFilter {
  domainCodes?: readonly string[]
  level?: PkskLevelCode
  status?: PkskStatus
  search?: string
  page: number
  pageSize: number
}

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F'] as const
const TX = { timeout: 20_000, maxWait: 10_000 } as const

/** PKSK status to the v2 status codes stored (`pending` also reads back from draft and approved). */
export const PKSK_TO_V2: Readonly<Record<PkskStatus, QuestionStatus>> = { pending: 'review', approved: 'published', rejected: 'archived' }

export function pkskStatusOf(v2: QuestionStatus): PkskStatus {
  return v2 === 'published' ? 'approved' : v2 === 'archived' ? 'rejected' : 'pending'
}

/** The v2 statuses a PKSK status filter matches. */
const V2_OF_PKSK: Readonly<Record<PkskStatus, readonly QuestionStatus[]>> = {
  pending: ['draft', 'review', 'approved'],
  approved: ['published'],
  rejected: ['archived'],
}

/** The single leaf of a PKSK question, or null when the stored tree is not one (never served then). */
function leafOf(record: QuestionRecord): Extract<QuestionPart, { mode: 'pksk_choice' }> | null {
  const [only] = record.version.parts
  return record.version.parts.length === 1 && only && 'mode' in only && only.mode === 'pksk_choice' ? only : null
}

@Injectable()
export class PkskQuestionsService {
  constructor(
    @Inject(QuestionsRepository) private readonly repo: QuestionsRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  // --- learner reads --------------------------------------------------------------------------------

  /** Served (published, active) questions per domain code at one level. */
  countApproved(level: PkskLevelCode): Promise<Record<string, number>> {
    return this.repo.pkskServedCounts(level)
  }

  /** Every served question of the domains at the level, without any correctness flag. */
  async approvedPool(level: PkskLevelCode, domainCodes: readonly string[]): Promise<PkskServedQuestion[]> {
    const ids = await this.repo.pkskServedIds(level, domainCodes)
    const records = await this.repo.getMany(ids, 'live', 'only')
    const out: PkskServedQuestion[] = []
    for (const r of records) {
      const leaf = leafOf(r)
      if (!leaf || !r.pksk) continue
      out.push({ id: r.id, domainCode: r.pksk.domainCode, questionText: r.version.stemMs ?? '', options: leaf.options.map((o) => ({ text: o.body.ms })) })
    }
    return out
  }

  /** Scoring facts of those ids that are served PKSK questions of the level; any other id is absent. */
  async answerKeys(level: PkskLevelCode, ids: readonly string[]): Promise<PkskAnswerKeyRecord[]> {
    const records = await this.repo.getMany(ids, 'live', 'only')
    const out: PkskAnswerKeyRecord[] = []
    for (const r of records) {
      const leaf = leafOf(r)
      if (!leaf || !r.pksk || r.pksk.level !== level || !r.isActive || r.version.status !== 'published') continue
      out.push({
        id: r.id,
        domainCode: r.pksk.domainCode,
        optionCount: leaf.options.length,
        correctIndexes: leaf.options.flatMap((o, i) => (leaf.key.correct.includes(o.label) ? [i] : [])),
      })
    }
    return out
  }

  // --- admin ----------------------------------------------------------------------------------------

  async list(f: PkskListFilter): Promise<{ rows: PkskQuestionRow[]; total: number }> {
    const { ids, total } = await this.repo.pkskPage({
      ...(f.domainCodes ? { domainCodes: f.domainCodes } : {}),
      ...(f.level ? { level: f.level } : {}),
      ...(f.status ? { versionStatuses: V2_OF_PKSK[f.status] } : {}),
      ...(f.search !== undefined ? { search: f.search } : {}),
      page: f.page,
      pageSize: f.pageSize,
    })
    const records = await this.repo.getMany(ids, 'latest', 'only')
    return { rows: records.flatMap((r) => (r.pksk ? [this.rowOf(r)] : [])), total }
  }

  async stats(): Promise<{ total: number; approved: number; pending: number; t1: number; t4: number }> {
    const s = await this.repo.pkskStats()
    return { total: s.total, approved: s.published, pending: s.total - s.published - s.archived, t1: s.t1, t4: s.t4 }
  }

  async get(id: string): Promise<PkskQuestionRecord | null> {
    const [r] = await this.repo.getMany([id], 'latest', 'only')
    return r?.pksk ? this.recordOf(r) : null
  }

  async create(input: PkskQuestionWrite, actorUserId: string): Promise<PkskQuestionRecord> {
    const draft = this.draft(input)
    const now = this.clock.now()
    const id = await this.prisma.transaction(
      () =>
        this.repo.create({
          sourceType: 'manual',
          createdById: idFromString(actorUserId),
          groupId: null,
          groupPosition: null,
          spmPool: false,
          pksk: { domainCode: input.domainCode, level: input.targetLevel },
          now,
          version: draft,
        }),
      TX,
    )
    const created = await this.get(id)
    if (!created) throw questionNotFound()
    return created
  }

  /** Edits in place and applies the status; null when the id is not a PKSK question (nothing is written then). */
  async update(id: string, input: PkskQuestionWrite): Promise<PkskQuestionRecord | null> {
    const draft = this.draft(input)
    const now = this.clock.now()
    const done = await this.prisma.transaction(async () => {
      if (!(await this.repo.lock(id))) return false
      const [current] = await this.repo.getMany([id], 'latest', 'only')
      if (!current) return false
      await this.repo.rewriteVersion(id, current.latestVersionNo, draft, now)
      await this.repo.setPkskTags(id, input.domainCode, input.targetLevel)
      await this.applyStatus(current, input.status, now)
      return true
    }, TX)
    return done ? this.get(id) : null
  }

  remove(ids: readonly string[]): Promise<number> {
    return this.repo.removePksk(ids)
  }

  /** Sets the status of PKSK questions only; returns the number changed. */
  async setStatus(ids: readonly string[], status: PkskStatus): Promise<number> {
    const now = this.clock.now()
    return this.prisma.transaction(async () => {
      let n = 0
      for (const id of new Set(ids)) {
        if (!(await this.repo.lock(id))) continue
        const [current] = await this.repo.getMany([id], 'latest', 'only')
        if (!current) continue
        await this.applyStatus(current, status, now)
        n += 1
      }
      return n
    }, TX)
  }

  pkskIds(ids: readonly string[]): Promise<string[]> {
    return this.repo.pkskIds(ids)
  }

  // --- internals ------------------------------------------------------------------------------------

  /** Status columns and the live pointer (only a published PKSK question is live). */
  private async applyStatus(current: QuestionRecord, status: PkskStatus, now: Date): Promise<void> {
    const v2 = PKSK_TO_V2[status]
    const versionNo = current.latestVersionNo
    if (v2 === 'published') {
      await this.repo.setVersionStatus(current.id, versionNo, 'published', { publishedAt: current.version.publishedAt ?? now })
      await this.repo.setLiveVersion(current.id, versionNo)
    } else {
      await this.repo.setVersionStatus(current.id, versionNo, v2, v2 === 'archived' ? { archiveReason: 'withdrawn' } : {})
      await this.repo.setLiveVersion(current.id, null)
    }
  }

  /** The version to store: one `pksk_choice` leaf validated by the contract schema (a bad shape is a 422, never stored). */
  private draft(input: PkskQuestionWrite): VersionDraft {
    const leaf = {
      label: '1',
      prompt: { ms: input.questionText },
      marks: 1,
      mode: 'pksk_choice' as const,
      options: input.options.map((o, i) => ({ label: LABELS[i] as string, body: { ms: o.text } })),
      key: { kind: 'options' as const, correct: input.options.flatMap((o, i) => (o.isCorrect ? [LABELS[i] as string] : [])) },
    }
    const parsed = QuestionLeafPartSchema.safeParse(leaf)
    if (!parsed.success) {
      throw ApiError.of('VALIDATION_ERROR', { fields: { options: parsed.error.issues[0]?.message ?? 'Data tidak sah.' } })
    }
    const parts = [parsed.data as QuestionPart]
    return {
      status: PKSK_TO_V2[input.status],
      type: versionTypeOf(parts),
      stemMs: input.questionText,
      stemEn: null,
      numberLabel: null,
      language: 'ms',
      explanationMs: input.explanation,
      explanationEn: null,
      subjectId: null,
      educationLevelId: null,
      unitNodeId: null,
      chapterId: null,
      topicId: null,
      formOrigin: input.targetLevel === 'T1' ? 't1_t3' : 't4',
      cognitiveLevel: null,
      difficultyTp: input.difficultyLevel,
      sourcePage: null,
      setLabel: null,
      spNodeIds: [],
      stimulusIds: [],
      parts: draftsFromParts(parts),
    }
  }

  private rowOf(r: QuestionRecord): PkskQuestionRow {
    return {
      id: r.id,
      questionText: r.version.stemMs ?? '',
      domainCode: r.pksk?.domainCode ?? '',
      targetLevel: r.pksk?.level ?? 'T1',
      status: pkskStatusOf(r.version.status),
    }
  }

  private recordOf(r: QuestionRecord): PkskQuestionRecord {
    const leaf = leafOf(r)
    return {
      ...this.rowOf(r),
      difficultyLevel: r.version.difficultyTp,
      explanation: r.version.explanationMs,
      options: leaf ? leaf.options.map((o) => ({ text: o.body.ms, isCorrect: leaf.key.correct.includes(o.label) })) : [],
    }
  }
}
