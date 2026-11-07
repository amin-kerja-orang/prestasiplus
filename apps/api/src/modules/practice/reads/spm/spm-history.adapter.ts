import { Inject, Injectable } from '@nestjs/common'
import type { BijakAttemptKind, SpmHistoryRowMode } from '@pp/contract'

import { idFromString, idToString } from '../../../../db/ids'
import { PrismaService } from '../../../../db/prisma.service'
import { BijakAttemptHistoryReads, type ClosedAttemptRow } from '../../../bijak/attempts'
import { CurriculumRepository } from '../../../curriculum'
import { SPM_SESSION_MODES } from '../../../spm/config'
import type { SpmHistoryPageQuery, SpmHistoryRowData, SpmHistorySource } from '../../../spm/ports'
import { KUIZ_ORIGIN } from '../../practice.repository'

/** `exam_attempts.paper_kind` to the OPT-MODE-SESI row mode (ruling 6): a `pilihan` or `jana` paper is a Bijak SPM sitting. */
export function rowModeOfKind(kind: BijakAttemptKind): SpmHistoryRowMode {
  return kind === 'subjektif' ? 'subjektif' : kind === 'structured' ? 'structured' : 'simulasi'
}

/** The row mode of a completed practice session: legacy `past_year` is `databank`, `ramalan` is `tracking_a`, a Kuiz session is `kuiz`. */
export function rowModeOfSession(mode: string, legacyPaper: string | null): SpmHistoryRowMode {
  if (mode === 'latih_tubi' && legacyPaper === KUIZ_ORIGIN) return 'kuiz'
  if (mode === 'past_year' || mode === 'databank') return 'databank'
  if (mode === 'ramalan' || mode === 'tracking_a') return 'tracking_a'
  return 'latih_tubi'
}

/** Whole-number percent, half up; 0 when there is nothing to score. */
const percentOf = (part: number, whole: number): number => (whole > 0 ? Math.floor((part * 100) / whole + 0.5) : 0)

/** Elapsed seconds of a sitting, capped at its deadline (D46: "a sitting counts its elapsed time capped at the deadline"). */
export function sittingSeconds(row: Pick<ClosedAttemptRow, 'startedAt' | 'deadlineAt' | 'completedAt'>): number {
  const end = row.deadlineAt && row.deadlineAt < row.completedAt ? row.deadlineAt : row.completedAt
  return Math.max(0, Math.floor((end.getTime() - row.startedAt.getTime()) / 1000))
}

/** Compares two ids: numeric strings numerically (so "10" sorts after "9"), anything else (uuids) as text, which is also the database order of a uuid. */
export function compareIds(a: string, b: string): number {
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
    const x = BigInt(a)
    const y = BigInt(b)
    return x < y ? -1 : x > y ? 1 : 0
  }
  return a < b ? -1 : a > b ? 1 : 0
}

/** Newest first: `completedAt` descending, then id descending (the order the two sources are sorted in). */
export const compareNewestFirst = (a: SpmHistoryRowData, b: SpmHistoryRowData): number => b.completedAt.getTime() - a.completedAt.getTime() || compareIds(b.id, a.id)

/**
 * Whether the requested page starts at or after the end of `total` rows. The caller then answers an empty page and reads no rows, so
 * a huge `halaman` can neither overflow a `take` nor load the history. A page that is not a safe positive integer is also past the end.
 */
export function isPastEnd(page: number, pageSize: number, total: number): boolean {
  if (!Number.isSafeInteger(page) || page < 1) return true
  return (page - 1) * pageSize >= total
}

/**
 * `SpmHistorySource` (S3-T07 part F, ruling Q6): the Sejarah Kuiz SPM list merged from completed `practice_sessions` (S5, read here)
 * and closed `exam_attempts` (read through the attempts owner). Abandoned, in-progress and swept sessions are not listed.
 *
 * Chips: `databank` also lists the legacy `past_year`, `tracking_a` the legacy `ramalan`, `latih_tubi` the Latih Tubi sessions
 * (a Kuiz session is not one of them). Only `all` lists the Bijak, Subjektif, Berstruktur and Kuiz sittings.
 *
 * Paging is server side: each source returns its newest `page x pageSize` rows and the merge cuts the page, so a deep page costs
 * the depth, never the whole history. Read-only.
 */
@Injectable()
export class PracticeSpmHistory implements SpmHistorySource {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BijakAttemptHistoryReads) private readonly attempts: BijakAttemptHistoryReads,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
  ) {}

  private sessionWhere(query: SpmHistoryPageQuery) {
    const modes: readonly string[] =
      query.chip === 'databank' ? ['databank', 'past_year'] : query.chip === 'tracking_a' ? ['tracking_a', 'ramalan'] : query.chip === 'latih_tubi' ? ['latih_tubi'] : SPM_SESSION_MODES
    return {
      userId: idFromString(query.userId),
      status: 'completed',
      mode: { in: [...modes] },
      ...(query.includeTest ? {} : { isTest: false }),
      // The Latih Tubi chip leaves out a Kuiz session (it shares the stored mode `latih_tubi`).
      ...(query.chip === 'latih_tubi' ? { OR: [{ legacyPaper: null }, { legacyPaper: { not: KUIZ_ORIGIN } }] } : {}),
    }
  }

  async page(query: SpmHistoryPageQuery): Promise<{ rows: SpmHistoryRowData[]; total: number }> {
    const where = this.sessionWhere(query)
    const withAttempts = query.chip === 'all'
    // Totals first: a page past the end reads nothing, and `take` below never exceeds total + pageSize.
    const [sessionTotal, attemptTotal] = await Promise.all([
      this.prisma.client.practiceSession.count({ where }),
      withAttempts ? this.attempts.closedCount(query.userId, { includeTest: query.includeTest }) : Promise.resolve(0),
    ])
    const total = sessionTotal + attemptTotal
    if (isPastEnd(query.page, query.pageSize, total)) return { rows: [], total }
    const depth = query.page * query.pageSize
    const [sessionRows, attemptRows, subjects] = await Promise.all([
      this.prisma.client.practiceSession.findMany({ where, orderBy: [{ completedAt: 'desc' }, { id: 'desc' }], take: depth }),
      withAttempts ? this.attempts.closedNewest(query.userId, { includeTest: query.includeTest }, depth) : Promise.resolve([]),
      this.curriculum.subjects(),
    ])
    const names = new Map(subjects.map((s) => [idToString(s.id), { code: s.code, name: s.name }]))
    const fromSessions: SpmHistoryRowData[] = sessionRows.flatMap((s) => {
      if (s.completedAt === null) return []
      const subject = s.subjectId === null ? null : (names.get(idToString(s.subjectId)) ?? null)
      return [
        {
          id: s.id,
          mode: rowModeOfSession(s.mode, s.legacyPaper),
          subject: subject ?? { code: 'UMUM', name: 'Umum' },
          correct: s.correctCount,
          total: s.questionCount,
          percent: percentOf(s.correctCount, s.questionCount),
          coins: s.coinsEarned,
          durationSeconds: s.timeSpentSec,
          completedAt: s.completedAt,
        },
      ]
    })
    const fromAttempts: SpmHistoryRowData[] = attemptRows.map((a) => {
      const score = a.score ?? 0
      const max = a.maxScore ?? 0
      return {
        id: a.id,
        mode: rowModeOfKind(a.paperKind),
        subject: { code: a.subjectCode, name: a.subjectName },
        correct: Math.round(score),
        total: Math.round(max),
        percent: percentOf(score, max),
        coins: a.coins ?? 0,
        durationSeconds: sittingSeconds(a),
        completedAt: a.completedAt,
      }
    })
    const merged = [...fromSessions, ...fromAttempts].sort(compareNewestFirst)
    const start = (query.page - 1) * query.pageSize
    return { rows: merged.slice(start, start + query.pageSize), total }
  }
}
