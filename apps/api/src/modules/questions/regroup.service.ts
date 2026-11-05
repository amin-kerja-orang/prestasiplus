import { Inject, Injectable } from '@nestjs/common'
import {
  REGROUP_MESSAGES,
  STIMULUS_MESSAGES as M,
  type RegroupRequest,
  StimulusCreateRequestSchema,
  type StimulusFlag,
  type StimulusGroupDetail,
} from '@pp/contract'

import { AUDIT_ACTIONS, AuditService } from '../../common/audit'
import { ApiError } from '../../common/errors/api-error'
import { Prisma } from '../../db/generated/client'
import { idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import type { HttpActor } from './http/actor'
import { refreshStimulusFlagsOf } from './effective-leaf'
import { GroupMembers } from './group-members'
import { NOT_PKSK_SQL, NOT_PRIMARY_LEVEL_SQL } from './learner-visibility'
import { QuestionsService } from './questions.service'
import { StimuliRepository, plainExcerpt } from './stimuli.repository'
import { StimuliService } from './stimuli.service'

const TX = { timeout: 20_000, maxWait: 10_000 } as const
const fail = (fields: Record<string, string>): ApiError => ApiError.of('VALIDATION_ERROR', { fields })
const conflict = (message: string): ApiError => ApiError.of('CONFLICT', { message })
const bi = (text: string): bigint | null => (/^[1-9]\d{0,18}$/.test(text) ? BigInt(text) : null)
const sameList = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i])
const csv = (ids: readonly (bigint | string)[]): string => ids.map(String).join(',')
const iso = (d: Date | null): string | null => (d === null ? null : d.toISOString())

/** The flags a work-list row can carry: the two that exclude a question from pupils, and the display-once one. */
const EXCLUDING: readonly StimulusFlag[] = ['stimulus_missing', 'figure_only']
const EXCERPT_MAX = 120

/**
 * The audit payload of a regroup (DM-59, lead decision D4 on #424). FLAT on purpose: `sanitizeDetails` redacts below depth 4, so every list
 * of ids is a comma string and the per-version rows are one array of flat objects. IDS, ENUM VALUES AND TIMESTAMPS ONLY, never content (so nothing
 * here can be redacted by the sanitizer). Undo reads it back; `memberState`, `stamps` and `groupUa` (the `updated_at` of every row the regroup
 * touched, as it was when the regroup ended) are how undo tells by EQUALITY that something changed since.
 */
interface VersionRow {
  q: string
  no: number
  flag: string | null
  flagAt: string | null
  flagRef: string | null
  dismissedAt: string | null
  dismissedBy: string | null
  /** `stimulusId:position,...` of the stem stimulus links removed from this version. */
  removed: string
}
interface MemberState {
  q: string
  latest: number
  live: number | null
}
interface FigureVersionRow {
  no: number
  status: string
  publishedAt: string | null
}
interface RegroupPayload {
  v: 1
  groupId: string
  subjectId: string | null
  levelId: string | null
  /** The group's stimuli, in order. */
  stimulusIds: string
  /** The stimulus this call created (undo deletes it when nothing else uses it), else null. */
  createdStimulusId: string | null
  /** Members in group order. */
  members: string
  memberState: MemberState[]
  versions: VersionRow[]
  figureQuestionId: string | null
  figureLive: number | null
  figureState: MemberState | null
  figureVersions: FigureVersionRow[]
  /** `updated_at` (ISO) of the group and of every member / figure version row, after the last write of the regroup. */
  groupUa: string
  stamps: StampRow[]
}
interface StampRow {
  q: string
  no: number
  ua: string
}

/**
 * S1-T07: the flags of 60 section 2.17.4 and the regroup. API-Q-12 "Bukan masalah", API-Q-13 work-list, API-Q-24 regroup, API-Q-36 undo.
 * Admin Pusat only (the controller). Every write runs in ONE transaction that also writes its audit row.
 */
@Injectable()
export class RegroupService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StimuliRepository) private readonly repo: StimuliRepository,
    @Inject(GroupMembers) private readonly members: GroupMembers,
    @Inject(StimuliService) private readonly stimuli: StimuliService,
    @Inject(QuestionsService) private readonly questions: QuestionsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private get db() {
    return this.prisma.client
  }

  private write(actor: HttpActor, action: string, targetType: string, targetId: string, details: Record<string, unknown>): Promise<string> {
    return this.audit.recordWithId({
      action,
      actorUserId: actor.userId,
      actorRole: actor.roleCode,
      scopeLevel: actor.scopeLevel ?? null,
      targetType,
      targetId,
      requestId: actor.requestId,
      ip: actor.ip,
      isTest: actor.isTest,
      details,
    })
  }

  // --- API-Q-12 "Bukan masalah" ---------------------------------------------------------------------------------------------------

  /**
   * Dismisses the flag on the LIVE version and, when it is another row carrying the same flag, on the latest version too. `flag` must be the stored
   * flag (409 otherwise); dismissing again is a 200 that changes nothing. Returns the flags still open on the latest version.
   */
  async dismiss(id: string, flag: StimulusFlag, actor: HttpActor): Promise<{ id: string; flags: StimulusFlag[] }> {
    const key = bi(id)
    if (key === null) throw ApiError.of('NOT_FOUND')
    return this.prisma.transaction(async () => {
      await this.db.$queryRaw`SELECT id FROM questions WHERE id = ${key} FOR UPDATE`
      const q = await this.db.question.findUnique({ where: { id: key }, select: { latestVersionNo: true, liveVersionNo: true } })
      if (q === null) throw ApiError.of('NOT_FOUND')
      const numbers = [...new Set([q.liveVersionNo, q.latestVersionNo].filter((n): n is number => n !== null))]
      const rows = await this.db.questionVersion.findMany({ where: { questionId: key, versionNo: { in: numbers } } })
      const carrying = rows.filter((r) => r.stimulusFlag === flag)
      if (carrying.length === 0) throw conflict(M.conflict)
      const now = new Date()
      for (const r of carrying) {
        if (r.flagDismissedAt === null) await this.db.questionVersion.update({ where: { id: r.id }, data: { flagDismissedAt: now, flagDismissedBy: BigInt(actor.userId) } })
      }
      await this.write(actor, AUDIT_ACTIONS.QUESTION_FLAG_DISMISSED, 'question', id, { flag, versions: carrying.map((r) => r.versionNo).join(',') })
      this.questions.invalidateOverview()
      const latest = await this.db.questionVersion.findUnique({ where: { questionId_versionNo: { questionId: key, versionNo: q.latestVersionNo } } })
      const open = latest !== null && latest.stimulusFlag !== null && latest.flagDismissedAt === null ? [latest.stimulusFlag as StimulusFlag] : []
      return { id, flags: open }
    }, TX)
  }

  // --- API-Q-13 work-list -------------------------------------------------------------------------------------------------------

  /**
   * Questions whose LIVE approved version carries an OPEN flag (not dismissed), the set the pupils miss. Without `flag` the two excluding flags are
   * listed; `flag=stem_duplicated` lists those. `counts` cover the whole filter (no paging); `byFlag` always shows the three flags.
   */
  async worklist(f: { subjectId?: string | undefined; educationLevelId?: string | undefined; flag?: StimulusFlag | undefined; page: number; pageSize: number }) {
    const conds: Prisma.Sql[] = [Prisma.sql`v.status = 'approved'`, Prisma.sql`q.is_active`, NOT_PKSK_SQL, NOT_PRIMARY_LEVEL_SQL, Prisma.sql`v.stimulus_flag IS NOT NULL`]
    for (const [text, column] of [
      [f.subjectId, Prisma.sql`v.subject_id`],
      [f.educationLevelId, Prisma.sql`v.education_level_id`],
    ] as const) {
      if (text === undefined) continue
      const k = bi(text)
      conds.push(k === null ? Prisma.sql`FALSE` : Prisma.sql`${column} = ${k}`)
    }
    const from = Prisma.sql`FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no`
    const base = Prisma.join(conds, ' AND ')
    const listed = f.flag === undefined ? Prisma.sql`v.stimulus_flag IN ('stimulus_missing', 'figure_only')` : Prisma.sql`v.stimulus_flag = ${f.flag}`
    const open = Prisma.sql`${base} AND ${listed} AND v.flag_dismissed_at IS NULL`
    const offset = (f.page - 1) * f.pageSize
    const [rows, total, bySubject, byLevel, byFlag, done] = await Promise.all([
      this.db.$queryRaw<
        {
          id: bigint
          number_label: string | null
          stem_ms: string | null
          stem_en: string | null
          subject: string | null
          level: string | null
          flag: string
          ref: string | null
          paper_id: bigint | null
          paper_code: string | null
          year: number | null
          exam_type: string | null
        }[]
      >`SELECT q.id, v.number_label, v.stem_ms, v.stem_en, sj.name AS subject, el.name AS level, v.stimulus_flag AS flag, v.stimulus_flag_ref AS ref,
               sp.id AS paper_id, sp.paper_code, sp.year, sp.exam_type
          ${from}
          LEFT JOIN subjects sj ON sj.id = v.subject_id
          LEFT JOIN education_levels el ON el.id = v.education_level_id
          LEFT JOIN source_papers sp ON sp.id = v.source_paper_id
         WHERE ${open} ORDER BY q.id ASC LIMIT ${f.pageSize} OFFSET ${offset}`,
      this.db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n ${from} WHERE ${open}`,
      this.db.$queryRaw<{ k: bigint | null; n: number }[]>`SELECT v.subject_id AS k, count(*)::int AS n ${from} WHERE ${open} GROUP BY 1`,
      this.db.$queryRaw<{ k: bigint | null; n: number }[]>`SELECT v.education_level_id AS k, count(*)::int AS n ${from} WHERE ${open} GROUP BY 1`,
      this.db.$queryRaw<{ flag: string; n: number }[]>`SELECT v.stimulus_flag AS flag, count(*)::int AS n ${from} WHERE ${base} AND v.flag_dismissed_at IS NULL GROUP BY 1`,
      this.db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n ${from} WHERE ${base} AND v.stimulus_flag IN ('stimulus_missing', 'figure_only') AND v.flag_dismissed_at IS NOT NULL`,
    ])
    const flagCount = (name: StimulusFlag): number => byFlag.find((r) => r.flag === name)?.n ?? 0
    const keyed = (list: { k: bigint | null; n: number }[]): Record<string, number> => Object.fromEntries(list.filter((r) => r.k !== null).map((r) => [idToString(r.k as bigint), r.n]))
    return {
      rows: rows.map((r) => ({
        questionId: idToString(r.id),
        numberLabel: r.number_label,
        stemExcerpt: plainExcerpt(r.stem_ms ?? r.stem_en, EXCERPT_MAX),
        subject: r.subject ?? '',
        level: r.level ?? '',
        flag: r.flag as StimulusFlag,
        reference: r.ref === 'numbered' || r.ref === 'unnumbered' ? r.ref : null,
        paper: r.paper_id === null ? null : { id: idToString(r.paper_id), paperCode: r.paper_code, year: r.year, examType: r.exam_type },
      })),
      total: total[0]?.n ?? 0,
      counts: {
        bySubject: keyed(bySubject),
        byLevel: keyed(byLevel),
        byFlag: { stimulus_missing: flagCount('stimulus_missing'), figure_only: flagCount('figure_only'), stem_duplicated: flagCount('stem_duplicated') },
        open: EXCLUDING.reduce((n, x) => n + flagCount(x), 0),
        done: done[0]?.n ?? 0,
      },
    }
  }

  // --- API-Q-24 regroup -----------------------------------------------------------------------------------------------------------

  async regroup(input: RegroupRequest, actor: HttpActor): Promise<{ group: StimulusGroupDetail; auditId: string }> {
    const out = await this.prisma.transaction(async () => this.regroupInTx(input, actor), TX)
    this.questions.invalidateOverview()
    return out
  }

  private async regroupInTx(input: RegroupRequest, actor: HttpActor): Promise<{ group: StimulusGroupDetail; auditId: string }> {
    const memberIds = input.memberQuestionIds
    const figureId = input.figureQuestionId
    if (figureId !== undefined && memberIds.includes(figureId)) throw fail({ figureQuestionId: M.membersInvalid })
    const wanted = figureId === undefined ? memberIds : [...memberIds, figureId]
    const facts = await this.repo.lockQuestions(wanted)
    for (const id of wanted) if (!facts.has(id)) throw ApiError.of('NOT_FOUND')
    for (const id of wanted) if (facts.get(id)?.pksk === true) throw fail({ [id === figureId ? 'figureQuestionId' : 'memberQuestionIds']: M.membersInvalid })
    for (const id of memberIds) if (facts.get(id)?.groupId != null) throw conflict(M.memberTaken)
    const memberSubjects = new Set(memberIds.map((id) => facts.get(id)?.subjectId ?? ''))
    if (memberSubjects.size > 1) throw fail({ memberQuestionIds: M.memberMixed })
    if (figureId !== undefined && !memberSubjects.has(facts.get(figureId)?.subjectId ?? '')) throw fail({ figureQuestionId: M.memberMixed })

    // 1. The stimulus source.
    let stimulusIds: bigint[] = []
    let createdStimulusId: string | null = null
    let originalFigureStimuli: bigint[] = []
    let figureRow: { live: number | null; latest: number; versions: FigureVersionRow[] } | null = null
    if (input.stimulusId !== undefined) {
      const k = bi(input.stimulusId)
      if (k === null || (await this.repo.getStimulus(input.stimulusId)) === null) throw ApiError.of('NOT_FOUND')
      stimulusIds = [k]
    } else if (figureId !== undefined) {
      const figure = await this.figureSource(figureId, input, facts.get(figureId)?.groupId ?? null)
      stimulusIds = figure.stimulusIds
      createdStimulusId = figure.createdStimulusId
      originalFigureStimuli = figure.originalStimulusIds
      figureRow = figure.row
    } else {
      const parsed = StimulusCreateRequestSchema.safeParse(input.stimulus)
      if (!parsed.success) throw fail(Object.fromEntries(parsed.error.issues.map((i) => [`stimulus.${i.path.join('.')}`.replace(/\.$/, ''), i.message])))
      const created = await this.stimuli.createStimulus(parsed.data)
      createdStimulusId = created.result.id
      stimulusIds = [BigInt(created.result.id)]
    }

    // 2. The snapshot of what the members look like before (flags, stem stimulus links), then the group and its members.
    const matchIds = [...stimulusIds, ...originalFigureStimuli]
    const stimulusRows = await this.db.stimulus.findMany({ where: { id: { in: matchIds } }, select: { id: true, assetFileId: true, contentHash: true } })
    const sameAssets = stimulusRows.flatMap((s) => (s.assetFileId === null ? [] : [s.assetFileId]))
    const sameHashes = stimulusRows.flatMap((s) => (s.contentHash === null ? [] : [s.contentHash]))
    const versionRows: VersionRow[] = []
    const memberKeys = memberIds.map((m) => BigInt(m))
    const before = await this.db.question.findMany({ where: { id: { in: memberKeys } }, select: { id: true, latestVersionNo: true, liveVersionNo: true } })
    const numbersOf = (q: { latestVersionNo: number; liveVersionNo: number | null }): number[] => [...new Set([q.liveVersionNo, q.latestVersionNo].filter((n): n is number => n !== null))]

    // The members as they are BEFORE the move (attaching them to the group decides the flags again): stored flags and the stem links that are the group's image
    // (same stimulus, same asset file or same content hash; the files stay stored for the undo).
    const toDelete: bigint[] = []
    const wantedNumbers = new Map(before.map((q) => [q.id, numbersOf(q)]))
    const beforeVersions = await this.db.questionVersion.findMany({
      where: { questionId: { in: memberKeys }, versionNo: { in: [...new Set([...wantedNumbers.values()].flat())] } },
      include: { stimuli: { include: { stimulus: { select: { assetFileId: true, contentHash: true } } } } },
      orderBy: [{ questionId: 'asc' }, { versionNo: 'asc' }],
    })
    for (const v of beforeVersions) {
      if (!(wantedNumbers.get(v.questionId) ?? []).includes(v.versionNo)) continue
      const gone = v.stimuli.filter(
        (l) =>
          matchIds.includes(l.stimulusId) ||
          (l.stimulus.assetFileId !== null && sameAssets.includes(l.stimulus.assetFileId)) ||
          (l.stimulus.contentHash !== null && sameHashes.includes(l.stimulus.contentHash)),
      )
      versionRows.push({
        q: idToString(v.questionId),
        no: v.versionNo,
        flag: v.stimulusFlag,
        flagAt: iso(v.stimulusFlagAt),
        flagRef: v.stimulusFlagRef,
        dismissedAt: iso(v.flagDismissedAt),
        dismissedBy: v.flagDismissedBy === null ? null : idToString(v.flagDismissedBy),
        removed: gone.map((l) => `${idToString(l.stimulusId)}:${String(l.position)}`).join(','),
      })
      toDelete.push(...gone.map((l) => l.id))
    }
    const groupId = await this.repo.createGroup({ label: input.label ?? null, scope: 'section', stimulusIds, optionBank: [] })
    await this.members.set(groupId, memberIds, 'memberQuestionIds', undefined, false, { regroup: true })
    // The group's own scope (DM-51): the common value of its members, else none (a mixed T4/T5 group keeps no level).
    const traits = await this.repo.memberTraits(groupId)
    const common = <T>(values: readonly T[]): T | null => (values.length > 0 && values.every((v) => v === values[0]) ? (values[0] as T) : null)
    const scopeKertas = common(traits.map((t) => t.kertas))
    await this.repo.setGroupScope(groupId, {
      subjectId: common(traits.map((t) => t.subjectId)),
      educationLevelId: common(traits.map((t) => t.levelId)),
      kertas: scopeKertas === null ? null : Number(scopeKertas),
    })

    // 3. Their own copy of the image goes now that the group supplies it.
    if (toDelete.length > 0) await this.db.questionVersionStimulus.deleteMany({ where: { id: { in: toDelete } } })
    // The flags are decided again on the new facts (a group, no own image): `stimulus_missing` and `figure_only` clear.
    await refreshStimulusFlagsOf(this.db, memberKeys, new Date())

    // 4. The figure-only question becomes the stimulus: archived, `regrouped` (DM-06).
    if (figureId !== undefined && figureRow !== null) await this.archiveFigure(figureId, figureRow, actor)

    // 5. The audit row (DM-59), in the same transaction.
    const memberState = await this.statesOf(memberKeys)
    const figureState = figureId === undefined ? null : ((await this.statesOf([BigInt(figureId)]))[0] ?? null)
    const scope = await this.repo.groupScope(groupId)
    const payload: RegroupPayload = {
      v: 1,
      groupId,
      subjectId: scope?.subjectId ?? null,
      levelId: scope?.educationLevelId ?? null,
      stimulusIds: csv(stimulusIds),
      createdStimulusId,
      members: csv(await this.repo.memberIds(groupId)),
      memberState,
      versions: versionRows,
      figureQuestionId: figureId ?? null,
      figureLive: figureRow?.live ?? null,
      figureState,
      figureVersions: figureRow?.versions ?? [],
      groupUa: (await this.db.stimulusGroup.findUniqueOrThrow({ where: { id: BigInt(groupId) }, select: { updatedAt: true } })).updatedAt.toISOString(),
      stamps: await this.stampsOf([...memberState, ...(figureState === null ? [] : [figureState])]),
    }
    const auditId = await this.write(actor, AUDIT_ACTIONS.QUESTIONS_REGROUPED, 'stimulus_group', groupId, payload as unknown as Record<string, unknown>)
    return { group: await this.stimuli.getGroup(groupId), auditId }
  }

  /** The figure-only question as the stimulus source: its stem stimuli (1 to 3), completed with the label, alt and caption of the request. */
  private async figureSource(
    figureId: string,
    input: RegroupRequest,
    groupId: string | null,
  ): Promise<{ stimulusIds: bigint[]; createdStimulusId: string | null; originalStimulusIds: bigint[]; row: { live: number | null; latest: number; versions: FigureVersionRow[] } }> {
    if (groupId !== null) throw conflict(M.conflict)
    const key = BigInt(figureId)
    const q = await this.db.question.findUniqueOrThrow({ where: { id: key }, select: { latestVersionNo: true, liveVersionNo: true } })
    // A figure question on a published paper cannot be archived without breaking the paper (D10).
    if ((await this.repo.publishedPapersPlacing([figureId])).length > 0) throw conflict(M.conflict)
    const v = await this.db.questionVersion.findUnique({
      where: { questionId_versionNo: { questionId: key, versionNo: q.liveVersionNo ?? q.latestVersionNo } },
      include: { stimuli: { orderBy: { position: 'asc' }, include: { stimulus: true } } },
    })
    if (v === null || v.stimulusFlag !== 'figure_only' || v.stimuli.length === 0) throw fail({ figureQuestionId: M.requestInvalid })
    const first = v.stimuli[0]?.stimulus
    if (first === undefined) throw fail({ figureQuestionId: M.requestInvalid })
    const given = input.stimulus
    const label = given?.label ?? first.label
    const alt = given?.alt ?? first.altText
    const caption = given?.caption ?? first.caption
    // An image needs its alt text (30 QE2.6); the figure row has none to offer, so the admin supplies it.
    if (['image', 'diagram', 'map', 'infographic', 'graph'].includes(first.kind) && (alt === null || alt.trim() === '')) throw fail({ 'stimulus.alt': M.requestInvalid })
    // The figure's own stimulus is never edited: when the admin completes its label, alt or caption, the GROUP gets a copy (same file) and undo deletes the
    // copy. So the undo record holds ids only, no text.
    let createdStimulusId: string | null = null
    let firstId = first.id
    if (label !== first.label || alt !== first.altText || caption !== first.caption) {
      const copy = await this.db.stimulus.create({
        data: {
          kind: first.kind,
          label,
          altText: alt,
          caption,
          bodyMs: first.bodyMs,
          bodyEn: first.bodyEn,
          sourceCitation: first.sourceCitation,
          style: first.style,
          contentHash: first.contentHash,
          assetFileId: first.assetFileId,
          tableData: first.tableData === null ? Prisma.JsonNull : (first.tableData as Prisma.InputJsonValue),
        },
      })
      firstId = copy.id
      createdStimulusId = idToString(copy.id)
    }
    const numbers = [...new Set([q.liveVersionNo, q.latestVersionNo].filter((n): n is number => n !== null))]
    const versions = (await this.db.questionVersion.findMany({ where: { questionId: key, versionNo: { in: numbers } } }))
      .filter((r) => r.status !== 'archived')
      .map((r) => ({ no: r.versionNo, status: r.status, publishedAt: iso(r.publishedAt) }))
    return { stimulusIds: v.stimuli.slice(0, 3).map((l, i) => (i === 0 ? firstId : l.stimulusId)), createdStimulusId, originalStimulusIds: v.stimuli.map((l) => l.stimulusId), row: { live: q.liveVersionNo, latest: q.latestVersionNo, versions } }
  }

  private async archiveFigure(figureId: string, row: { live: number | null; versions: FigureVersionRow[] }, actor: HttpActor): Promise<void> {
    const key = BigInt(figureId)
    for (const v of row.versions) {
      await this.db.questionVersion.update({ where: { questionId_versionNo: { questionId: key, versionNo: v.no } }, data: { status: 'archived', archiveReason: 'regrouped' } })
      await this.db.questionStatusEvent.create({
        data: { questionId: key, versionNo: v.no, fromStatus: v.status, toStatus: 'archived', actorUserId: BigInt(actor.userId), actorRole: actor.roleCode, reason: 'regrouped', requestId: actor.requestId },
      })
    }
    if (row.live !== null) await this.db.question.update({ where: { id: key }, data: { liveVersionNo: null } })
  }

  private async statesOf(keys: readonly bigint[]): Promise<MemberState[]> {
    const rows = await this.db.question.findMany({ where: { id: { in: [...keys] } }, select: { id: true, latestVersionNo: true, liveVersionNo: true }, orderBy: { id: 'asc' } })
    return rows.map((r) => ({ q: idToString(r.id), latest: r.latestVersionNo, live: r.liveVersionNo }))
  }

  /** `updated_at` of the live and latest version of each question: undo compares these by equality (D5), never against a clock. */
  private async stampsOf(states: readonly MemberState[]): Promise<StampRow[]> {
    if (states.length === 0) return []
    const wanted = new Map(states.map((st) => [st.q, new Set([st.latest, ...(st.live === null ? [] : [st.live])])]))
    const rows = await this.db.questionVersion.findMany({
      where: { questionId: { in: states.map((st) => BigInt(st.q)) }, versionNo: { in: [...new Set([...wanted.values()].flatMap((x) => [...x]))] } },
      select: { questionId: true, versionNo: true, updatedAt: true },
      orderBy: [{ questionId: 'asc' }, { versionNo: 'asc' }],
    })
    return rows.filter((r) => wanted.get(idToString(r.questionId))?.has(r.versionNo) === true).map((r) => ({ q: idToString(r.questionId), no: r.versionNo, ua: r.updatedAt.toISOString() }))
  }

  // --- API-Q-36 undo --------------------------------------------------------------------------------------------------------------

  async undo(auditId: string, actor: HttpActor): Promise<{ restored: number }> {
    const key = bi(auditId)
    if (key === null) throw ApiError.of('NOT_FOUND')
    const out = await this.prisma.transaction(async () => {
      const row = await this.db.auditEvent.findUnique({ where: { id: key } })
      if (row === null || row.action !== AUDIT_ACTIONS.QUESTIONS_REGROUPED || row.detail === null || typeof row.detail !== 'object') throw ApiError.of('NOT_FOUND')
      const p = row.detail as unknown as RegroupPayload
      const refused = conflict(REGROUP_MESSAGES.undoConflict)
      // A record the sanitizer touched is never written back (it would put "[redacted]" into the data).
      if (JSON.stringify(p).includes('[redacted]')) throw refused
      // Lock order = group first, then the questions in id order (the order of `GroupMembers.set`), BEFORE anything is read for the conflict check, so an
      // edit that is running right now finishes first and is seen by `assertUnchanged`; a second undo waits here and then finds the group gone.
      if (!(await this.repo.lockGroup(p.groupId))) throw refused
      const memberIds = p.members === '' ? [] : p.members.split(',')
      await this.repo.lockQuestions(p.figureQuestionId === null ? memberIds : [...memberIds, p.figureQuestionId])
      const undone = await this.db.auditEvent.count({ where: { action: AUDIT_ACTIONS.QUESTIONS_REGROUP_UNDONE, targetId: p.groupId } })
      if (undone > 0) throw refused
      await this.assertUnchanged(p, memberIds, refused)

      const groupKey = BigInt(p.groupId)
      await this.db.question.updateMany({ where: { groupId: groupKey }, data: { groupId: null, groupPosition: null } })
      await this.db.stimulusGroup.delete({ where: { id: groupKey } })
      // Restore each version exactly as it was: the stem links removed, and the stored flags (not decided again). One read, one insert.
      const stored = await this.db.questionVersion.findMany({
        where: { questionId: { in: [...new Set(p.versions.map((r) => BigInt(r.q)))] }, versionNo: { in: [...new Set(p.versions.map((r) => r.no))] } },
        select: { id: true, questionId: true, versionNo: true },
      })
      const idOf = new Map(stored.map((v) => [`${idToString(v.questionId)}:${String(v.versionNo)}`, v.id]))
      const links: { questionVersionId: bigint; stimulusId: bigint; position: number }[] = []
      for (const r of p.versions) {
        const versionId = idOf.get(`${r.q}:${String(r.no)}`)
        if (versionId === undefined) continue
        for (const link of r.removed === '' ? [] : r.removed.split(',')) {
          const [sid, pos] = link.split(':')
          links.push({ questionVersionId: versionId, stimulusId: BigInt(sid ?? '0'), position: Number(pos) })
        }
        await this.db.questionVersion.update({
          where: { id: versionId },
          data: {
            stimulusFlag: r.flag,
            stimulusFlagRef: r.flagRef,
            stimulusFlagAt: r.flagAt === null ? null : new Date(r.flagAt),
            flagDismissedAt: r.dismissedAt === null ? null : new Date(r.dismissedAt),
            flagDismissedBy: r.dismissedBy === null ? null : BigInt(r.dismissedBy),
          },
        })
      }
      if (links.length > 0) await this.db.questionVersionStimulus.createMany({ data: links, skipDuplicates: true })
      if (p.createdStimulusId !== null) {
        const usage = await this.repo.usageOf(p.createdStimulusId)
        if (usage.groups + usage.versions + usage.parts === 0) await this.repo.deleteStimulus(p.createdStimulusId)
      }
      let restored = memberIds.length
      if (p.figureQuestionId !== null) {
        const figure = BigInt(p.figureQuestionId)
        for (const v of p.figureVersions) {
          await this.db.questionVersion.update({
            where: { questionId_versionNo: { questionId: figure, versionNo: v.no } },
            data: { status: v.status, archiveReason: null, publishedAt: v.publishedAt === null ? null : new Date(v.publishedAt) },
          })
          // The reverse of the archive event of the regroup.
          await this.db.questionStatusEvent.create({
            data: { questionId: figure, versionNo: v.no, fromStatus: 'archived', toStatus: v.status, actorUserId: BigInt(actor.userId), actorRole: actor.roleCode, reason: 'regroup_undone', requestId: actor.requestId },
          })
        }
        await this.db.question.update({ where: { id: figure }, data: { liveVersionNo: p.figureLive } })
        restored += 1
      }
      await this.write(actor, AUDIT_ACTIONS.QUESTIONS_REGROUP_UNDONE, 'stimulus_group', p.groupId, { auditId, restored })
      return { restored }
    }, TX)
    this.questions.invalidateOverview()
    return out
  }

  /**
   * 409 when the group, its members, its stimuli, a member, the figure question or a draft copy changed since the regroup (D5). EQUALITY against what the
   * regroup recorded (version numbers, `updated_at` of the group and of every member / figure version row), never against a clock.
   */
  private async assertUnchanged(p: RegroupPayload, memberIds: readonly string[], refused: ApiError): Promise<void> {
    const groupKey = BigInt(p.groupId)
    const group = await this.db.stimulusGroup.findUnique({ where: { id: groupKey }, include: { stimuli: { orderBy: { position: 'asc' } } } })
    if (group === null || group.draftOfGroupId !== null || group.updatedAt.toISOString() !== p.groupUa) throw refused
    if ((await this.db.stimulusGroup.count({ where: { draftOfGroupId: groupKey } })) > 0) throw refused
    if (!sameList(await this.repo.memberIds(p.groupId), memberIds)) throw refused
    if (!sameList(group.stimuli.map((s) => idToString(s.stimulusId)), p.stimulusIds.split(','))) throw refused
    const states = [...p.memberState, ...(p.figureState === null ? [] : [p.figureState])]
    const now = await this.statesOf(states.map((st) => BigInt(st.q)))
    for (const st of states) {
      const c = now.find((n) => n.q === st.q)
      if (c === undefined || c.latest !== st.latest || c.live !== st.live) throw refused
    }
    // An in-place edit of a draft keeps the version number, so the row stamps are compared as well.
    const current = await this.stampsOf(states)
    if (current.length !== p.stamps.length || current.some((c, i) => c.q !== p.stamps[i]?.q || c.no !== p.stamps[i]?.no || c.ua !== p.stamps[i]?.ua)) throw refused
  }
}
