import { Inject, Injectable } from '@nestjs/common'
import {
  SpmAdminTrackingASetCreateSchema,
  SpmAdminTrackingASetSaveSchema,
  TRACKING_A_CANDIDATE_CAP,
  TRACKING_A_KIND,
  TRACKING_A_MESSAGES as COPY,
  TRACKING_A_PROPOSED_COPY as PROPOSED,
  TRACKING_A_YEAR_MIN,
  trackingSetAttentionMs,
  type SpmAdminTrackingACandidate,
  type SpmAdminTrackingAMember,
  type SpmAdminTrackingASet,
  type SpmAdminTrackingASetItem,
  type SpmSetStatus,
} from '@pp/contract'
import type { z } from 'zod'

import { ApiError } from '../../common/errors/api-error'
import { CLOCK, type Clock } from '../../db/clock'
import { QuestionsRepository, trackingAFilter, type QuestionRecord, type StimulusGroupRecord } from '../questions'
import type { PracticeRamalanSource } from '../practice'
import { SpmCatalogService } from './catalog.service'
import { BAHASA_CODES, DEFAULT_SET_SIZE } from './config'
import { isStartable, setFigures } from './rules'
import { SpmRepository, type TrackingSetRow } from './spm.repository'

/** A candidate page: enough to reach the cap in one read when the subject has no groups. */
const CANDIDATE_PAGE = TRACKING_A_CANDIDATE_CAP
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000

const refuse = (reason: string): ApiError => ApiError.of('VALIDATION_ERROR', { fields: { items: reason } })
const isUniqueViolation = (e: unknown): boolean => typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002'

/** The first issue per top-level field; a nested item issue is reported on `items`. */
function fieldsOf(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) fields[String(issue.path[0] ?? '_')] ??= issue.message
  return fields
}

/** A Tracking A set with its derived figures (computed on read, never stored; G-15). */
export interface SetView {
  subjectId: string
  year: number
  setNo: number
  status: SpmSetStatus
  readyCount: number
  bankSource: number | null
  dskpTagged: number
  dskpTotal: number
  /** Eligible questions in the set (a deactivated or unpublished one leaves it). */
  eligibleCount: number
  size: number
  /** Eligible question ids in `position` order. */
  eligibleIds: string[]
}

/**
 * Tracking A sets (BR-M06-08, -14). Eligibility comes from `QuestionsRepository` (published, active, live version);
 * a question that stops being eligible leaves the count with no write to `spm_tracking_sets`.
 * Implements the `ramalan` port of the practice module (`PracticeRamalanSource`), bound in `SpmModule.onModuleInit`.
 */
@Injectable()
export class SpmTrackingService implements PracticeRamalanSource {
  constructor(
    @Inject(SpmRepository) private readonly repo: SpmRepository,
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
    @Inject(SpmCatalogService) private readonly catalog: SpmCatalogService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private async sizes(): Promise<Map<string, number>> {
    return new Map((await this.catalog.spmSubjects()).map((s) => [s.subjectId, s.targetSize ?? DEFAULT_SET_SIZE]))
  }

  private async views(rows: readonly TrackingSetRow[], sizes: ReadonlyMap<string, number>): Promise<SetView[]> {
    // Only the ids the sets hold are checked (one bounded query per subject), never the whole subject.
    const idsBySubject = new Map<string, Set<string>>()
    for (const r of rows) {
      const set = idsBySubject.get(r.subjectId) ?? new Set<string>()
      for (const id of r.questionIds) set.add(id)
      idsBySubject.set(r.subjectId, set)
    }
    const eligibleBySubject = new Map<string, Set<string>>()
    for (const [subjectId, ids] of idsBySubject) {
      eligibleBySubject.set(subjectId, new Set(await this.questions.eligibleAmong([...ids], trackingAFilter(subjectId))))
    }
    return rows.map((row) => {
      const size = sizes.get(row.subjectId) ?? DEFAULT_SET_SIZE
      const eligible = eligibleBySubject.get(row.subjectId) ?? new Set<string>()
      const eligibleIds = row.questionIds.filter((id) => eligible.has(id))
      const f = setFigures(eligibleIds.length, size)
      const dskpTotal = f.bankSource ?? f.readyCount
      return {
        subjectId: row.subjectId,
        year: row.year,
        setNo: row.setNo,
        status: f.status,
        readyCount: f.readyCount,
        bankSource: f.bankSource,
        dskpTagged: Math.min(row.dskpTagged, dskpTotal),
        dskpTotal,
        eligibleCount: eligibleIds.length,
        size,
        eligibleIds,
      }
    })
  }

  /** The sets of every subject that has any (any year), by subject then set number. */
  async allSets(): Promise<Map<string, SetView[]>> {
    const views = await this.views(await this.repo.sets(), await this.sizes())
    const out = new Map<string, SetView[]>()
    for (const v of views) out.set(v.subjectId, [...(out.get(v.subjectId) ?? []), v])
    return out
  }

  /** The sets of one subject (optionally of one year), year descending then set number (D-14). */
  async setsOf(subjectId: string, year?: number): Promise<SetView[]> {
    const rows = await this.repo.sets({ subjectId, ...(year === undefined ? {} : { year }) })
    return (await this.views(rows, await this.sizes())).sort((a, b) => b.year - a.year || a.setNo - b.setNo)
  }

  /**
   * BR-M06-14, the read `ramalan` starts from: `null` for an unknown set, `[]` for a `belum_cukup` set, otherwise
   * the eligible question ids in `position` order. There is no cut at the set size: a cut could split a group (D-16).
   */
  async ramalanQuestionIds(subjectId: string, year: number, setNo: number): Promise<string[] | null> {
    let row: TrackingSetRow | null
    try {
      row = await this.repo.set(subjectId, year, setNo)
    } catch {
      return null // an id that is not a decimal id names no set
    }
    if (!row) return null
    const [view] = await this.views([row], await this.sizes())
    if (!view || !isStartable(view.status)) return []
    return view.eligibleIds
  }

  // --- API-BIJAK-13 Tracking A admin (S3-T05) ---------------------------------------------------

  async adminSet(id: string): Promise<SpmAdminTrackingASet> {
    const row = await this.repo.setById(id)
    if (!row) throw ApiError.of('NOT_FOUND')
    return this.adminView(row)
  }

  /** `Tambah Set`, field 17-01. The subject of a set never changes, so the subject and year copied to its rows stay true (DM-24). */
  async createSet(raw: unknown): Promise<SpmAdminTrackingASet> {
    const maxYear = new Date(this.clock.now().getTime() + MYT_OFFSET_MS).getUTCFullYear() + 1
    const res = SpmAdminTrackingASetCreateSchema.safeParse(raw)
    const fields = res.success ? {} : fieldsOf(res.error)
    if (fields.year !== undefined || (res.success && (res.data.year < TRACKING_A_YEAR_MIN || res.data.year > maxYear))) fields.year = PROPOSED.yearRange(maxYear)
    if (Object.keys(fields).length > 0 || !res.success) throw ApiError.of('VALIDATION_ERROR', { fields })
    const { subjectId, year, setNo } = res.data
    const subject = (await this.catalog.spmSubjects()).find((s) => s.subjectId === subjectId)
    // D-11: BM and BI have no objective sets; they are not options of the select.
    if (!subject || (BAHASA_CODES as readonly string[]).includes(subject.code)) throw ApiError.of('VALIDATION_ERROR', { fields: { subjectId: COPY.subjectRequired } })
    let id: string
    try {
      id = await this.repo.createSet(subjectId, year, setNo)
    } catch (e) {
      if (isUniqueViolation(e)) throw ApiError.of('VALIDATION_ERROR', { fields: { setNo: COPY.setExists(setNo) } })
      throw e
    }
    return this.adminSet(id)
  }

  /**
   * FR-ADM-Q17.5: the whole set in one transaction. Every check runs first, and any refusal leaves the set as it was. A group expands to all its
   * members in group order; the target counts questions; a group that does not fit is refused whole (FR-ADM-Q17.6, D-16, PO 15).
   */
  async saveSet(id: string, raw: unknown): Promise<SpmAdminTrackingASet> {
    const row = await this.repo.setById(id)
    if (!row) throw ApiError.of('NOT_FOUND')
    const res = SpmAdminTrackingASetSaveSchema.safeParse(raw)
    if (!res.success) throw ApiError.of('VALIDATION_ERROR', { fields: fieldsOf(res.error) })
    const { items } = res.data

    const singles = new Map((await this.questions.getMany(items.filter((i) => i.kind === 'question').map((i) => i.id), 'latest')).map((r) => [r.id, r]))
    const filter = trackingAFilter(row.subjectId)
    const groups = new Map((await this.questions.groupsByIds(items.filter((i) => i.kind === 'group').map((i) => i.id))).map((g) => [g.id, g]))
    const groupMembers = await this.wholeGroupMembers([...groups.values()], row.subjectId)

    // Expand, refusing what can never be a member, with the row number the admin sees.
    const units: { questions: string[]; group: StimulusGroupRecord | null; position: number }[] = []
    const positions = new Map<string, number>()
    let next = 1
    for (const item of items) {
      const group = item.kind === 'group' ? (groups.get(item.id) ?? null) : null
      const inGroup = group === null ? [] : (groupMembers.get(group.id) ?? [])
      if (item.kind === 'group' && inGroup.length === 0) throw refuse(PROPOSED.notServable(next))
      const single = item.kind === 'question' ? singles.get(item.id) : undefined
      if (item.kind === 'question' && !single) throw refuse(PROPOSED.notServable(next))
      if (single?.groupId != null) throw refuse(PROPOSED.groupMember(next))
      const members = item.kind === 'group' ? inGroup : [item.id]
      units.push({ questions: members, group, position: next })
      for (const questionId of members) {
        if (positions.has(questionId)) throw refuse(PROPOSED.repeated(next))
        positions.set(questionId, next++)
      }
    }
    const flat = [...positions.keys()]

    const servable = new Set(await this.questions.eligibleAmong(flat, filter))
    for (const questionId of flat) if (!servable.has(questionId)) throw refuse(PROPOSED.notServable(positions.get(questionId) as number))

    const siblings = await this.repo.siblingHolders(row.subjectId, row.year, row.id)
    this.assertNoSibling(flat, positions, siblings)

    const target = (await this.sizes()).get(row.subjectId) ?? DEFAULT_SET_SIZE
    let running = 0
    for (const unit of units) {
      if (unit.group !== null && running + unit.questions.length > target) {
        throw refuse(COPY.groupNoFit(groupLabel(unit.group), unit.questions.length, Math.max(0, target - running)))
      }
      running += unit.questions.length
    }
    if (flat.length > target) throw refuse(PROPOSED.overTarget(target, flat.length - target))

    // D-17: the stored count the pupil's set card shows. `hasDskp` of the practice bridge: linked to a curriculum chapter.
    const dskpTagged = (await this.questions.getMany(flat, 'live')).filter((r) => r.version.chapterId !== null).length
    try {
      await this.repo.saveSet(row.id, row.subjectId, row.year, flat, dskpTagged)
    } catch (e) {
      if (!isUniqueViolation(e)) throw e
      // Another save took a question between the check and the index: say which, as the check would have.
      this.assertNoSibling(flat, positions, await this.repo.siblingHolders(row.subjectId, row.year, row.id))
      throw ApiError.of('CONFLICT')
    }
    return this.adminSet(row.id)
  }

  /**
   * What each group brings to a set of this subject, in group order: its eligible members, without the archived ones, which are no gap (`groupCompleteSql`).
   * Any other member that is not eligible here, one of another subject for example, leaves the group with nothing: a group is never split (FR-ADM-Q17.6).
   */
  private async wholeGroupMembers(groups: readonly StimulusGroupRecord[], subjectId: string): Promise<Map<string, string[]>> {
    const all = groups.flatMap((g) => g.questionIds)
    const [eligible, archived] = await Promise.all([this.questions.eligibleAmong(all, trackingAFilter(subjectId)).then((ids) => new Set(ids)), this.questions.latestArchivedAmong(all)])
    return new Map(groups.map((g) => [g.id, g.questionIds.every((id) => eligible.has(id) || archived.has(id)) ? g.questionIds.filter((id) => eligible.has(id)) : []]))
  }

  private assertNoSibling(flat: readonly string[], positions: ReadonlyMap<string, number>, siblings: ReadonlyMap<string, number>): void {
    for (const questionId of flat) {
      const setNo = siblings.get(questionId)
      if (setNo !== undefined) throw refuse(COPY.siblingClash(positions.get(questionId) as number, setNo))
    }
  }

  private async adminView(row: TrackingSetRow): Promise<SpmAdminTrackingASet> {
    const [view] = await this.views([row], await this.sizes())
    const subject = [...(await this.catalog.subjectsByCode()).values()].find((s) => s.subjectId === row.subjectId)
    const served = new Set(view?.eligibleIds ?? [])
    const filled = view?.eligibleCount ?? 0
    const targetCount = view?.size ?? DEFAULT_SET_SIZE
    return {
      id: row.id,
      subjectId: row.subjectId,
      subject: subject?.name ?? '',
      year: row.year,
      setNo: row.setNo,
      kind: TRACKING_A_KIND,
      targetCount,
      filled,
      attention: isStartable(view?.status ?? 'belum_cukup') ? [] : [trackingSetAttentionMs(filled, targetCount)],
      items: await this.itemsOf(row.questionIds, served),
      candidates: await this.questions.eligibleUnitCount(trackingAFilter(row.subjectId)),
      candidateItems: await this.candidateItems(row),
    }
  }

  /** The stored rows as units: a run of members of one group is one item (FR-ADM-Q17.6). A question with no live version reads its latest. */
  private async itemsOf(ids: readonly string[], served: ReadonlySet<string>): Promise<SpmAdminTrackingASetItem[]> {
    const live = await this.questions.getMany(ids, 'live')
    const found = new Set(live.map((r) => r.id))
    const latest = await this.questions.getMany(ids.filter((id) => !found.has(id)), 'latest')
    const byId = new Map([...live, ...latest].map((r) => [r.id, r]))
    const groups = new Map((await this.questions.groupsByIds([...new Set([...byId.values()].flatMap((r) => (r.groupId === null ? [] : [r.groupId])))])).map((g) => [g.id, g]))
    const out: SpmAdminTrackingASetItem[] = []
    let position = 1
    for (let i = 0; i < ids.length; ) {
      const record = byId.get(ids[i] as string)
      const groupId = record?.groupId ?? null
      const run: string[] = [ids[i] as string]
      for (let j = i + 1; groupId !== null && j < ids.length && byId.get(ids[j] as string)?.groupId === groupId; j++) run.push(ids[j] as string)
      const members = run.map((id) => memberOf(id, byId.get(id), served.has(id)))
      const group = groupId === null ? undefined : groups.get(groupId)
      out.push(
        group
          ? { kind: 'group', id: group.id, position, questions: run.length, label: groupLabel(group), members }
          : { kind: 'question', id: run[0] as string, position, questions: 1, label: members[0]?.stem ?? '', members },
      )
      position += run.length
      i += run.length
    }
    return out
  }

  /**
   * PO 16: the units this set could take, in id order, capped: servable, and held by no sibling set. A group with a member held by a sibling is left
   * out whole. The set's own members are listed too, so a removed one can come back; the editor leaves out what its draft holds.
   */
  private async candidateItems(row: TrackingSetRow): Promise<SpmAdminTrackingACandidate[]> {
    const filter = trackingAFilter(row.subjectId)
    const held = await this.repo.siblingHolders(row.subjectId, row.year, row.id)
    const out: SpmAdminTrackingACandidate[] = []
    const seenGroups = new Set<string>()
    for (let after: string | undefined; ; ) {
      const page = await this.questions.eligibleIdsPage(filter, after, CANDIDATE_PAGE)
      if (page.length === 0) return out
      const records = await this.questions.getMany(page, 'live')
      const groups = await this.questions.groupsByIds([...new Set(records.flatMap((r) => (r.groupId === null || seenGroups.has(r.groupId) ? [] : [r.groupId])))])
      const groupMembers = await this.wholeGroupMembers(groups, row.subjectId)
      const memberRecords = new Map((await this.questions.getMany([...groupMembers.values()].flat(), 'live')).map((r) => [r.id, r]))
      const groupById = new Map(groups.map((g) => [g.id, g]))
      for (const record of records) {
        if (record.groupId === null) {
          if (!held.has(record.id)) {
            const member = memberOf(record.id, record, true)
            out.push({ kind: 'question', id: record.id, questions: 1, label: member.stem, members: [member] })
          }
        } else if (!seenGroups.has(record.groupId)) {
          seenGroups.add(record.groupId)
          const group = groupById.get(record.groupId)
          const members = (groupMembers.get(record.groupId) ?? []).filter((id) => memberRecords.has(id))
          if (group && members.length > 0 && !members.some((id) => held.has(id))) {
            out.push({ kind: 'group', id: group.id, questions: members.length, label: groupLabel(group), members: members.map((id) => memberOf(id, memberRecords.get(id), true)) })
          }
        }
        if (out.length >= TRACKING_A_CANDIDATE_CAP) return out
      }
      if (page.length < CANDIDATE_PAGE) return out
      after = page[page.length - 1]
    }
  }
}

const groupLabel = (group: StimulusGroupRecord): string => group.label ?? group.stimuli[0]?.label ?? group.id

function memberOf(id: string, record: QuestionRecord | undefined, servable: boolean): SpmAdminTrackingAMember {
  const archived = record !== undefined && (record.version.status === 'archived' || !record.isActive)
  return { id, stem: record?.version.stemMs ?? '', servable, statusWord: servable || !archived ? null : 'diarkib' }
}
