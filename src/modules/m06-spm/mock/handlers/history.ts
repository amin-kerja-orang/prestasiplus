/**
 * `GET /api/spm/history?mod=&halaman=` (API-BIJAK-07, S3-T07 part F) and the "Prestasi SPM Anda" figures of the hub.
 * Everything is computed from the M05 session dataset (completed sessions of the SPM modes; D11/D12): the mock has no
 * Bijak sittings, so the list holds practice sessions only, with the legacy `past_year` and `ramalan` reported as
 * `databank` and `tracking_a`. Stats are over all modes (never narrowed by the chip or the page); accuracy is pooled
 * (correct / answered), a whole number rounded half up, `null` with 0 answers.
 */

import { fail, ok, queryInt, queryString, requireAuth, route, type MockRequest, type RouteDef } from '@/mock/define'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { SPM_MODES, practice } from '@/modules/m05-practice/mock'

import type { SpmHistoryRow, SpmHistoryRowMode, SpmMyStats } from '../../api/types'

const PAGE_SIZE = 15

const ROW_MODE: Record<string, SpmHistoryRowMode> = {
  past_year: 'databank',
  databank: 'databank',
  latih_tubi: 'latih_tubi',
  ramalan: 'tracking_a',
  tracking_a: 'tracking_a',
}

const CHIPS = ['all', 'databank', 'latih_tubi', 'tracking_a', 'past_year', 'ramalan'] as const
const CHIP_OF: Record<string, SpmHistoryRowMode | 'all'> = {
  all: 'all',
  databank: 'databank',
  past_year: 'databank',
  latih_tubi: 'latih_tubi',
  tracking_a: 'tracking_a',
  ramalan: 'tracking_a',
}

const wholePercent = (correct: number, total: number): number =>
  total === 0 ? 0 : Math.floor((correct * 100) / total + 0.5)

/** The four tiles of one user (`SpmOverview.me` and `meta.stats`). */
export function spmMyStats(userId: number): SpmMyStats {
  const all = practice.history(userId, { modes: SPM_MODES })
  const answered = all.reduce((a, s) => a + s.questionCount, 0)
  const correct = all.reduce((a, s) => a + s.correctCount, 0)
  return {
    sessions: all.length,
    avgAccuracy: answered === 0 ? null : wholePercent(correct, answered),
    coins: all.reduce((a, s) => a + s.coinsEarned, 0),
    answered,
  }
}

function rowsOf(userId: number): SpmHistoryRow[] {
  return practice
    .history(userId, { modes: SPM_MODES })
    .flatMap((s) => {
      const mode = ROW_MODE[s.mode]
      if (!mode || !s.completedAt) return []
      const subject = s.subjectId !== null ? curriculum.subject(s.subjectId) : undefined
      return [
        {
          id: s.id,
          mode,
          subject: { code: subject?.code ?? 'UMUM', name: subject?.name ?? 'Umum' },
          correct: s.correctCount,
          total: s.questionCount,
          percent: wholePercent(s.correctCount, s.questionCount),
          coins: s.coinsEarned,
          durationSeconds: s.timeSpent,
          completedAt: s.completedAt,
        },
      ]
    })
    .sort((a, b) => (a.completedAt < b.completedAt ? 1 : a.completedAt > b.completedAt ? -1 : 0))
}

function history(req: MockRequest) {
  const mod = queryString(req.query, 'mod') ?? queryString(req.query, 'type') ?? 'all'
  const chip = CHIP_OF[mod]
  if (!chip) {
    return fail(422, 'VALIDATION_ERROR', 'Mod tidak sah.', { mod: `Mod mestilah salah satu: ${CHIPS.join(', ')}.` })
  }
  const requested = queryInt(req.query, 'halaman')
  if (requested !== undefined && requested < 1) {
    return fail(422, 'VALIDATION_ERROR', 'Halaman tidak sah.', { halaman: 'Halaman mestilah 1 atau lebih.' })
  }
  const page = requested ?? 1
  const userId = req.session?.userId
  if (userId === undefined) throw new Error('a guard must run first')
  const all = rowsOf(userId)
  const rows = chip === 'all' ? all : all.filter((r) => r.mode === chip)
  return ok(rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), {
    meta: {
      page,
      pageSize: PAGE_SIZE,
      pageCount: Math.max(1, Math.ceil(rows.length / PAGE_SIZE)),
      total: rows.length,
      mod: chip,
      stats: spmMyStats(userId),
    },
  })
}

export const historyRoutes: RouteDef[] = [route('GET', '/api/spm/history', [requireAuth()], (req) => history(req))]
