/**
 * The paper builder's question source backed by the BE-09 question bank (BE-39 wiring). Registered on
 * `BijakBuilderPorts` by `ExamBuilderModule.onModuleInit`.
 *
 * Reads go through `QuestionsRepository` where it has the read (eligibility, the live part tree with keys).
 * Three reads have no repository method and are read-only Prisma queries on BE-09 tables: a question at a
 * PINNED version (the repository serves only the live and the latest version), the pool tags and paper
 * code used for the kertas, and stimulus groups with their stimuli. Nothing here writes.
 *
 * - candidates: one bounded SQL query (limit = editor cap + slack): live version approved AND active (BE-09 Q-2),
 *   subject = the paper subject, kertas by the `kertasOf` rule, in bank order (question id ascending).
 * - review: shows the live version, else the latest (the port takes ids only, no version).
 * - describe: the pinned version when the ref has one, else the live version, else the latest (a question
 *   that is not published yet can still be placed in a draft paper; publish refuses it). `status` is the
 *   current status of the question.
 */
import { Inject, Injectable } from '@nestjs/common'
import type { BijakAttemptOption, BijakAttemptStimulus, BijakBuilderReviewQuestion } from '@pp/contract'

import { idFromString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { bijakCodeOf, curriculumCodeOf } from '../../bijak/papers/subject-codes'
import { QuestionsRepository } from '../../questions'
import { ACTIVE_SUBJECT_SQL, LEARNER_LEVEL_SQL, NOT_PKSK_SQL, NOT_PRIMARY_LEVEL_SQL } from '../../questions/learner-visibility'
import { CANDIDATE_SLACK, MAX_EDITOR_CANDIDATES } from './builder.constants'
import { BuilderRepository } from './builder.repository'
import {
  formOriginWire,
  kertasOf,
  kindOfRows,
  poolPattern,
  levelOf,
  marksOfRows,
  previewOfRows,
  reviewQuestion,
  statusOf,
  emptyGroupStimulus,
  stimuliOf,
  type Curriculum,
  type PartRow,
} from './question-bank.mapping'
import type {
  BuilderCandidateScope,
  BuilderGroupInfo,
  BuilderPreview,
  BuilderQuestionInfo,
  BuilderQuestionRef,
  BuilderQuestionSource,
} from './ports'

const toBigint = (id: string): bigint | null => {
  try {
    return idFromString(id)
  } catch {
    return null
  }
}

@Injectable()
export class QuestionBankBuilderSource implements BuilderQuestionSource {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
    @Inject(BuilderRepository) private readonly builder: BuilderRepository,
  ) {}

  private get db() {
    return this.prisma.client
  }

  async candidates(scope: BuilderCandidateScope): Promise<string[]> {
    const subject = await this.builder.subjectByCode(curriculumCodeOf(scope.subject))
    if (!subject) return []
    const pool = poolPattern(scope.subject)
    // One bounded query. Same eligibility as `QuestionsRepository.eligibleIds` (live version approved AND
    // active, not PKSK, not a Darjah or inactive level: R1-B21 secondary-only, and an active subject: REQ-B-013) and the same kertas rule as `kertasOf` (lowest pool digit, else the paper code digit).
    const rows = await this.db.$queryRaw<{ id: bigint }[]>`
      SELECT q.id
        FROM questions q
        JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
       WHERE q.is_active AND v.status = 'approved' AND v.subject_id = ${subject.id}
         AND ${NOT_PKSK_SQL} AND ${LEARNER_LEVEL_SQL} AND ${ACTIVE_SUBJECT_SQL}
         AND COALESCE(
               (SELECT min((substring(t.code from ${pool}))::int) FROM question_tags t
                 WHERE t.question_id = q.id AND t.kind = 'pool' AND t.code ~ ${pool}),
               CASE WHEN v.paper_code ~ '/[0-9][[:space:]]*$' THEN (substring(v.paper_code from '/([0-9])[[:space:]]*$'))::int END
             ) = ${scope.kertas}
       ORDER BY q.id ASC
       LIMIT ${MAX_EDITOR_CANDIDATES + CANDIDATE_SLACK}`
    return rows.map((r) => r.id.toString())
  }

  async describe(refs: readonly BuilderQuestionRef[]): Promise<ReadonlyMap<string, BuilderQuestionInfo>> {
    const out = new Map<string, BuilderQuestionInfo>()
    const wanted = new Map<bigint, number | undefined>()
    for (const ref of refs) {
      const key = toBigint(ref.id)
      if (key !== null && !wanted.has(key)) wanted.set(key, ref.versionNo)
    }
    if (wanted.size === 0) return out
    const questions = await this.db.question.findMany({
      where: { id: { in: [...wanted.keys()] } },
      select: {
        id: true,
        isActive: true,
        groupId: true,
        liveVersionNo: true,
        latestVersionNo: true,
        tags: { where: { kind: 'pool' }, orderBy: { code: 'asc' }, select: { code: true } },
        group: {
          select: { stimuli: { orderBy: { position: 'asc' }, select: { stimulus: { select: { kind: true, label: true } } } } },
        },
      },
    })
    // Secondary-only (R1-B21): a Darjah or PKSK question is not described, so it can never be placed on a paper.
    const allowed = await this.servableVersions(questions.map((q) => ({ id: q.id, versionNo: wanted.get(q.id) ?? q.liveVersionNo ?? q.latestVersionNo })))
    const picks = questions.filter((q) => allowed.has(q.id)).map((q) => ({ q, versionNo: wanted.get(q.id) ?? q.liveVersionNo ?? q.latestVersionNo }))
    const statusNos = questions.flatMap((q) => [q.liveVersionNo, q.latestVersionNo].flatMap((n) => (n === null ? [] : [{ questionId: q.id, versionNo: n }])))
    const versions = await this.db.questionVersion.findMany({
      where: { OR: [...picks.map(({ q, versionNo }) => ({ questionId: q.id, versionNo })), ...statusNos] },
      select: {
        questionId: true,
        versionNo: true,
        status: true,
        type: true,
        stemMs: true,
        paperCode: true,
        subjectId: true,
        unitNodeId: true,
        formOrigin: true,
        parts: {
          orderBy: [{ depth: 'asc' }, { position: 'asc' }],
          select: { id: true, parentPartId: true, position: true, label: true, promptMs: true, marks: true, mode: true, key: { select: { kind: true } } },
        },
      },
    })
    const byKey = new Map(versions.map((v) => [`${v.questionId}:${v.versionNo}`, v]))
    const subjects = await this.builder.subjectsByIds(versions.flatMap((v) => (v.subjectId === null ? [] : [v.subjectId])))
    const units = await this.unitNames(versions.flatMap((v) => (v.unitNodeId === null ? [] : [v.unitNodeId])))
    for (const { q, versionNo } of picks) {
      const v = byKey.get(`${q.id}:${versionNo}`)
      if (!v) continue
      const rows: PartRow[] = v.parts
      const stimulusLabel = q.group?.stimuli.find((s) => s.stimulus.kind !== 'audio')?.stimulus.label
      const subject = v.subjectId === null ? undefined : subjects.get(v.subjectId.toString())
      out.set(q.id.toString(), {
        id: q.id.toString(),
        versionNo,
        status: statusOf({
          isActive: q.isActive,
          liveStatus: q.liveVersionNo === null ? null : (byKey.get(`${q.id}:${q.liveVersionNo}`)?.status ?? null),
          latestStatus: byKey.get(`${q.id}:${q.latestVersionNo}`)?.status ?? null,
        }),
        subject: subject ? bijakCodeOf(subject.code) : '',
        // A question without a kertas can never be a candidate; 0 keeps it out of every blueprint match.
        kertas: kertasOf(q.tags.map((t) => t.code), v.paperCode, subject ? bijakCodeOf(subject.code) : '') ?? 0,
        groupId: q.groupId === null ? null : q.groupId.toString(),
        ...(stimulusLabel ? { stimulusLabel } : {}),
        preview: previewOfRows(v.stemMs, rows),
        marks: marksOfRows(rows),
        kind: kindOfRows(v.type, rows),
        topic: v.unitNodeId === null ? '' : (units.get(v.unitNodeId)?.title ?? ''),
      })
    }
    return out
  }

  async groups(groupIds: readonly string[]): Promise<ReadonlyMap<string, BuilderGroupInfo>> {
    const out = new Map<string, BuilderGroupInfo>()
    const keys = groupIds.flatMap((id) => {
      const k = toBigint(id)
      return k === null ? [] : [k]
    })
    if (keys.length === 0) return out
    const groups = await this.db.stimulusGroup.findMany({
      where: { id: { in: keys } },
      include: {
        stimuli: { orderBy: { position: 'asc' }, include: { stimulus: true } },
        questions: { orderBy: { groupPosition: 'asc' }, select: { id: true } },
      },
    })
    // Secondary-only (R1-B21): Darjah (and PKSK) members leave the group; a group left with no member is absent.
    const members = await this.servableCurrent(groups.flatMap((g) => g.questions.map((m) => m.id)))
    for (const g of groups) {
      // D90: the group is always emitted, with or without a displayable stimulus, so every builder read treats its members as one unit.
      const shown = stimuliOf(g.stimuli.map((s) => s.stimulus))
      const [stimulus = emptyGroupStimulus(g.id), ...rest] = shown
      const questionIds = g.questions.filter((m) => members.has(m.id)).map((m) => m.id.toString())
      if (questionIds.length > 0) out.set(g.id.toString(), { id: g.id.toString(), stimulus, stimuli: shown.length > 0 ? [stimulus, ...rest] : [], questionIds })
    }
    return out
  }

  /**
   * R1-B21 (D72/D86): of the given (question, version) pairs, the question ids whose version is secondary-level and not PKSK
   * (the shared `NOT_PRIMARY_LEVEL_SQL` and `NOT_PKSK_SQL`).
   */
  private async servableVersions(pairs: readonly { id: bigint; versionNo: number }[]): Promise<Set<bigint>> {
    if (pairs.length === 0) return new Set()
    const rows = await this.db.$queryRaw<{ id: bigint }[]>`
      SELECT q.id FROM questions q
        JOIN unnest(${pairs.map((p) => p.id)}::bigint[], ${pairs.map((p) => p.versionNo)}::int[]) AS pin(qid, vno) ON pin.qid = q.id
        JOIN question_versions v ON v.question_id = q.id AND v.version_no = pin.vno
       WHERE ${NOT_PKSK_SQL} AND ${NOT_PRIMARY_LEVEL_SQL}`
    return new Set(rows.map((r) => r.id))
  }

  /**
   * `servableVersions` for the version a question is read at: the LIVE one, else (no live version) the latest. A group member that
   * is live at secondary level is not hidden by a newer draft that moved it to Darjah, and the reverse (REQ-B-013c, as T29).
   */
  private async servableCurrent(ids: readonly bigint[]): Promise<Set<bigint>> {
    if (ids.length === 0) return new Set()
    const rows = await this.db.$queryRaw<{ id: bigint }[]>`
      SELECT q.id FROM questions q
        JOIN question_versions v ON v.question_id = q.id AND v.version_no = COALESCE(q.live_version_no, q.latest_version_no)
       WHERE q.id = ANY(${[...new Set(ids)]}::bigint[]) AND ${NOT_PKSK_SQL} AND ${NOT_PRIMARY_LEVEL_SQL}`
    return new Set(rows.map((r) => r.id))
  }

  async review(ids: readonly string[]): Promise<BuilderPreview> {
    const unique = [...new Set(ids)]
    const live = await this.questions.getMany(unique, 'live')
    const have = new Set(live.map((r) => r.id))
    const rest = unique.filter((id) => !have.has(id))
    const latest = rest.length ? await this.questions.getMany(rest, 'latest') : []
    const byId = new Map([...live, ...latest].map((r) => [r.id, r]))
    const records = unique.flatMap((id) => {
      const r = byId.get(id)
      return r ? [r] : []
    })
    const subjects = await this.builder.subjectsByIds(records.flatMap((r) => (r.version.subjectId === null ? [] : [BigInt(r.version.subjectId)])))
    const unitIds = records.flatMap((r) => (r.version.unitId === null ? [] : [BigInt(r.version.unitId)]))
    const units = await this.unitNames(unitIds)
    const spCodes = await this.nodeCodes(records.flatMap((r) => r.version.spIds.map((s) => BigInt(s))))
    const levels = await this.levelCodes(records.flatMap((r) => (r.version.educationLevelId === null ? [] : [BigInt(r.version.educationLevelId)])))

    const questions: BijakBuilderReviewQuestion[] = []
    for (const r of records) {
      const v = r.version
      const subject = v.subjectId === null ? undefined : subjects.get(v.subjectId)
      const unit = v.unitId === null ? undefined : units.get(BigInt(v.unitId))
      const curriculum: Curriculum = {
        subject: subject ? bijakCodeOf(subject.code) : '',
        level: levelOf(v.educationLevelId === null ? null : (levels.get(BigInt(v.educationLevelId)) ?? null), v.formOrigin),
        unit: unit?.code ?? null,
        unitLabel: unit?.title ?? '',
        sp: v.spIds.flatMap((s) => spCodes.get(BigInt(s)) ?? []),
        tp: Math.min(6, Math.max(1, v.difficultyTp ?? 1)),
        formOrigin: formOriginWire(v.formOrigin),
      }
      questions.push(reviewQuestion({ id: r.id, stem: v.stemMs, parts: v.parts, curriculum }))
    }

    const stimuli: Record<string, BijakAttemptStimulus> = {}
    const groupStimuli: Record<string, BijakAttemptStimulus[]> = {}
    const optionBanks: Record<string, BijakAttemptOption[]> = {}
    const groupKeys = [...new Set(records.flatMap((r) => (r.groupId === null ? [] : [r.groupId])))].flatMap((id) => {
      const k = toBigint(id)
      return k === null ? [] : [k]
    })
    if (groupKeys.length) {
      const groups = await this.db.stimulusGroup.findMany({
        where: { id: { in: groupKeys } },
        include: { stimuli: { orderBy: { position: 'asc' }, include: { stimulus: true } }, options: { orderBy: { position: 'asc' } } },
      })
      for (const g of groups) {
        const all = stimuliOf(g.stimuli.map((s) => s.stimulus))
        if (all[0]) {
          stimuli[g.id.toString()] = all[0]
          groupStimuli[g.id.toString()] = all
        }
        if (g.options.length) optionBanks[g.id.toString()] = g.options.map((o) => ({ id: o.label, text: o.bodyMs ?? '' }))
      }
    }
    return { questions, stimuli, groupStimuli, optionBanks }
  }

  /** Curriculum unit title and code by node id (read-only; the curriculum module has no batch read by id). */
  private async unitNames(ids: readonly bigint[]): Promise<Map<bigint, { code: string; title: string }>> {
    if (ids.length === 0) return new Map()
    const rows = await this.db.curriculumNode.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, code: true, title: true } })
    return new Map(rows.map((r) => [r.id, { code: r.code, title: r.title }]))
  }

  private async nodeCodes(ids: readonly bigint[]): Promise<Map<bigint, string[]>> {
    const names = await this.unitNames(ids)
    return new Map([...names].map(([id, n]) => [id, [n.code]]))
  }

  private async levelCodes(ids: readonly bigint[]): Promise<Map<bigint, string>> {
    if (ids.length === 0) return new Map()
    const rows = await this.db.educationLevel.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, code: true } })
    return new Map(rows.map((r) => [r.id, r.code]))
  }
}
